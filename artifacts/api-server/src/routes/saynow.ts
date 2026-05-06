import { Router, type Request, type Response, type NextFunction } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const router = Router();

// ── Client factories ─────────────────────────────────────────────────────────
function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin not configured');
  return createClient(url, key);
}

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// ── Credit system ────────────────────────────────────────────────────────────
const MONTHLY_LIMITS = { brief: 10, interval: 300, debrief: 10 } as const;

const CREDIT_COLS = {
  brief:    { monthly: 'monthly_briefs_used',    pack: 'pack_briefs' },
  interval: { monthly: 'monthly_intervals_used', pack: 'pack_intervals' },
  debrief:  { monthly: 'monthly_debriefs_used',  pack: 'pack_debriefs' },
} as const;

type CreditType = keyof typeof CREDIT_COLS;

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

async function checkAndDecrementCredits(userId: string, creditType: CreditType) {
  const supabase = getSupabaseAdmin();
  const cols = CREDIT_COLS[creditType];
  const limit = MONTHLY_LIMITS[creditType];
  const resetDay = firstDayOfMonth();

  let { data: credits, error } = await supabase
    .from('credits').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;

  if (!credits) {
    const { data: created, error: ce } = await supabase
      .from('credits').insert({ user_id: userId, reset_date: resetDay }).select().single();
    if (ce) throw ce;
    credits = created;
  }

  if (credits.reset_date < resetDay) {
    const { data: reset, error: re } = await supabase.from('credits').update({
      monthly_briefs_used: 0, monthly_intervals_used: 0, monthly_debriefs_used: 0,
      reset_date: resetDay, updated_at: new Date().toISOString(),
    }).eq('user_id', userId).select().single();
    if (re) throw re;
    credits = reset;
  }

  const monthlyUsed = (credits[cols.monthly] as number) ?? 0;
  const packRemaining = (credits[cols.pack] as number) ?? 0;

  if (monthlyUsed >= limit) {
    if (packRemaining <= 0) return { exhausted: true };
    await supabase.from('credits')
      .update({ [cols.pack]: packRemaining - 1, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  } else {
    await supabase.from('credits')
      .update({ [cols.monthly]: monthlyUsed + 1, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  }
  return { exhausted: false };
}

// ── Global system prompt (injected into every Claude call) ────────────────────
const SYSTEM_PROMPT = `You are a real-time sales coach inside a live call.
Your job is to help the user win the conversation.
Rules:
- Always be concise
- Always give direct instructions
- Never explain reasoning
- Never use more than 1 sentence per coaching card unless explicitly asked
- Sound natural, confident, and human
Tone: urgent, calm, and confident`;

// ── Prompt builders ──────────────────────────────────────────────────────────
type PromptData = Record<string, unknown>;

function buildEventCoachPrompt(d: PromptData) {
  const { triggerType, utterance, competitor, elapsedSeconds, talkingPoints } = d as {
    triggerType: string; utterance?: string; competitor?: string;
    elapsedSeconds?: number; talkingPoints?: string[];
  };

  const stage = elapsedSeconds == null ? 'unknown'
    : elapsedSeconds < 90 ? 'opening'
    : elapsedSeconds < 300 ? 'discovery'
    : elapsedSeconds < 540 ? 'pitch'
    : 'closing';

  const triggerPrompts: Record<string, string> = {
    objection: `The prospect just raised an objection: "${utterance}"

Give ONE sharp response the rep should say next to handle this objection.

Rules:
- 1 sentence only
- Must sound natural and confident
- No explanation
- No labels like "Response:"`,

    competitor: `The prospect mentioned a competitor: "${competitor}"${utterance ? ` — they said: "${utterance}"` : ''}

Give ONE confident line to acknowledge and redirect to our differentiator.

Rules:
- 1 sentence only
- Sound natural, not defensive
- No explanation`,

    silence: `The conversation has stalled. Dead air for 5+ seconds.

Give ONE short line the rep can say to restart the conversation and regain control.

Rules:
- 1 sentence
- Must be engaging and direct
- No explanation`,

    'talk-ratio-warning': `The rep is talking too much — dominating over 60% of the conversation.

Give ONE short instruction to help them rebalance and let the prospect speak.

Rules:
- 1 sentence
- Direct and corrective
- No explanation`,

    'filler-spike': `The rep used too many filler words (um, uh, like, basically) just now: "${utterance}"

Give ONE short, direct coaching instruction to improve their clarity and confidence.

Rules:
- 1 sentence
- Actionable and immediate
- No explanation`,

    'no-question': `The rep has not asked a discovery question in over 4 minutes.

Give ONE short line the rep can use to invite the prospect to share their perspective.

Rules:
- 1 sentence
- Must spark dialogue
- No explanation`,
  };

  const prompt = triggerPrompts[triggerType] ?? `A coaching moment occurred: ${triggerType}${utterance ? ` — "${utterance}"` : ''}

Give ONE sharp, actionable coaching instruction.

Rules:
- 1 sentence only
- Direct and specific
- No explanation`;

  const points = (talkingPoints as string[] | undefined) ?? [];
  const battlecard = competitor
    ? `\nCOMPETITOR CONTEXT: When "${competitor}" is mentioned, acknowledge briefly then redirect to your unique differentiator.`
    : '';

  return `ELAPSED TIME: ${elapsedSeconds ?? 0}s — Call stage: ${stage}${battlecard}
${points.length > 0 ? `\nTOP TALKING POINTS\n${points.slice(0, 3).map((p, i) => `${i + 1}. ${p}`).join('\n')}` : ''}

${prompt}

Return ONLY a JSON array with 1-2 coaching cards. Each must have:
- type: "Warning" | "Response" | "Battlecard" | "Question" | "Tip"
- tone: "warning" | "response" | "battlecard" | "question" | "tip"
- trigger: max 6 words describing the moment
- text: the coaching instruction — 1 sentence max, second person, present tense, no fluff

Example: [{"type":"Response","tone":"response","trigger":"price objection","text":"Anchor on ROI before discussing price — ask what the cost of inaction is."}]`;
}

function buildBattleBriefPrompt(d: PromptData) {
  const { prospectName, prospectCompany, prospectRole, prospectContext, objective, talkingPoints, objections } = d as {
    prospectName?: string; prospectCompany?: string; prospectRole?: string; prospectContext?: string;
    objective?: string; talkingPoints?: string[]; objections?: Array<{ question: string }>;
  };
  const pts = talkingPoints ?? [];
  const objs = objections ?? [];
  return `You are preparing a salesperson for a call.

PROSPECT: ${prospectName ?? 'Unknown'}, ${prospectRole ?? 'Unknown'}, ${prospectCompany ?? 'Unknown'}
CONTEXT: ${prospectContext ?? 'None provided'}
CALL OBJECTIVE: ${objective ?? 'Not specified'}
TALKING POINTS: ${pts.map((p, i) => `${i + 1}. ${p}`).join(' | ') || 'None'}
KNOWN OBJECTIONS: ${objs.map((o) => o.question).join(' | ') || 'None'}

Give:

OPENING HOOK: A single compelling sentence to open the call.

KEY INTEL: 2-3 sentences on what likely matters most to this prospect based on their role and company.

POWER MOVES: 3 specific tactics or phrases — each 1 sentence, sharp and practical.

LANDMINES: 2-3 things to avoid — each 1 sentence.

CLOSE TARGET: The exact ask to make at the end of the call — 1 sentence.

Keep each line sharp. Brevity wins on a sales call.`;
}

function buildLiveCoachPrompt(d: PromptData) {
  const { recentTranscript, talkingPoints, objections, elapsedSeconds } = d as {
    recentTranscript?: Array<{ timestamp: string; speaker: string; text: string }>;
    talkingPoints?: string[]; objections?: Array<{ question: string }>; elapsedSeconds?: number;
  };
  const lines = (recentTranscript ?? []).map((e) => `[${e.timestamp}] ${e.speaker}: ${e.text}`).join('\n');
  const pts = (talkingPoints ?? []).slice(0, 4);
  const objs = (objections ?? []).slice(0, 4);
  const stage = elapsedSeconds == null ? 'unknown'
    : elapsedSeconds < 90 ? 'opening'
    : elapsedSeconds < 300 ? 'discovery'
    : elapsedSeconds < 540 ? 'pitch'
    : 'closing';

  return `You are a real-time sales coach.

ELAPSED: ${elapsedSeconds ?? 0}s — Stage: ${stage}

Recent conversation:
${lines || '(no transcript yet)'}

Talking points to reinforce: ${pts.join(' | ') || 'none'}
Objections to watch for: ${objs.map((o) => o.question).join(' | ') || 'none'}

Based on this, give 1-3 precise coaching instructions for what the rep should do next.

Rules:
- Each card text: 1 sentence max
- No explanation — direct instructions only
- Must be specific to the conversation
- Only surface cards genuinely relevant to what was just said

Return ONLY a valid JSON array. Each object must have:
- type: "Tip" | "Response" | "Question" | "Warning" | "Battlecard"
- tone: "tip" | "response" | "question" | "warning" | "battlecard"
- trigger: max 6 words describing what triggered this
- text: the coaching instruction (1 sentence, direct second-person)

Example: [{"type":"Question","tone":"question","trigger":"prospect mentioned budget","text":"Ask: What does success look like for this investment in Q3?"}]`;
}

function buildDebriefPrompt(d: PromptData) {
  const { transcript, coachCards, score, sentiment, talkRatio, duration, objective, objections } = d as {
    transcript?: Array<{ timestamp: string; speaker: string; text: string }>;
    coachCards?: Array<{ type: string; text: string }>; score?: number; sentiment?: number;
    talkRatio?: number; duration?: number; objective?: string;
    objections?: Array<{ question: string }>;
  };
  const lines = (transcript ?? []).map((e) => `[${e.timestamp}] ${e.speaker}: ${e.text}`).join('\n');
  const mins = Math.floor((duration ?? 0) / 60);
  const secs = (duration ?? 0) % 60;
  const cards = (coachCards ?? []).slice(0, 8);
  const objs = (objections ?? []).slice(0, 5);
  return `You are a senior sales coach reviewing a completed call.

CALL OBJECTIVE: ${objective ?? 'Not specified'}
DURATION: ${mins}m ${secs}s
LIVE SCORE: ${score ?? 0}/100
SENTIMENT: ${(sentiment ?? 0) > 0 ? '+' : ''}${sentiment ?? 0}
TALK RATIO: ${Math.round((talkRatio ?? 0.5) * 100)}% rep / ${Math.round((1 - (talkRatio ?? 0.5)) * 100)}% prospect

FULL TRANSCRIPT
${lines || '(no transcript recorded)'}

COACHING CARDS TRIGGERED (${cards.length} total)
${cards.map((c) => `- [${c.type}] ${c.text}`).join('\n')}

KNOWN OBJECTIONS
${objs.map((o) => `- ${o.question}`).join('\n')}

Give:
- 1 strength (1 sentence)
- 1 mistake (1 sentence)
- 1 improvement action (1 sentence)

Return ONLY a valid JSON object with exactly these fields:
- score: integer 0-100
- wins: array of 2-4 strings — specific things the rep did well (1 sentence each)
- misses: array of 2-4 strings — specific missed opportunities or mistakes (1 sentence each)
- followUpEmail: a complete, ready-to-send follow-up email as a single string (Subject on first line, blank line, then body)`;
}

// ── GET /api/credits ──────────────────────────────────────────────────────────
router.get('/credits', async (req: Request, res: Response) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== 'string') {
    return void res.status(400).json({ error: 'Missing userId' });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from('credits').select('*').eq('user_id', userId).maybeSingle();
    return void res.json(data ?? {
      monthly_briefs_used: 0, monthly_intervals_used: 0, monthly_debriefs_used: 0,
      pack_briefs: 0, pack_intervals: 0, pack_debriefs: 0,
    });
  } catch (err: unknown) {
    req.log.error(err, 'credits fetch failed');
    return void res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /api/deepgram-token ──────────────────────────────────────────────────
router.post('/deepgram-token', async (req: Request, res: Response) => {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return void res.status(503).json({ error: 'Deepgram not configured', fallback: 'webspeech' });
  }
  try {
    const projectsRes = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { Authorization: `Token ${apiKey}` },
    });
    if (!projectsRes.ok) {
      throw new Error(`Deepgram projects API error ${projectsRes.status}`);
    }
    const { projects } = await projectsRes.json() as { projects: Array<{ project_id: string }> };
    if (!projects?.length) throw new Error('No Deepgram projects found');

    const keyRes = await fetch(`https://api.deepgram.com/v1/projects/${projects[0].project_id}/keys`, {
      method: 'POST',
      headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: `saynow-temp-${Date.now()}`, scopes: ['usage:write'], time_to_live_in_seconds: 600 }),
    });
    if (!keyRes.ok) throw new Error(`Deepgram key creation failed ${keyRes.status}`);
    const { key } = await keyRes.json() as { key: string };
    return void res.json({ key });
  } catch (err: unknown) {
    req.log.error(err, 'deepgram-token error');
    return void res.status(500).json({ error: (err as Error).message, fallback: 'webspeech' });
  }
});

