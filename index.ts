import { corsHeaders } from '../_shared/cors.ts';

interface CoachRequest {
  objective?: string;
  latestUtterance?: string;
  transcript?: Array<{ speaker?: string; text?: string; timestamp?: string }>;
  elapsedSeconds?: number;
  talkingPoints?: string[];
  objections?: Array<{ question?: string; answer?: string; category?: string }>;
}

function timestampFrom(seconds = 0) {
  const mins = String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0');
  const secs = String(Math.max(0, seconds) % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function buildCards(payload: CoachRequest) {
  const latest = (payload.latestUtterance || '').toLowerCase();
  const timestamp = timestampFrom(payload.elapsedSeconds || 0);
  const cards: Array<Record<string, string>> = [];

  if (!latest) {
    return [{
      type: 'Tip',
      tone: 'tip',
      trigger: 'session opened',
      text: 'Start with a discovery question tied to the prospect\'s workflow.',
      quote: 'What part of your current process creates the most friction?',
      timestamp
    }];
  }

  if (/(price|pricing|budget|cost|expensive)/.test(latest)) {
    cards.push({
      type: 'Tip',
      tone: 'tip',
      trigger: 'pricing concern detected',
      text: 'Lead with business value, measurable ROI, and saved time before discussing price.',
      quote: 'If this saved your team several hours per week, how would that change the economics?',
      timestamp
    });
  }

  if (/(vendor|provider|already use|contract|current tool)/.test(latest)) {
    const competitionObjection = (payload.objections || []).find(item => /vendor|competition|provider/i.test(`${item.category || ''} ${item.question || ''}`));
    cards.push({
      type: 'Response',
      tone: 'response',
      trigger: 'incumbent provider detected',
      text: competitionObjection?.answer || 'Create contrast by asking what the current tool still fails to solve.',
      quote: competitionObjection?.question || 'If you could improve one piece of the current setup, what would it be?',
      timestamp
    });
  }

  if (/(later|next quarter|not now|follow up|circle back)/.test(latest)) {
    cards.push({
      type: 'Question',
      tone: 'question',
      trigger: 'timing hesitation',
      text: 'Clarify the real blocker behind timing so you can define a next step.',
      quote: 'What needs to happen internally before this becomes a priority?',
      timestamp
    });
  }

  if (cards.length === 0) {
    cards.push({
      type: 'Tip',
      tone: 'tip',
      trigger: 'next best move',
      text: `Reconnect the conversation to the objective: ${payload.objective || 'move toward a clear next step'}.`,
      quote: (payload.talkingPoints || [])[0] || 'Bring the discussion back to measurable business impact.',
      timestamp
    });
  }

  return cards.slice(0, 3);
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const bearer = Deno.env.get('COACH_WEBHOOK_BEARER');
  const authHeader = request.headers.get('authorization');

  if (bearer && authHeader !== `Bearer ${bearer}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const payload = await request.json() as CoachRequest;
    const cards = buildCards(payload);

    return new Response(JSON.stringify({ cards }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
