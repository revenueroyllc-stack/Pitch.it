export interface CoachCard {
  type: 'Tip' | 'Response' | 'Question' | 'Warning' | 'Battlecard';
  tone: 'tip' | 'response' | 'question' | 'warning' | 'battlecard';
  trigger: string;
  text: string;
  quote?: string;
  timestamp: string;
  competitor?: string;
}

export interface Objection {
  question: string;
  answer: string;
  category: string;
}

export interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: string;
}

export interface BattlecardData {
  strengths: string[];
  weaknesses: string[];
  ourResponse: string;
}

function normalizeCard(card: Partial<CoachCard>, fallbackTimestamp: string): CoachCard {
  return {
    type: (card?.type as CoachCard['type']) || 'Tip',
    tone: (card?.tone as CoachCard['tone']) || 'tip',
    trigger: card?.trigger || 'coach suggestion',
    text: card?.text || '',
    quote: card?.quote || '',
    timestamp: card?.timestamp || fallbackTimestamp,
    competitor: card?.competitor,
  };
}

export const COMPETITOR_BATTLECARDS: Record<string, BattlecardData> = {
  salesforce: {
    strengths: ['Large ecosystem', 'Brand recognition', 'Enterprise penetration'],
    weaknesses: ['Complex setup', 'High cost', 'Steep learning curve'],
    ourResponse:
      'We deploy in days, not months, with 80% less admin overhead and a fraction of the total cost.',
  },
  hubspot: {
    strengths: ['Free tier', 'Marketing integration', 'Easy onboarding'],
    weaknesses: ['Limited customization at scale', 'Data silos', 'Costly tier upgrades'],
    ourResponse:
      'Unlike HubSpot, we give you full customization without the upgrade trap — one price, full power from day one.',
  },
  gong: {
    strengths: ['Call recording', 'Conversation intelligence', 'Deal analytics'],
    weaknesses: ['Post-call only', 'No real-time coaching', 'Expensive per seat'],
    ourResponse:
      'Gong shows you what happened after the call. We coach you while it is happening — when it actually matters.',
  },
  chorus: {
    strengths: ['Transcription quality', 'CI features', 'Zoom integration'],
    weaknesses: ['Reactive not proactive', 'No live coaching', 'Requires recording consent'],
    ourResponse:
      'Chorus records the call. SayNow Pro wins it. Real-time coaching changes outcomes — recordings change nothing.',
  },
  zoom: {
    strengths: ['Ubiquity', 'Video quality', 'Free tier'],
    weaknesses: ['Not a sales tool', 'No coaching layer', 'No sales intelligence'],
    ourResponse:
      'Zoom is a camera. SayNow Pro is the intelligence layer that makes every call count.',
  },
  outreach: {
    strengths: ['Sequencing', 'Workflow automation', 'CRM integration'],
    weaknesses: ['No real-time coaching', 'Focused on outbound sequences', 'Complex setup'],
    ourResponse:
      'Outreach automates sequences. SayNow Pro wins the live conversation — the moment that actually closes the deal.',
  },
};

export function detectCompetitor(text: string): string | null {
  const lower = text.toLowerCase();
  const competitors = Object.keys(COMPETITOR_BATTLECARDS);
  return competitors.find((c) => lower.includes(c)) ?? null;
}