// ── POST /api/twilio-token ────────────────────────────────────────────────────
router.post('/twilio-token', async (req: Request, res: Response) => {
  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_TWIML_APP_SID } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY || !TWILIO_API_SECRET) {
    return void res.status(503).json({ error: 'Twilio not configured' });
  }
  const { userId, identity } = req.body as { userId?: string; identity?: string };
  const tokenIdentity = identity || userId || `user_${Date.now()}`;
  try {
    // Dynamic import to handle CJS interop
    const twilioModule = await import('twilio');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tw = (twilioModule as any).default ?? twilioModule;
    const AccessToken = tw.jwt?.AccessToken;
    const VoiceGrant = AccessToken?.VoiceGrant;
    if (!AccessToken || !VoiceGrant) throw new Error('Twilio JWT not available — check twilio package version');

    const token = new AccessToken(TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, {
      identity: tokenIdentity, ttl: 3600,
    });
    const voiceGrant = new VoiceGrant({ outgoingApplicationSid: TWILIO_TWIML_APP_SID || undefined, incomingAllow: false });
    token.addGrant(voiceGrant);
    return void res.json({ token: token.toJwt(), identity: tokenIdentity });
  } catch (err: unknown) {
    req.log.error(err, 'twilio-token error');
    return void res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /api/create-checkout-session ────────────────────────────────────────
const PACK_PRICE_IDS = new Set([
  'price_1TTT5IQkADh5vQgnZtRjqwt3',
  'price_1TTT6NQkADh5vQgnj6bFuBGo',
  'price_1TTT80QkADh5vQgnHJHrBp5K',
]);

router.post('/create-checkout-session', async (req: Request, res: Response) => {
  const { priceId, userId, userEmail } = req.body as { priceId?: string; userId?: string; userEmail?: string };
  if (!priceId || !PACK_PRICE_IDS.has(priceId)) {
    return void res.status(400).json({ error: 'Invalid or missing priceId' });
  }
  if (!userId) return void res.status(400).json({ error: 'Missing userId' });
  try {
    const stripe = getStripe();
    const origin = (req.headers.origin as string | undefined) ?? (req.headers.referer as string | undefined) ?? 'https://saynow-pro.replit.app';
    const baseUrl = origin.replace(/\/$/, '');
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      ...(userEmail ? { customer_email: userEmail } : {}),
      metadata: { type: 'credit_pack', userId, priceId },
      success_url: `${baseUrl}/?credits_added=true`,
      cancel_url: `${baseUrl}/`,
    });
    return void res.json({ url: session.url });
  } catch (err: unknown) {
    req.log.error(err, 'create-checkout-session error');
    return void res.status(502).json({ error: (err as Error).message });
  }
});

