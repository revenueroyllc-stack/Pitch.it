import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-4-20250514';

const MONTHLY_LIMITS = { brief: 10, interval: 300, debrief: 10 };

// Event-triggered coaching: no credits consumed — these are real-time urgency cards
function buildEventCoachPrompt({ triggerType, utterance, competitor, elapsedSeconds, talkingPoints }) {
  const triggerLine = {
    objection: `TRIGGER: Objection detected — prospect said: "${utterance}"`,
    silence: 'TRIGGER: 5+ seconds of silence — prospect may be disengaged, thinking, or hesitating',
    competitor: `TRIGGER: Competitor mentioned ("${competitor}") — prospect said: "${utterance}"`,
    'no-question': 'TRIGGER: Rep has not asked a discovery question in over 4 minutes',
    'talk-ratio-warning': 'TRIGGER: Rep is speaking over 60% of the time — dominating the conversation',
  }[triggerType] || `TRIGGER: ${triggerType}`;

  const battlecardHint = competitor
    ? `\nBATTLECARD CONTEXT: When "${competitor}" is mentioned, acknowledge it briefly then redirect to your differentiator.`
    : '';

  return `You are a real-time sales coach. An urgent coaching moment just occurred mid-call. Respond immediately.

ELAPSED TIME: ${elapsedSeconds || 0}s
${triggerLine}${battlecardHint}

TOP TALKING POINTS
${(talkingPoints || []).slice(0, 4).map((p, i) => `${i + 1}. ${p}`).join('\n') || 'None provided'}

Return ONLY a JSON array with 1-2 urgent, specific coaching cards. Each must have:
- type: one of "Warning" | "Response" | "Battlecard" | "Question" | "Tip"
- tone: one of "warning" | "response" | "battlecard" | "question" | "tip"
- trigger: short phrase max 6 words describing the moment
- text: direct actionable coaching in 1-2 sentences, second person, present tense

This is real-time — be terse, sharp, and immediately useful. No platitudes.`;
}

const CREDIT_COLS = {
  brief:    { monthly: 'monthly_briefs_used',    pack: 'pack_briefs' },
  interval: { monthly: 'monthly_intervals_used', pack: 'pack_intervals' },
  debrief:  { monthly: 'monthly_debriefs_used',  pack: 'pack_debriefs' },
};

function getAdminClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

