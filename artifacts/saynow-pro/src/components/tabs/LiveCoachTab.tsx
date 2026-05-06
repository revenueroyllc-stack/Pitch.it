import { useEffect, useRef, useState } from 'react';
import { CoachCard } from '@/components/coach/CoachCard';
import { SentimentGauge } from '@/components/coach/SentimentGauge';
import { LiveScoreMeter } from '@/components/coach/LiveScoreMeter';
import { TalkRatioBar } from '@/components/coach/TalkRatioBar';
import { IntelligenceStatus } from '@/components/coach/IntelligenceStatus';
import { DialerPanel } from '@/components/dialer/DialerPanel';
import { useVoiceCoach } from '@/lib/useVoiceCoach';
import { useAudioFeedback } from '@/lib/useAudioFeedback';
import type { CoachCard as CoachCardType, TranscriptEntry } from '@/lib/coach';

const AI_COACH_INTERVAL_MS = 8000;

function parseTimestampSecs(ts: string): number {
  const parts = ts.split(':').map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
}

function getVoiceEnabled(): boolean {
  try { return localStorage.getItem('saynow-voice') !== 'false'; } catch { return true; }
}
function setVoicePref(v: boolean) {
  try { localStorage.setItem('saynow-voice', v ? 'true' : 'false'); } catch {}
}

interface LiveCoachTabProps {
  sessionLive: boolean;
  micStatus: string;
  supportsSpeech: boolean;
  transcriptEntries: TranscriptEntry[];
  interimTranscript: string;
  coachCards: CoachCardType[];
  talkingPoints: string[];
  sentiment: number;
  userSentiment: number;
  prospectSentiment: number;
  liveScore: number;
  talkRatio: number;
  questionCount: number;
  timerSeconds: number;
  userId?: string;
  eventThinking?: boolean;
  onStartSession: () => void;
  onStopSession: () => void;
  onAddManualTip: () => void;
  onEventTrigger?: (type: string) => void;
  onSaveSnapshot: () => void;
  onAiCards: (cards: CoachCardType[]) => void;
  onCreditsExhausted?: (creditType: string) => void;
  savingSession: boolean;
}