// ── POST /api/claude ──────────────────────────────────────────────────────────
router.post('/claude', async (req: Request, res: Response) => {
  const { type, userId, ...data } = req.body as { type?: string; userId?: string } & PromptData;

  if (!type) return void res.status(400).json({ error: 'Missing required field: type' });
  const validTypes = ['battle-brief', 'live-coach', 'debrief', 'event-coach'];
  if (!validTypes.includes(type)) return void res.status(400).json({ error: `Unknown type: ${type}` });
  if (!process.env.ANTHROPIC_API_KEY) return void res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const anthropic = getAnthropic();

  // event-coach is free — no credit deduction
  if (type === 'event-coach') {
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildEventCoachPrompt(data) }],
      });
      const raw = (message.content[0] as { text?: string }).text ?? '';
      const m = raw.match(/\[[\s\S]*\]/);
      if (!m) return void res.json({ cards: [] });
      const cards = Array.isArray(JSON.parse(m[0])) ? JSON.parse(m[0]) : [];
      return void res.json({ cards });
    } catch (err: unknown) {
      req.log.error(err, 'event-coach error');
      return void res.status(502).json({ error: (err as Error).message });
    }
  }

  // Credit-gated types
  const creditType: CreditType = type === 'battle-brief' ? 'brief' : type === 'live-coach' ? 'interval' : 'debrief';
  if (userId && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.VITE_SUPABASE_URL) {
    try {
      const result = await checkAndDecrementCredits(userId, creditType);
      if (result.exhausted) {
        return void res.status(402).json({
          error: 'credits_exhausted', creditType,
          message: `You have used all your ${creditType} credits this month. Purchase a credit pack to continue.`,
        });
      }
    } catch (err: unknown) {
      req.log.warn(err, 'Credit check failed — allowing request through');
    }
  }

  let prompt: string;
  try {
    if (type === 'battle-brief') prompt = buildBattleBriefPrompt(data);
    else if (type === 'live-coach') prompt = buildLiveCoachPrompt(data);
    else prompt = buildDebriefPrompt(data);
  } catch (err: unknown) {
    return void res.status(400).json({ error: `Invalid request data: ${(err as Error).message}` });
  }

  const maxTokens = type === 'battle-brief' ? 600 : type === 'live-coach' ? 400 : 1200;
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = (message.content[0] as { text?: string }).text ?? '';

    if (type === 'battle-brief') return void res.json({ brief: raw });

    const m = raw.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (!m) return void res.status(500).json({ error: 'Model returned no valid JSON', raw });
    const parsed = JSON.parse(m[0]);
    if (type === 'live-coach') return void res.json({ cards: Array.isArray(parsed) ? parsed : [parsed] });
    return void res.json(parsed);
  } catch (err: unknown) {
    req.log.error(err, 'Anthropic API error');
    return void res.status(502).json({ error: (err as Error).message });
  }
});