export function analyzeSentiment(entries: TranscriptEntry[]): number {
  if (entries.length === 0) return 50;
  const recent = entries
    .slice(-6)
    .map((e) => e.text.toLowerCase())
    .join(' ');

  const positivePatterns =
    /\b(great|sounds good|interested|love|perfect|absolutely|definitely|yes|excited|impressive|makes sense|right|exactly|totally|of course|please|forward|appreciate|helpful|valuable|looking forward|when can we|let us|let's|happy to)\b/g;
  const negativePatterns =
    /\b(no|not|never|expensive|too much|dont|won't|can't|budget|another vendor|already have|later|next quarter|not now|concerns|worried|not sure|pass|maybe|complicated|difficult|issue|problem|unfortunately|busy|overloaded|not ready|not a priority)\b/g;

  const positiveSignals = (recent.match(positivePatterns) || []).length;
  const negativeSignals = (recent.match(negativePatterns) || []).length;

  const score = Math.min(95, Math.max(15, 50 + positiveSignals * 8 - negativeSignals * 7));
  return score;
}

export function calculateTalkRatio(entries: TranscriptEntry[]): number {
  if (entries.length === 0) return 0;
  const totalChars = entries.reduce((sum, e) => sum + e.text.length, 0);
  const repChars = entries
    .filter((e) => e.speaker === 'You')
    .reduce((sum, e) => sum + e.text.length, 0);
  return totalChars > 0 ? Math.round((repChars / totalChars) * 100) : 50;
}

export function calculateLiveScore(params: {
  talkRatio: number;
  sentiment: number;
  questionCount: number;
  elapsedSeconds: number;
}): number {
  const { talkRatio, sentiment, questionCount, elapsedSeconds } = params;

  const talkScore = talkRatio <= 50 ? 25 : Math.max(0, 25 - (talkRatio - 50) * 0.8);
  const sentimentScore = (sentiment / 100) * 30;
  const expectedQuestions = Math.max(1, Math.floor(elapsedSeconds / 90));
  const questionScore = Math.min(25, (questionCount / expectedQuestions) * 25);
  const base = 20;

  return Math.min(99, Math.round(base + talkScore + sentimentScore + questionScore));
}

export function formatTime(totalSeconds: number): string {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const seconds = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function dedupeCards(cards: CoachCard[]): CoachCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = `${card.type}-${card.trigger}-${card.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildHeuristicCoachCards(params: {
  latestUtterance: string;
  objections: Objection[];
  talkingPoints: string[];
  elapsedSeconds: number;
  timestamp: string;
}): CoachCard[] {
  const { latestUtterance, objections, talkingPoints, elapsedSeconds, timestamp } = params;
  const text = latestUtterance.toLowerCase();
  const cards: CoachCard[] = [];

  if (!text) return cards;

  const competitor = detectCompetitor(text);
  if (competitor) {
    const battlecard = COMPETITOR_BATTLECARDS[competitor];
    cards.push(
      normalizeCard(
        {
          type: 'Battlecard',
          tone: 'battlecard',
          trigger: `${competitor.charAt(0).toUpperCase() + competitor.slice(1)} mentioned`,
          text: battlecard.ourResponse,
          quote: `Their key weakness: ${battlecard.weaknesses[0]}`,
          competitor,
        },
        timestamp,
      ),
    );
  }

  if (/(price|pricing|budget|cost|expensive|investment|roi|afford)/.test(text)) {
    cards.push(
      normalizeCard(
        {
          type: 'Response',
          tone: 'response',
          trigger: 'pricing concern detected',
          text: 'Anchor on business value and measurable ROI before discussing price. Lead with outcomes.',
          quote: 'If this saved your team several hours a week, how would that change the math?',
        },
        timestamp,
      ),
    );
  }

  if (/(vendor|provider|already use|contract|current tool|incumbent|system)/.test(text)) {
    const match = objections.find((item) =>
      /vendor|competition|provider/i.test(`${item.category} ${item.question}`),
    );
    cards.push(
      normalizeCard(
        {
          type: 'Response',
          tone: 'response',
          trigger: 'incumbent solution detected',
          text:
            match?.answer ||
            'Create contrast by asking what the current tool still fails to solve.',
          quote:
            match?.question ||
            'If you could improve one piece of the current setup, what would it be?',
        },
        timestamp,
      ),
    );
  }

  if (/(later|next quarter|not now|follow up|circle back|timing|bad time|busy)/.test(text)) {
    cards.push(
      normalizeCard(
        {
          type: 'Question',
          tone: 'question',
          trigger: 'timing hesitation detected',
          text: 'Clarify the real blocker behind timing so you can define a concrete next step.',
          quote: 'What needs to happen internally before this becomes a priority?',
        },
        timestamp,
      ),
    );
  }

  if (elapsedSeconds > 60 && !text.includes('?')) {
    cards.push(
      normalizeCard(
        {
          type: 'Warning',
          tone: 'warning',
          trigger: 'monologue detected',
          text: 'You have been speaking without a question. Pause and invite the prospect to share their perspective.',
        },
        timestamp,
      ),
    );
  }

  if (cards.length === 0 && talkingPoints.length > 0) {
    cards.push(
      normalizeCard(
        {
          type: 'Tip',
          tone: 'tip',
          trigger: 'next best action',
          text: `Reconnect the conversation to your key point: ${talkingPoints[0]}`,
        },
        timestamp,
      ),
    );
  }

  return cards.slice(0, 3);
}

export function generateDebriefEmail(params: {
  objective: string;
  score: number;
  sentiment: number;
  talkRatio: number;
  transcript: TranscriptEntry[];
  duration: number;
}): string {
  const { objective, score, sentiment, talkRatio, duration } = params;
  const mins = Math.floor(duration / 60);
  const subjectLine =
    score >= 75 ? 'Following up — next steps from our conversation' : 'Following up from our call';

  const engagementLine =
    sentiment >= 65
      ? "It was clear there's a real fit here, and I appreciated the candid conversation."
      : 'I appreciate you sharing your honest perspective — it helps me understand what actually matters to your team.';

  const nextStepLine = objective.toLowerCase().includes('demo')
    ? 'getting you in front of a live demo tailored specifically to your workflow'
    : `a focused follow-up around: ${objective}`;

  const listenLine =
    talkRatio > 55
      ? "I want to make sure our next conversation is more focused on your specific situation — I'd love to hear more about your current process."
      : "The questions you raised were exactly the right ones — I'll come prepared with specific answers.";

  return `Subject: ${subjectLine}

Hi there,

Thank you for the time today — ${mins > 0 ? `${mins} minutes` : 'our conversation'} went fast.

${engagementLine}

Based on what you shared, the most relevant next step is ${nextStepLine}.

${listenLine}

Can we find 20 minutes this week to pick up where we left off?

Best,
[Your name]`;
}

export function generateDebriefAnalysis(params: {
  transcript: TranscriptEntry[];
  coachCards: CoachCard[];
  score: number;
  sentiment: number;
  talkRatio: number;
  duration: number;
  objections: Objection[];
}): {
  strengths: string[];
  improvements: string[];
  disengagementMoment: string | null;
  keyMoments: { time: string; event: string; type: 'start' | 'positive' | 'warning' | 'end' }[];
} {
  const { transcript, coachCards, score, sentiment, talkRatio, duration } = params;
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (talkRatio < 50) {
    strengths.push('Excellent talk ratio — you listened more than you spoke');
  } else if (talkRatio > 60) {
    improvements.push(
      `Talk ratio at ${talkRatio}% — aim to speak less than 50% of the time. Listening is closing.`,
    );
  }

  const questionCount = transcript.filter((e) => e.text.includes('?')).length;
  if (questionCount >= 3) {
    strengths.push(`Strong discovery — asked ${questionCount} questions to understand the prospect`);
  } else if (questionCount < 2) {
    improvements.push('Ask more discovery questions — 5+ questions per call is the benchmark for top performers');
  }

  if (sentiment >= 70) {
    strengths.push('Strong positive sentiment maintained throughout — prospect was engaged');
  } else if (sentiment >= 50) {
    strengths.push('Neutral to positive sentiment — prospect stayed engaged');
  } else {
    improvements.push(
      'Prospect sentiment dipped — review where the energy shifted and what triggered it',
    );
  }

  if (score >= 85) {
    strengths.push(`Outstanding call performance — top 10% score of ${score}/100`);
  } else if (score >= 70) {
    strengths.push(`Solid overall performance — score of ${score}/100`);
  } else {
    improvements.push(
      `Call performance score: ${score}/100 — focus on talk ratio and discovery questions`,
    );
  }

  const warningCards = coachCards.filter((c) => c.tone === 'warning');
  if (warningCards.length === 0 && duration > 120) {
    strengths.push('No monologue moments — consistent two-way dialogue throughout');
  } else if (warningCards.length > 0) {
    improvements.push(
      `${warningCards.length} monologue moment(s) detected — watch for extended speaking without checking in`,
    );
  }

  const battlecardCards = coachCards.filter((c) => c.tone === 'battlecard');
  if (battlecardCards.length > 0) {
    const competitors = [...new Set(battlecardCards.map((c) => c.competitor).filter(Boolean))];
    improvements.push(
      `Competitor(s) mentioned: ${competitors.join(', ')} — confirm you delivered the battlecard response`,
    );
  }

  const negativeEntries = transcript.filter((e) =>
    /(not sure|budget|maybe|later|think about|need to check|get back|not ready|not a priority)/.test(
      e.text.toLowerCase(),
    ),
  );
  const disengagementMoment = negativeEntries.length > 0 ? negativeEntries[0].timestamp : null;

  const keyMoments: { time: string; event: string; type: 'start' | 'positive' | 'warning' | 'end' }[] = [];
  if (transcript.length > 0) {
    keyMoments.push({ time: transcript[0].timestamp, event: 'Call opened', type: 'start' });
  }
  if (disengagementMoment) {
    keyMoments.push({
      time: disengagementMoment,
      event: 'Prospect hesitation detected',
      type: 'warning',
    });
  }
  const positiveEntry = transcript.find((e) =>
    /(great|sounds good|love|perfect|absolutely|interested)/.test(e.text.toLowerCase()),
  );
  if (positiveEntry) {
    keyMoments.push({ time: positiveEntry.timestamp, event: 'Strong positive signal', type: 'positive' });
  }
  if (transcript.length > 0) {
    keyMoments.push({
      time: transcript[transcript.length - 1].timestamp,
      event: 'Call concluded',
      type: 'end',
    });
  }

  return { strengths, improvements, disengagementMoment, keyMoments };
}

export const initialObjections: Objection[] = [
  {
    question: 'We already have a vendor.',
    answer:
      'That makes sense. If you could improve one part of your current workflow, what would it be?',
    category: 'Competition',
  },
  {
    question: 'Your pricing seems high.',
    answer:
      'Totally fair. Teams usually justify the cost by reducing manual follow-up time and improving close rate. What does your current process cost in lost deals?',
    category: 'Pricing',
  },
  {
    question: 'The timing is not right.',
    answer:
      "I hear you. What would need to change internally for this to become a priority? Let's plan for that moment.",
    category: 'Timing',
  },
  {
    question: 'I need to run this by my team.',
    answer:
      'Absolutely. Would it help if I prepared a one-pager that frames the value specifically for your stakeholders?',
    category: 'Authority',
  },
];

export const initialTalkingPoints: string[] = [
  'Open with their current process and pain points.',
  'Position the pilot as low-risk and easy to measure.',
  'Ask about their definition of a successful outcome.',
  'Tie the solution to a specific business metric they care about.',
];

export const initialCoachCards: CoachCard[] = [
  {
    type: 'Tip',
    tone: 'tip',
    trigger: 'opening guidance',
    text: 'Open with their current workflow and one measurable outcome you can improve.',
    quote: 'What part of your current process is costing the team the most time?',
    timestamp: '00:00',
  },
];
