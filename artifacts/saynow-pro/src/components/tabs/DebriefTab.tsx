import { useState, useEffect, useRef } from 'react';
import type { CoachCard, TranscriptEntry, Objection } from '@/lib/coach';
import { formatTime } from '@/lib/coach';
import { supabase } from '@/lib/supabase';

type CallOutcome = 'closed' | 'follow_up' | 'no_interest' | 'voicemail';

const OUTCOME_OPTIONS: { value: CallOutcome; label: string; icon: string; color: string }[] = [
  { value: 'closed', label: 'Closed', icon: '🏆', color: '#00c896' },
  { value: 'follow_up', label: 'Follow-up Scheduled', icon: '📅', color: '#4a90d9' },
  { value: 'no_interest', label: 'No Interest', icon: '❌', color: '#ff4757' },
  { value: 'voicemail', label: 'Left Voicemail', icon: '📱', color: '#c9960c' },
];

interface AiDebrief {
  score: number;
  wins: string[];
  misses: string[];
  followUpEmail: string;
}

interface SavedSession {
  id: string;
  objective: string;
  duration_seconds: number;
  created_at: string;
  transcript: TranscriptEntry[];
  coach_cards: CoachCard[];
  score?: number;
  sentiment?: number;
  talk_ratio?: number;
}

