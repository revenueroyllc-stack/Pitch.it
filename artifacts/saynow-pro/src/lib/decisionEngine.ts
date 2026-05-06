export type CallStage = 'opening' | 'discovery' | 'pitch' | 'closing';
export type DecisionType = 'WARNING' | 'TIP' | 'ESCALATE_AI' | 'NONE';
export type Urgency = 'critical' | 'warning' | 'tip';

export interface CallSignals {
  triggerType: string;
  talkRatio: number;
  prospectSentiment: number;
  elapsedSeconds: number;
  utterance?: string;
}

export interface Decision {
  type: DecisionType;
  message?: string;
  urgency?: Urgency;
  reason: string;
}

export function inferStage(elapsedSeconds: number): CallStage {
  if (elapsedSeconds < 90) return 'opening';
  if (elapsedSeconds < 300) return 'discovery';
  if (elapsedSeconds < 540) return 'pitch';
  return 'closing';
}

/**
 * The Decision Engine — the brain before Claude.
 *
 * Rules:
 *  - Objections and competitors always escalate to Claude (complex, high-value).
 *  - Very low prospect sentiment escalates to Claude (critical recovery needed).
 *  - High prospect sentiment late in the call escalates to Claude (close signal).
 *  - Silence, talk-ratio, filler spikes, and no-question are handled instantly
 *    without burning a Claude call — instant tip/warning only.
 *  - NONE means nothing actionable — skip both.
 */
export function decideAction(signals: CallSignals): Decision {
  const { triggerType, talkRatio, prospectSentiment, elapsedSeconds } = signals;

  // ── ALWAYS escalate to Claude ───────────────────────────────────────────────
  if (triggerType === 'objection') {
    return { type: 'ESCALATE_AI', urgency: 'critical', reason: 'objection-handling' };
  }
  if (triggerType === 'competitor') {
    return { type: 'ESCALATE_AI', urgency: 'critical', reason: 'competitor-battlecard' };
  }

  // ── Prospect sentiment signals ──────────────────────────────────────────────
  if (prospectSentiment < 28) {
    return { type: 'ESCALATE_AI', urgency: 'critical', reason: 'prospect-disengaged' };
  }
  if (prospectSentiment > 78 && elapsedSeconds > 180) {
    return { type: 'ESCALATE_AI', urgency: 'tip', reason: 'close-opportunity' };
  }

  // ── Instant coaching — no Claude needed ────────────────────────────────────
  if (triggerType === 'silence') {
    return {
      type: 'WARNING',
      message: 'Dead air — ask a question now.',
      urgency: 'warning',
      reason: 'silence',
    };
  }
  if (triggerType === 'talk-ratio-warning' || talkRatio > 0.65) {
    return {
      type: 'TIP',
      message: "You're talking too much — stop and ask a question.",
      urgency: 'warning',
      reason: 'talk-ratio',
    };
  }
  if (triggerType === 'filler-spike') {
    return {
      type: 'WARNING',
      message: 'Slow down — too many filler words. Pause and breathe.',
      urgency: 'warning',
      reason: 'filler-spike',
    };
  }
  if (triggerType === 'no-question') {
    return {
      type: 'TIP',
      message: "You haven't asked a discovery question. Invite them to speak.",
      urgency: 'tip',
      reason: 'no-question',
    };
  }

  return { type: 'NONE', reason: 'no-actionable-signal' };
}