export function LiveCoachTab({
  sessionLive,
  micStatus,
  transcriptEntries,
  interimTranscript,
  coachCards,
  talkingPoints,
  userSentiment,
  prospectSentiment,
  liveScore,
  talkRatio,
  questionCount,
  timerSeconds,
  userId,
  eventThinking = false,
  onStartSession,
  onStopSession,
  onAddManualTip,
  onEventTrigger,
  onSaveSnapshot,
  onAiCards,
  onCreditsExhausted,
  savingSession,
}: LiveCoachTabProps) {
  const showTalkWarning = sessionLive && talkRatio > 60;
  const [aiThinking, setAiThinking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(getVoiceEnabled);
  const [newCardKeys, setNewCardKeys] = useState<Set<string>>(new Set());

  // ── Stable refs ────────────────────────────────────────────────────────
  const transcriptRef = useRef(transcriptEntries);
  const talkingPointsRef = useRef(talkingPoints);
  const timerRef = useRef(timerSeconds);
  const sessionLiveRef = useRef(sessionLive);
  const userIdRef = useRef(userId);
  const creditsExhaustedRef = useRef(false);
  const prevCardCountRef = useRef(0);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { transcriptRef.current = transcriptEntries; }, [transcriptEntries]);
  useEffect(() => { talkingPointsRef.current = talkingPoints; }, [talkingPoints]);
  useEffect(() => { timerRef.current = timerSeconds; }, [timerSeconds]);
  useEffect(() => { sessionLiveRef.current = sessionLive; }, [sessionLive]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // ── Voice coach + audio ────────────────────────────────────────────────
  const { speakCard, silence } = useVoiceCoach(voiceEnabled);
  const { pingCoach, pingWarning, pingStart, pingStop } = useAudioFeedback();

  // ── Auto-scroll transcript ─────────────────────────────────────────────
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [transcriptEntries, interimTranscript]);

  // ── React to new coach cards ───────────────────────────────────────────
  useEffect(() => {
    if (coachCards.length > prevCardCountRef.current) {
      const newest = coachCards[0];
      if (newest) {
        const key = `${newest.tone}:${newest.text.slice(0, 40)}`;
        // Glow animation
        setNewCardKeys((prev) => new Set([...prev, key]));
        setTimeout(() => setNewCardKeys((prev) => { const n = new Set(prev); n.delete(key); return n; }), 3000);
        // Audio + voice feedback
        if (newest.tone === 'warning' || newest.tone === 'battlecard') {
          pingWarning();
        } else {
          pingCoach();
        }
        speakCard(newest);
      }
    }
    prevCardCountRef.current = coachCards.length;
  }, [coachCards, pingCoach, pingWarning, speakCard]);

  // ── Session start/stop audio ───────────────────────────────────────────
  useEffect(() => {
    if (sessionLive) {
      creditsExhaustedRef.current = false;
      setAiThinking(false);
      prevCardCountRef.current = 0;
      setNewCardKeys(new Set());
      pingStart();
    } else {
      if (prevCardCountRef.current > 0) pingStop();
      silence();
    }
  }, [sessionLive, pingStart, pingStop, silence]);

  // ── 8-second AI coaching interval ─────────────────────────────────────
  useEffect(() => {
    if (!sessionLive) return;

    async function fetchAiCards() {
      if (!sessionLiveRef.current || creditsExhaustedRef.current) return;
      const elapsed = timerRef.current;

      // Skip if no speech in the last 2 intervals (16s) — smart interval gate
      const veryRecent = transcriptRef.current.filter(
        (e) => parseTimestampSecs(e.timestamp) >= elapsed - 16
      );
      if (veryRecent.length === 0) return;

      // Send last 60s of transcript to Claude for conversational memory
      const recentTranscript = transcriptRef.current.filter(
        (e) => parseTimestampSecs(e.timestamp) >= elapsed - 60
      );

      setAiThinking(true);
      try {
        const res = await fetch('/api/claude', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'live-coach',
            userId: userIdRef.current,
            recentTranscript,
            talkingPoints: talkingPointsRef.current,
            elapsedSeconds: elapsed,
          }),
        });

        if (res.status === 402) {
          creditsExhaustedRef.current = true;
          const data = await res.json();
          onCreditsExhausted?.(data.creditType || 'interval');
          return;
        }

        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.cards) && data.cards.length > 0) {
          const ts = `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
          const cards: CoachCardType[] = data.cards.map((c: Partial<CoachCardType>) => ({
            type: c.type || 'Tip',
            tone: c.tone || 'tip',
            trigger: c.trigger || 'AI coach',
            text: c.text || '',
            timestamp: ts,
          }));
          onAiCards(cards);
        }
      } catch {
        // Silently ignore network errors — AI coaching is best-effort
      } finally {
        setAiThinking(false);
      }
    }

    const id = setInterval(fetchAiCards, AI_COACH_INTERVAL_MS);
    return () => {
      clearInterval(id);
      setAiThinking(false);
    };
  }, [sessionLive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ────────────────────────────────────────────────────────────
  const prospectPct = Math.max(0, 100 - talkRatio);
  const nextCheckIn = sessionLive ? (8 - (timerSeconds % 8)) || 8 : null;

  function handleVoiceToggle() {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    setVoicePref(next);
    if (!next) silence();
  }

  function handleStart() {
    onStartSession();
  }

  return (
    <div className="relative z-10 flex flex-col gap-3 p-4 pb-8 flex-1 overflow-auto" data-testid="live-coach-tab">

      {/* ── Dialer (always at top) ── */}
      <DialerPanel
        userId={userId}
        onCallStarted={onStartSession}
      />

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Session', value: sessionLive ? 'LIVE' : 'IDLE', highlight: sessionLive },
          { label: 'Questions', value: String(questionCount), highlight: false },
          { label: 'Coach Tips', value: String(coachCards.length), highlight: coachCards.length > 0 },
          { label: 'Talk Ratio', value: `${talkRatio}%`, highlight: talkRatio > 60 },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`p-3 rounded-xl border text-center ${
              stat.highlight
                ? 'border-primary/40 bg-[rgba(201,150,12,0.08)]'
                : 'border-border bg-card'
            }`}
            style={{ backdropFilter: 'blur(8px)' }}
            data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}
          >
            <p className={`font-mono font-bold text-xl ${stat.highlight ? 'text-primary' : 'text-foreground'}`}>
              {stat.value}
            </p>
            <p className="text-[0.62rem] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Live Intelligence Status ── */}
      {sessionLive && (
        <IntelligenceStatus
          talkRatio={talkRatio}
          prospectSentiment={prospectSentiment}
          liveScore={liveScore}
          questionCount={questionCount}
          timerSeconds={timerSeconds}
          eventThinking={eventThinking}
        />
      )}

      {/* ── Talk ratio warning ── */}
      {showTalkWarning && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[rgba(201,150,12,0.4)] talk-warning-pulse"
          data-testid="talk-warning"
        >
          <span className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
          <p className="text-sm font-semibold text-primary">
            You are dominating at {talkRatio}% — ask a question and listen.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3 flex-1 min-h-0">

        {/* ── Left: transcript ── */}
        <div className="flex flex-col gap-3">
          <div
            className="rounded-2xl border border-border bg-card flex flex-col min-h-[380px]"
            style={{ backdropFilter: 'blur(8px)' }}
          >
            {/* Transcript header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-0 shrink-0">
              <div className="flex items-center gap-3">
                <p className="text-[0.62rem] font-mono uppercase tracking-widest text-primary">Live Transcript</p>
                <span
                  className={`px-2 py-0.5 rounded-full text-[0.6rem] font-mono font-semibold uppercase tracking-wider border transition-all ${
                    micStatus === 'listening'
                      ? 'border-[rgba(0,200,150,0.35)] bg-[rgba(0,200,150,0.1)] text-[#00c896] mic-pulse'
                      : micStatus === 'connecting'
                      ? 'border-primary/30 bg-[rgba(201,150,12,0.08)] text-primary animate-pulse'
                      : 'border-border bg-muted text-muted-foreground'
                  }`}
                  data-testid="mic-status"
                >
                  {micStatus === 'listening' ? '● Mic: On'
                    : micStatus === 'connecting' ? 'Connecting...'
                    : `Mic: ${micStatus}`}
                </span>
              </div>
              {/* Waveform bars */}
              <div className="flex gap-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <span key={i} className={`waveform-bar h-4 ${sessionLive && micStatus === 'listening' ? 'active' : ''}`} />
                ))}
              </div>
            </div>

            {/* Transcript body */}
            <div
              ref={transcriptScrollRef}
              className="flex-1 p-4 overflow-y-auto flex flex-col gap-2 font-mono text-sm"
              data-testid="transcript-body"
            >
              {transcriptEntries.length === 0 && !interimTranscript && (
                <div className="flex flex-col items-center justify-center flex-1 text-center py-10 text-muted-foreground gap-3">
                  <div className="w-12 h-12 rounded-2xl border border-border flex items-center justify-center bg-card">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground/60 text-sm">No transcript yet</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                      {sessionLive
                        ? 'Speak now — Claude coaches every 8 seconds when speech is detected.'
                        : 'Start a session to capture live speech and receive real-time AI coaching.'}
                    </p>
                  </div>
                </div>
              )}
              {transcriptEntries.map((entry, i) => (
                <div
                  key={`${entry.timestamp}-${i}`}
                  className="grid gap-2 p-2.5 rounded-xl bg-background border border-border animate-tab-in"
                  style={{ gridTemplateColumns: '52px 72px 1fr' }}
                  data-testid={`transcript-line-${i}`}
                >
                  <span className="text-[#f5d97e] text-xs">{entry.timestamp}</span>
                  <span className={`text-xs font-semibold ${entry.speaker === 'You' ? 'text-primary' : 'text-[#4a90d9]'}`}>
                    {entry.speaker}
                  </span>
                  <span className="text-foreground/80 text-xs leading-relaxed">{entry.text}</span>
                </div>
              ))}
              {interimTranscript && (
                <div
                  className="grid gap-2 p-2.5 rounded-xl border border-dashed border-primary/20 bg-[rgba(201,150,12,0.04)] text-muted-foreground"
                  style={{ gridTemplateColumns: '52px 72px 1fr' }}
                  data-testid="interim-transcript"
                >
                  <span className="text-xs text-primary/60">...</span>
                  <span className="text-xs text-primary/60">Live</span>
                  <span className="text-xs leading-relaxed">{interimTranscript}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Controls ── */}
          <div className="flex flex-wrap gap-2" data-testid="session-controls">
            <button
              onClick={handleStart}
              disabled={sessionLive}
              className="px-4 py-2.5 rounded-xl font-bold text-sm text-primary-foreground transition-all hover:-translate-y-px active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #c9960c, #f5d97e)', color: '#1a0a0a' }}
              data-testid="button-start-session"
            >
              {sessionLive ? '● Recording' : 'Start Session'}
            </button>
            <button
              onClick={onStopSession}
              disabled={!sessionLive}
              className="px-4 py-2.5 rounded-xl font-bold text-sm bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="button-stop-session"
            >
              Stop
            </button>
            <button
              onClick={onAddManualTip}
              className="px-4 py-2.5 rounded-xl font-bold text-sm border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
              data-testid="button-add-manual-tip"
            >
              Manual Tip
            </button>
            <button
              onClick={onSaveSnapshot}
              disabled={savingSession}
              className="px-4 py-2.5 rounded-xl font-bold text-sm border border-[rgba(245,217,126,0.3)] bg-[rgba(245,217,126,0.08)] text-[#f5d97e] hover:bg-[rgba(245,217,126,0.15)] transition-all disabled:opacity-60"
              data-testid="button-save-snapshot"
            >
              {savingSession ? 'Saving...' : 'Save Snapshot'}
            </button>
          </div>

          {/* ── Manual event triggers (visible when live) ── */}
          {sessionLive && onEventTrigger && (
            <div className="flex flex-wrap gap-1.5" data-testid="event-trigger-buttons">
              {[
                { type: 'objection',          label: 'Objection',  color: '#ff4757' },
                { type: 'silence',            label: 'Silence',    color: '#c9960c' },
                { type: 'no-question',        label: 'No Question',color: '#00c896' },
                { type: 'talk-ratio-warning', label: 'Too Much',   color: '#f5d97e' },
                { type: 'filler-spike',       label: 'Fillers',    color: '#9b59b6' },
              ].map(({ type, label, color }) => (
                <button
                  key={type}
                  onClick={() => onEventTrigger(type)}
                  className="px-2.5 py-1.5 rounded-lg text-[0.62rem] font-bold border transition-all hover:opacity-80 active:scale-95"
                  style={{
                    color,
                    borderColor: `${color}40`,
                    backgroundColor: `${color}12`,
                  }}
                  data-testid={`event-btn-${type}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

        </div>

        {/* ── Right: intelligence panels ── */}
        <div className="flex flex-col gap-3">

          {/* Dual sentiment gauges */}
          <div
            className="rounded-2xl border border-border bg-card p-4 flex items-center justify-around gap-4"
            style={{ backdropFilter: 'blur(8px)' }}
          >
            <SentimentGauge value={userSentiment} isLive={sessionLive} label="Your mood" />
            <div className="w-px h-16 bg-border" />
            <SentimentGauge value={prospectSentiment} isLive={sessionLive} label="Prospect mood" />
          </div>

          {/* Live score meter */}
          <div
            className="rounded-2xl border border-border bg-card p-4 flex items-center justify-center"
            style={{ backdropFilter: 'blur(8px)' }}
          >
            <LiveScoreMeter score={liveScore} isLive={sessionLive} />
          </div>

          {/* Talk ratio split bar */}
          <TalkRatioBar
            userPct={talkRatio}
            prospectPct={prospectPct}
            sessionLive={sessionLive}
          />

          {/* ── Coach feed ── */}
          <div
            className="rounded-2xl border border-border bg-card flex flex-col flex-1 min-h-[240px]"
            style={{ backdropFilter: 'blur(8px)' }}
          >
            {/* Coach feed header */}
            <div className="px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
              <p className="text-[0.62rem] font-mono uppercase tracking-widest text-primary">Coach Feed</p>
              <div className="flex items-center gap-2">
                {/* Voice toggle */}
                <button
                  onClick={handleVoiceToggle}
                  title={voiceEnabled ? 'Voice coaching on — click to mute' : 'Voice coaching off — click to enable'}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[0.6rem] font-mono uppercase tracking-wider transition-all ${
                    voiceEnabled
                      ? 'border-primary/30 bg-[rgba(201,150,12,0.1)] text-primary'
                      : 'border-border bg-muted text-muted-foreground'
                  }`}
                  data-testid="voice-toggle"
                >
                  {voiceEnabled ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
                    </svg>
                  )}
                  {voiceEnabled ? 'Voice On' : 'Voice Off'}
                </button>

                {/* AI status */}
                {sessionLive && (
                  (aiThinking || eventThinking) ? (
                    <span
                      className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-primary/30 bg-[rgba(201,150,12,0.08)]"
                      data-testid="ai-thinking-indicator"
                    >
                      <span className="flex gap-0.5">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="w-1 h-1 rounded-full bg-primary"
                            style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                          />
                        ))}
                      </span>
                      <span className="text-[0.6rem] font-mono text-primary">Analyzing...</span>
                    </span>
                  ) : nextCheckIn !== null ? (
                    <span className="text-[0.58rem] font-mono text-muted-foreground tabular-nums">
                      next ~{nextCheckIn}s
                    </span>
                  ) : null
                )}
              </div>
            </div>

            {/* Coach cards */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-2" data-testid="coach-feed">
              {aiThinking && coachCards.length === 0 && (
                <div
                  className="flex flex-col gap-2 p-3 rounded-xl border border-primary/20 bg-[rgba(201,150,12,0.04)]"
                  data-testid="ai-thinking-skeleton"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-[0.6rem] font-mono text-primary uppercase tracking-widest">Claude analyzing...</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-primary/10 animate-pulse w-4/5" />
                  <div className="h-2.5 rounded-full bg-primary/10 animate-pulse w-3/5" />
                  <div className="h-2.5 rounded-full bg-primary/10 animate-pulse w-2/3" />
                </div>
              )}

              {!aiThinking && coachCards.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <div className="w-9 h-9 rounded-xl border border-border flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
                    </svg>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">
                    {sessionLive
                      ? 'Claude coaches every 8s when speech is detected. Event triggers fire instantly.'
                      : 'Start a session to receive real-time AI coaching.'}
                  </p>
                </div>
              )}

              {coachCards.map((card, i) => {
                const key = `${card.tone}:${card.text.slice(0, 40)}`;
                const isNew = newCardKeys.has(key);
                const glowClass = isNew
                  ? card.tone === 'warning' || card.tone === 'battlecard'
                    ? 'card-warning-glow'
                    : 'card-new-glow'
                  : '';
                return (
                  <div key={`${card.timestamp}-${i}-${card.text?.slice(0, 20)}`} className={glowClass}>
                    <CoachCard card={card} index={i} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active talking points */}
          {talkingPoints.length > 0 && (
            <div
              className="rounded-2xl border border-border bg-card p-3"
              style={{ backdropFilter: 'blur(8px)' }}
            >
              <p className="text-[0.62rem] font-mono uppercase tracking-widest text-muted-foreground mb-2">Active Talking Points</p>
              <div className="flex flex-col gap-1.5" data-testid="active-talking-points">
                {talkingPoints.map((point, i) => (
                  <div key={`${point}-${i}`} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                    <span className="text-xs text-muted-foreground leading-snug">{point}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