interface DebriefTabProps {
  transcript: TranscriptEntry[];
  coachCards: CoachCard[];
  score: number;
  sentiment: number;
  talkRatio: number;
  duration: number;
  objective: string;
  objections: Objection[];
  sessionHistory: SavedSession[];
  onReplay: (session: SavedSession) => void;
  selectedSessionId: string | null;
  userId?: string;
  onCreditsExhausted?: (creditType: string) => void;
  sessionId?: string;
}

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 75 ? '#00c896' : score >= 50 ? '#c9960c' : '#ff4757';
  const circumference = 2 * Math.PI * 48;
  const dashArray = (score / 100) * circumference;

  return (
    <div className="relative" style={{ width: 120, height: 120 }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle
          cx="60" cy="60" r="48"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dashArray} ${circumference}`}
          strokeDashoffset={circumference * 0.25}
          style={{
            transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)',
            filter: `drop-shadow(0 0 8px ${color}50)`,
            transformOrigin: '50% 50%',
            transform: 'rotate(-90deg)',
          }}
        />
        <circle cx="60" cy="60" r="38" fill="hsl(var(--card))" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono font-black text-3xl leading-none" style={{ color }}>
          {score}
        </span>
        <span className="text-[0.55rem] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">Score</span>
      </div>
    </div>
  );
}

export function DebriefTab({
  transcript, coachCards, score, sentiment, talkRatio, duration, objective, objections,
  sessionHistory, onReplay, selectedSessionId,
  userId, onCreditsExhausted, sessionId,
}: DebriefTabProps) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [aiDebrief, setAiDebrief] = useState<AiDebrief | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [outcomeSaving, setOutcomeSaving] = useState(false);
  const hasFetchedRef = useRef(false);

  const displayScore = aiDebrief?.score ?? score;
  const scoreColor = displayScore >= 75 ? '#00c896' : displayScore >= 50 ? '#c9960c' : '#ff4757';

  const questionCount = transcript.filter(e => e.text.includes('?')).length;
  const talkGrade = talkRatio < 45 ? 'A' : talkRatio < 55 ? 'B' : talkRatio < 65 ? 'C' : 'D';
  const sentimentGrade = sentiment >= 70 ? 'A' : sentiment >= 55 ? 'B' : sentiment >= 40 ? 'C' : 'D';
  const discoveryGrade = questionCount >= 5 ? 'A' : questionCount >= 3 ? 'B' : questionCount >= 1 ? 'C' : 'D';
  const gradeColor = (g: string) =>
    g === 'A' ? '#00c896' : g === 'B' ? '#c9960c' : g === 'C' ? '#f5d97e' : '#ff4757';

  async function fetchAiDebrief() {
    if (transcript.length === 0) return;
    setAiLoading(true);
    setAiError('');
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'debrief',
          userId,
          transcript,
          coachCards,
          score,
          sentiment,
          talkRatio,
          duration,
          objective,
          objections,
        }),
      });
      const data = await res.json();
      if (res.status === 402) {
        onCreditsExhausted?.(data.creditType || 'debrief');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'API error');
      setAiDebrief({
        score: typeof data.score === 'number' ? data.score : score,
        wins: Array.isArray(data.wins) ? data.wins : [],
        misses: Array.isArray(data.misses) ? data.misses : [],
        followUpEmail: typeof data.followUpEmail === 'string' ? data.followUpEmail : '',
      });
    } catch (err: any) {
      setAiError(err.message || 'Failed to generate debrief');
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    if (transcript.length > 0 && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchAiDebrief();
    }
  }, [transcript.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (transcript.length === 0) {
      hasFetchedRef.current = false;
      setAiDebrief(null);
      setAiError('');
    }
  }, [transcript.length]);

  const emailText = aiDebrief?.followUpEmail ?? '';

  async function handleOutcomeSelect(value: CallOutcome) {
    setOutcome(value);
    const targetId = sessionId ?? selectedSessionId;
    if (!targetId || !supabase) return;
    setOutcomeSaving(true);
    try {
      await supabase.from('call_sessions').update({ outcome: value }).eq('id', targetId);
    } catch {
      // Non-blocking
    } finally {
      setOutcomeSaving(false);
    }
  }

  function copyEmail() {
    navigator.clipboard.writeText(emailText).then(() => {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    });
  }

  return (
    <div className="relative z-10 flex flex-col gap-4 p-5 pb-10 overflow-auto flex-1" data-testid="debrief-tab">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        <div className="flex flex-col gap-4">
          <div
            className="rounded-2xl border border-border bg-card p-5 flex items-center gap-6"
            style={{ backdropFilter: 'blur(8px)' }}
            data-testid="score-section"
          >
            <ScoreCircle score={displayScore} />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[0.62rem] font-mono uppercase tracking-widest text-primary">Call Score</p>
                {aiLoading && (
                  <span className="flex items-center gap-1 text-[0.6rem] font-mono text-muted-foreground">
                    <span className="w-3 h-3 border border-muted-foreground/40 border-t-muted-foreground rounded-full animate-spin" />
                    AI analyzing...
                  </span>
                )}
                {aiDebrief && !aiLoading && (
                  <span className="text-[0.6rem] font-mono text-[#00c896]">AI scored</span>
                )}
              </div>
              <p className="text-2xl font-extrabold" style={{ color: scoreColor }}>
                {displayScore >= 85 ? 'Elite Performance' : displayScore >= 75 ? 'Strong Call' : displayScore >= 60 ? 'Solid Effort' : displayScore >= 45 ? 'Needs Work' : 'Review Required'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{formatTime(duration)} call — {transcript.length} transcript entries</p>
              <div className="flex gap-3 mt-3">
                {[
                  { label: 'Talk Ratio', grade: talkGrade, value: `${talkRatio}%` },
                  { label: 'Sentiment', grade: sentimentGrade, value: String(sentiment) },
                  { label: 'Discovery', grade: discoveryGrade, value: `${questionCount}Q` },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col items-center gap-0.5">
                    <span
                      className="font-mono font-black text-xl"
                      style={{ color: gradeColor(item.grade) }}
                      data-testid={`grade-${item.label.toLowerCase()}`}
                    >
                      {item.grade}
                    </span>
                    <span className="text-[0.58rem] font-mono uppercase tracking-widest text-muted-foreground">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Call Outcome Tracker */}
          <div
            className="rounded-2xl border border-border bg-card p-4"
            style={{ backdropFilter: 'blur(8px)' }}
            data-testid="outcome-section"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[0.62rem] font-mono uppercase tracking-widest text-primary">Call Outcome</p>
              {outcomeSaving && <span className="text-[0.6rem] font-mono text-muted-foreground">Saving...</span>}
              {outcome && !outcomeSaving && <span className="text-[0.6rem] font-mono text-[#00c896]">Saved</span>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {OUTCOME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleOutcomeSelect(opt.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all hover:-translate-y-px ${
                    outcome === opt.value
                      ? 'border-opacity-40 bg-opacity-8'
                      : 'border-border bg-background hover:border-primary/30'
                  }`}
                  style={outcome === opt.value ? { borderColor: `${opt.color}50`, background: `${opt.color}0d` } : {}}
                  data-testid={`outcome-${opt.value}`}
                >
                  <span className="text-lg">{opt.icon}</span>
                  <span className="text-[0.62rem] font-mono font-semibold leading-tight" style={{ color: outcome === opt.value ? opt.color : undefined }}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              className="rounded-2xl border border-[rgba(0,200,150,0.25)] bg-[rgba(0,200,150,0.04)] p-4"
              style={{ backdropFilter: 'blur(8px)' }}
              data-testid="strengths-section"
            >
              <p className="text-[0.62rem] font-mono uppercase tracking-widest text-[#00c896] mb-3">
                {aiDebrief ? 'Wins' : 'Strengths'}
              </p>
              {aiLoading ? (
                <div className="flex flex-col gap-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-4 rounded bg-[rgba(0,200,150,0.1)] animate-pulse" style={{ width: `${70 + i * 8}%` }} />
                  ))}
                </div>
              ) : aiDebrief?.wins && aiDebrief.wins.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {aiDebrief.wins.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-[#00c896] shrink-0 mt-0.5 font-bold">+</span>
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Complete a call to see your strengths.</p>
              )}
            </div>

            <div
              className="rounded-2xl border border-[rgba(245,217,126,0.2)] bg-[rgba(245,217,126,0.04)] p-4"
              style={{ backdropFilter: 'blur(8px)' }}
              data-testid="improvements-section"
            >
              <p className="text-[0.62rem] font-mono uppercase tracking-widest text-[#f5d97e] mb-3">
                {aiDebrief ? 'Misses' : 'Improve Next Time'}
              </p>
              {aiLoading ? (
                <div className="flex flex-col gap-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-4 rounded bg-[rgba(245,217,126,0.1)] animate-pulse" style={{ width: `${65 + i * 9}%` }} />
                  ))}
                </div>
              ) : aiDebrief?.misses && aiDebrief.misses.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {aiDebrief.misses.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-[#f5d97e] shrink-0 mt-0.5">→</span>
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Complete a call to see improvement areas.</p>
              )}
            </div>
          </div>

          {aiError && (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5">
              <p className="text-xs text-red-400">{aiError}</p>
              <button
                onClick={fetchAiDebrief}
                className="text-xs font-semibold text-primary hover:underline ml-4 shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          <div
            className="rounded-2xl border border-border bg-card p-4"
            style={{ backdropFilter: 'blur(8px)' }}
            data-testid="email-section"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="text-[0.62rem] font-mono uppercase tracking-widest text-primary">Follow-up Email</p>
                {aiDebrief && <span className="text-[0.58rem] font-mono text-[#00c896]">AI-generated</span>}
              </div>
              <div className="flex items-center gap-2">
                {!aiDebrief && transcript.length > 0 && (
                  <button
                    onClick={fetchAiDebrief}
                    disabled={aiLoading}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-50"
                  >
                    {aiLoading ? 'Generating...' : 'Generate AI Debrief'}
                  </button>
                )}
                {aiDebrief && (
                  <button
                    onClick={fetchAiDebrief}
                    disabled={aiLoading}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
                  >
                    Regenerate
                  </button>
                )}
                <button
                  onClick={copyEmail}
                  disabled={!emailText}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    copiedEmail
                      ? 'bg-[rgba(0,200,150,0.12)] border border-[rgba(0,200,150,0.3)] text-[#00c896]'
                      : 'border border-primary/30 bg-[rgba(201,150,12,0.08)] text-primary hover:bg-[rgba(201,150,12,0.15)]'
                  }`}
                  data-testid="button-copy-email"
                >
                  {copiedEmail ? 'Copied!' : 'Copy Email'}
                </button>
              </div>
            </div>

            {aiLoading ? (
              <div className="space-y-2 py-4">
                {[90, 75, 85, 60, 80, 70].map((w, i) => (
                  <div key={i} className="h-3 rounded bg-muted/40 animate-pulse" style={{ width: `${w}%` }} />
                ))}
              </div>
            ) : (
              <textarea
                value={emailText}
                readOnly
                rows={10}
                placeholder={transcript.length === 0 ? 'Complete a call to generate your follow-up email.' : 'Generating AI follow-up email...'}
                className="w-full px-3 py-2.5 rounded-xl bg-background border border-input text-xs font-mono text-muted-foreground leading-relaxed outline-none resize-none"
                data-testid="email-output"
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div
            className="rounded-2xl border border-border bg-card p-4 flex-1"
            style={{ backdropFilter: 'blur(8px)' }}
            data-testid="session-history"
          >
            <p className="text-[0.62rem] font-mono uppercase tracking-widest text-primary mb-3">Session History</p>
            {sessionHistory.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-muted-foreground">No saved sessions yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Save a session after your first call.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[600px]">
                {sessionHistory.map((session) => {
                  const date = new Date(session.created_at);
                  const isSelected = session.id === selectedSessionId;
                  return (
                    <div
                      key={session.id}
                      className={`p-3 rounded-xl border cursor-pointer transition-all hover:border-primary/40 ${
                        isSelected ? 'border-primary/40 bg-[rgba(201,150,12,0.06)]' : 'border-border bg-background'
                      }`}
                      onClick={() => onReplay(session)}
                      data-testid={`session-history-item-${session.id}`}
                    >
                      <p className="text-xs font-semibold text-foreground/90 truncate">{session.objective || 'Untitled session'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[0.6rem] font-mono text-muted-foreground">
                          {formatTime(session.duration_seconds)}
                        </span>
                        {session.score !== undefined && (
                          <span className="text-[0.6rem] font-mono text-primary">{session.score}/100</span>
                        )}
                        <span className="text-[0.6rem] text-muted-foreground ml-auto">
                          {isNaN(date.getTime()) ? '' : date.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