// ── Stripe webhook handler (exported for raw-body mounting in app.ts) ─────────
const CREDIT_PACK_GRANTS: Record<string, { pack_briefs: number; pack_intervals: number; pack_debriefs: number }> = {
  'price_1TTT5IQkADh5vQgnZtRjqwt3': { pack_briefs: 5,  pack_intervals: 100, pack_debriefs: 5  },
  'price_1TTT6NQkADh5vQgnj6bFuBGo': { pack_briefs: 15, pack_intervals: 300, pack_debriefs: 15 },
  'price_1TTT80QkADh5vQgnHJHrBp5K': { pack_briefs: 40, pack_intervals: 800, pack_debriefs: 40 },
};

export async function stripeWebhookHandler(req: Request, res: Response, _next: NextFunction) {
  const sig = req.headers['stripe-signature'];
  if (!sig) return void res.status(400).json({ error: 'Missing stripe-signature header' });

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, process.env.STRIPE_WEBHOOK_SECRET ?? '');
  } catch (err: unknown) {
    req.log.error(err, 'Stripe webhook signature verification failed');
    return void res.status(400).json({ error: `Webhook Error: ${(err as Error).message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      const supabase = getSupabaseAdmin();
      if (session.metadata?.type === 'credit_pack') {
        const { userId, priceId } = session.metadata;
        if (!userId || !priceId) return void res.status(400).json({ error: 'Missing credit pack metadata' });
        const grant = CREDIT_PACK_GRANTS[priceId];
        if (!grant) return void res.status(400).json({ error: `Unknown priceId: ${priceId}` });

        const { data: existing } = await supabase.from('credits').select('pack_briefs,pack_intervals,pack_debriefs').eq('user_id', userId).maybeSingle();
        await supabase.from('credits').upsert({
          user_id: userId,
          pack_briefs: ((existing?.pack_briefs as number) || 0) + grant.pack_briefs,
          pack_intervals: ((existing?.pack_intervals as number) || 0) + grant.pack_intervals,
          pack_debriefs: ((existing?.pack_debriefs as number) || 0) + grant.pack_debriefs,
          reset_date: existing ? undefined : firstDayOfMonth(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        req.log.info({ userId, priceId }, 'Credit pack applied');
      } else {
        const email = session.customer_details?.email ?? session.customer_email;
        if (email) {
          const { data: usersData } = await supabase.auth.admin.listUsers();
          const user = (usersData?.users ?? []).find((u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase());
          if (user) {
            await supabase.from('subscriptions').upsert({
              user_id: user.id, email,
              stripe_customer_id: session.customer, stripe_session_id: session.id,
              status: 'active', updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
            req.log.info({ userId: user.id }, 'Subscription activated');
          }
        }
      }
      return void res.json({ received: true });
    } catch (err: unknown) {
      req.log.error(err, 'Webhook processing failed');
      return void res.status(500).json({ error: 'Failed to process event' });
    }
  }
  return void res.json({ received: true });
}

// ── Storage: ensure avatars bucket exists ─────────────────────────────────────
router.post('/storage/init-avatars', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = (buckets ?? []).some((b: { name: string }) => b.name === 'avatars');
    if (!exists) {
      const { error } = await supabase.storage.createBucket('avatars', { public: true, fileSizeLimit: 5242880 });
      if (error && !error.message.includes('already exists')) throw error;
    }
    return void res.json({ ok: true });
  } catch (err: unknown) {
    req.log.error(err, 'Failed to init avatars bucket');
    return void res.status(500).json({ error: 'Failed to create storage bucket' });
  }
});

export default router;