async function checkAndDecrementCredits(userId, creditType) {
  const supabase = getAdminClient();
  const cols = CREDIT_COLS[creditType];
  const limit = MONTHLY_LIMITS[creditType];
  const resetDay = firstDayOfMonth();

  // Get or create credits row
  let { data: credits, error } = await supabase
    .from('credits')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  if (!credits) {
    const { data: created, error: createErr } = await supabase
      .from('credits')
      .insert({ user_id: userId, reset_date: resetDay })
      .select()
      .single();
    if (createErr) throw createErr;
    credits = created;
  }

  // Monthly reset if needed
  if (credits.reset_date < resetDay) {
    const { data: reset, error: resetErr } = await supabase
      .from('credits')
      .update({
        monthly_briefs_used: 0,
        monthly_intervals_used: 0,
        monthly_debriefs_used: 0,
        reset_date: resetDay,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();
    if (resetErr) throw resetErr;
    credits = reset;
  }

  const monthlyUsed = credits[cols.monthly] || 0;
  const packRemaining = credits[cols.pack] || 0;

  if (monthlyUsed >= limit) {
    if (packRemaining <= 0) {
      return { exhausted: true };
    }
    // Burn a pack credit
    const { error: packErr } = await supabase
      .from('credits')
      .update({ [cols.pack]: packRemaining - 1, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (packErr) throw packErr;
  } else {
    // Burn a monthly credit
    const { error: monthErr } = await supabase
      .from('credits')
      .update({ [cols.monthly]: monthlyUsed + 1, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (monthErr) throw monthErr;
  }

  return { exhausted: false };
}

function json(res, status, data) {
  res.status(status).json(data);
}

function buildBattleBriefPrompt({ prospectName, prospectCompany, prospectRole, prospectContext, objective, talkingPoints, objections }) {
  return `You are an elite sales strategist. Generate a concise, actionable pre-call battle brief for the following prospect.

PROSPECT
Name: ${prospectName || 'Unknown'}
Company: ${prospectCompany || 'Unknown'}
Role: ${prospectRole || 'Unknown'}
Context: ${prospectContext || 'None provided'}

CALL OBJECTIVE
${objective}

TOP TALKING POINTS
${(talkingPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n')}

KNOWN OBJECTIONS
${(objections || []).map((o) => `- ${o.question}`).join('\n')}

Respond in plain text (no markdown headers). Structure your response with these clearly labelled sections:

OPENING HOOK: A single compelling sentence to open the call.

KEY INTEL: 2-3 sentences on what likely matters most to this prospect given their role and company.

POWER MOVES: 3 specific tactics or phrases to build rapport and move toward the objective.

LANDMINES: 2-3 things to avoid saying or doing on this call.

CLOSE TARGET: The exact ask to make at the end of the call.

Keep each section tight — brevity wins on a sales call.`;
}

function buildLiveCoachPrompt({ recentTranscript, talkingPoints, objections, elapsedSeconds }) {
  const lines = (recentTranscript || [])
    .map((e) => `[${e.timestamp}] ${e.speaker}: ${e.text}`)
    .join('\n');

  return `You are a real-time sales coach listening to a live call. Analyze the last few seconds of transcript and return 1-3 coaching cards in JSON.

ELAPSED TIME: ${elapsedSeconds || 0}s

RECENT TRANSCRIPT (last ~8 seconds)
${lines || '(no transcript yet)'}

TALKING POINTS TO REINFORCE
${(talkingPoints || []).slice(0, 5).map((p, i) => `${i + 1}. ${p}`).join('\n')}

OBJECTIONS TO WATCH FOR
${(objections || []).slice(0, 5).map((o) => `- ${o.question}`).join('\n')}

Return ONLY a valid JSON array of 1-3 coaching card objects. Each object must have exactly these fields:
- type: one of "Tip" | "Response" | "Question" | "Warning" | "Battlecard"
- tone: one of "tip" | "response" | "question" | "warning" | "battlecard"
- trigger: a short phrase (max 6 words) describing what triggered this card
- text: the actionable coaching message (1-2 sentences, direct second-person)

Only surface cards that are genuinely relevant to what was just said. If nothing notable happened, return 1 general tip.

Example format:
[{"type":"Question","tone":"question","trigger":"prospect mentioned budget","text":"Ask: What does success look like for this investment in Q3?"}]`;
}

function buildDebriefPrompt({ transcript, coachCards, score, sentiment, talkRatio, duration, objective, objections }) {
  const lines = (transcript || [])
    .map((e) => `[${e.timestamp}] ${e.speaker}: ${e.text}`)
    .join('\n');

  const minutes = Math.floor((duration || 0) / 60);
  const seconds = (duration || 0) % 60;

  return `You are a senior sales coach reviewing a completed call. Analyze the transcript and return a structured JSON debrief.

CALL OBJECTIVE: ${objective}
DURATION: ${minutes}m ${seconds}s
LIVE SCORE: ${score}/100
SENTIMENT: ${sentiment > 0 ? '+' : ''}${sentiment} (-1 to +1 scale)
TALK RATIO (rep vs prospect): ${Math.round((talkRatio || 0.5) * 100)}% / ${Math.round((1 - (talkRatio || 0.5)) * 100)}%

FULL TRANSCRIPT
${lines || '(no transcript recorded)'}

COACHING CARDS TRIGGERED (${(coachCards || []).length} total)
${(coachCards || []).slice(0, 8).map((c) => `- [${c.type}] ${c.text}`).join('\n')}

KNOWN OBJECTIONS
${(objections || []).slice(0, 5).map((o) => `- ${o.question}`).join('\n')}

Return ONLY a valid JSON object with exactly these fields:
- score: integer 0-100 (your assessed call score based on transcript quality, not just the live score)
- wins: array of 2-4 strings — specific things the rep did well
- misses: array of 2-4 strings — specific missed opportunities or mistakes
- followUpEmail: a complete, ready-to-send follow-up email as a single string (include Subject line on first line, then blank line, then body). Keep it professional, concise, and specific to what was discussed.

Base everything on actual transcript content. If the transcript is sparse, note that in wins/misses.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const { type, userId, ...data } = req.body || {};

  if (!type) {
    return json(res, 400, { error: 'Missing required field: type' });
  }

  if (!['battle-brief', 'live-coach', 'debrief', 'event-coach'].includes(type)) {
    return json(res, 400, { error: `Unknown type: ${type}` });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return json(res, 500, { error: 'ANTHROPIC_API_KEY not configured' });
  }

  // Event-coach is free — it fires on real-time urgency triggers, not the interval counter
  if (type === 'event-coach') {
    let prompt;
    try { prompt = buildEventCoachPrompt(data); } catch (err) {
      return json(res, 400, { error: `Invalid event-coach data: ${err.message}` });
    }
    try {
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      });
      const raw = message.content[0]?.text ?? '';
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return json(res, 200, { cards: [] });
      const cards = Array.isArray(JSON.parse(jsonMatch[0])) ? JSON.parse(jsonMatch[0]) : [];
      return json(res, 200, { cards });
    } catch (err) {
      console.error('event-coach Anthropic error:', err.message);
      return json(res, 502, { error: err.message });
    }
  }

  // Credit check (skip if no Supabase configured or no userId)
  const creditType = type === 'battle-brief' ? 'brief' : type === 'live-coach' ? 'interval' : 'debrief';

  if (userId && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.VITE_SUPABASE_URL) {
    try {
      const result = await checkAndDecrementCredits(userId, creditType);
      if (result.exhausted) {
        return json(res, 402, {
          error: 'credits_exhausted',
          creditType,
          message: `You have used all your ${creditType} credits for this month. Purchase a credit pack to continue.`,
        });
      }
    } catch (creditErr) {
      // Log but don't block the request if credit system fails
      console.error('Credit check error:', creditErr.message);
    }
  }

  let prompt;
  try {
    if (type === 'battle-brief') prompt = buildBattleBriefPrompt(data);
    else if (type === 'live-coach') prompt = buildLiveCoachPrompt(data);
    else if (type === 'debrief') prompt = buildDebriefPrompt(data);
    else return json(res, 400, { error: `Unhandled type: ${type}` });
  } catch (err) {
    return json(res, 400, { error: `Invalid request data: ${err.message}` });
  }

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: type === 'battle-brief' ? 600 : type === 'live-coach' ? 400 : 1200,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0]?.text ?? '';

    if (type === 'battle-brief') {
      return json(res, 200, { brief: raw });
    }

    const jsonMatch = raw.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (!jsonMatch) {
      return json(res, 500, { error: 'Model returned no valid JSON', raw });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return json(res, 500, { error: 'Failed to parse model JSON', raw });
    }

    if (type === 'live-coach') {
      const cards = Array.isArray(parsed) ? parsed : [parsed];
      return json(res, 200, { cards });
    }

    return json(res, 200, parsed);
  } catch (err) {
    console.error('Anthropic API error:', err.message);
    return json(res, 502, { error: `Anthropic API error: ${err.message}` });
  }
}
