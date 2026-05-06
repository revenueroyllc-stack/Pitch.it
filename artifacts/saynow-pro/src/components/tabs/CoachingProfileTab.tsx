import { useMemo } from 'react';
import type { CoachCard, TranscriptEntry } from '@/lib/coach';

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

interface CoachingProfileTabProps {
  sessionHistory: SavedSession[];
  currentScore: number;
  currentSentiment: number;
  currentTalkRatio: number;
}

interface Badge {
  title: string;
  description: string;
  earned: boolean;
  color: string;
}

export function CoachingProfileTab({
  sessionHistory,
  currentScore,
  currentSentiment,
  currentTalkRatio,
}: CoachingProfileTabProps) {
  const allSessions = useMemo(() => {
    const sessions = sessionHistory.map((s) => ({
      score: s.score ?? 50,
      sentiment: s.sentiment ?? 50,
      talkRatio: s.talk_ratio ?? 50,
      duration: s.duration_seconds ?? 0,
      questionCount: Array.isArray(s.transcript)
        ? s.transcript.filter((e) => e.text?.includes('?')).length
        : 0,
    }));
    if (currentScore > 0) {
      sessions.unshift({
        score: currentScore,
        sentiment: currentSentiment,
        talkRatio: currentTalkRatio,
        duration: 0,
        questionCount: 0,
      });
    }
    return sessions;
  }, [sessionHistory, currentScore, currentSentiment, currentTalkRatio]);

  const stats = useMemo(() => {
    if (allSessions.length === 0) return null;
    const scores = allSessions.map((s) => s.score);
    const talkRatios = allSessions.filter((s) => s.talkRatio > 0).map((s) => s.talkRatio);
    const sentiments = allSessions.map((s) => s.sentiment);
    return {
      totalCalls: sessionHistory.length,
      avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      bestScore: Math.max(...scores),
      avgTalkRatio: talkRatios.length
        ? Math.round(talkRatios.reduce((a, b) => a + b, 0) / talkRatios.length)
        : 0,
      avgSentiment: Math.round(sentiments.reduce((a, b) => a + b, 0) / sentiments.length),
    };
  }, [allSessions, sessionHistory.length]);

  const badges: Badge[] = useMemo(() => {
    if (!stats) return [];
    return [
      {
        title: 'Talk Master',
        description: 'Avg talk ratio under 45%',
        earned: stats.avgTalkRatio > 0 && stats.avgTalkRatio < 45,
        color: '#00c896',
      },
      {
        title: 'Sentiment Star',
        description: 'Avg prospect sentiment over 70',
        earned: stats.avgSentiment >= 70,
        color: '#f5d97e',
      },
      {
        title: 'Elite Closer',
        description: 'Best call score over 85',
        earned: stats.bestScore >= 85,
        color: '#c9960c',
      },
      {
        title: 'Consistent Performer',
        description: 'Avg score over 70 across 3+ calls',
        earned: stats.totalCalls >= 3 && stats.avgScore >= 70,
        color: '#c9960c',
      },
      {
        title: 'Discovery Pro',
        description: 'Complete 5 sessions',
        earned: stats.totalCalls >= 5,
        color: '#00c896',
      },
    ];
  }, [stats]);

  const recentScores = useMemo(() => {
    return sessionHistory
      .slice(0, 8)
      .map((s) => s.score ?? 50)
      .reverse();
  }, [sessionHistory]);

  const maxScore = Math.max(100, ...recentScores);

  if (sessionHistory.length === 0 && currentScore === 0) {
    return (
      <div
        className="relative z-10 flex flex-col items-center justify-center flex-1 p-5 text-center gap-6"
        data-testid="profile-empty"
      >
        <div className="w-16 h-16 rounded-2xl border border-border flex items-center justify-center bg-card">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/>
          </svg>
        </div>
        <div>
          <h2 className="font-extrabold text-xl">Your coaching profile starts here.</h2>
          <p className="text-muted-foreground text-sm mt-2 max-w-xs leading-relaxed">
            Complete your first call, save a session snapshot, and your personal performance profile will start building automatically.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg w-full">
          {[
            { label: 'Prep your call', desc: 'Add talking points and objection responses.' },
            { label: 'Run a live session', desc: 'Capture real-time transcript and coaching.' },
            { label: 'Save the snapshot', desc: 'Build your coaching profile over time.' },
          ].map((step, i) => (
            <div key={i} className="p-3 rounded-xl border border-border bg-card text-left">
              <p className="text-[0.6rem] font-mono text-primary uppercase tracking-widest mb-1">Step {i + 1}</p>
              <p className="text-xs font-bold text-foreground">{step.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 flex flex-col gap-4 p-5 pb-10 overflow-auto flex-1" data-testid="profile-tab">
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Calls', value: String(stats.totalCalls) },
            { label: 'Avg Score', value: String(stats.avgScore), color: stats.avgScore >= 70 ? '#00c896' : '#c9960c' },
            { label: 'Best Score', value: String(stats.bestScore), color: '#c9960c' },
            { label: 'Avg Talk Ratio', value: stats.avgTalkRatio > 0 ? `${stats.avgTalkRatio}%` : 'N/A', color: stats.avgTalkRatio > 0 && stats.avgTalkRatio < 50 ? '#00c896' : '#f5d97e' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-4 rounded-2xl border border-border bg-card text-center"
              style={{ backdropFilter: 'blur(8px)' }}
              data-testid={`profile-stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}
            >
              <p className="font-mono font-bold text-2xl" style={{ color: stat.color ?? 'inherit' }}>
                {stat.value}
              </p>
              <p className="text-[0.62rem] font-mono uppercase tracking-widest text-muted-foreground mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {recentScores.length > 1 && (
        <div
          className="rounded-2xl border border-border bg-card p-5"
          style={{ backdropFilter: 'blur(8px)' }}
          data-testid="score-trend"
        >
          <p className="text-[0.62rem] font-mono uppercase tracking-widest text-primary mb-4">Score Trend</p>
          <div className="flex items-end gap-2 h-24">
            {recentScores.map((score, i) => {
              const height = (score / maxScore) * 100;
              const color = score >= 75 ? '#00c896' : score >= 50 ? '#c9960c' : '#ff4757';
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md transition-all"
                    style={{ height: `${height}%`, background: color, minHeight: 4, opacity: 0.8 }}
                    data-testid={`score-bar-${i}`}
                  />
                  <span className="text-[0.55rem] font-mono text-muted-foreground">{score}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[0.6rem] text-muted-foreground mt-2 text-center">Last {recentScores.length} sessions</p>
        </div>
      )}

      <div
        className="rounded-2xl border border-border bg-card p-5"
        style={{ backdropFilter: 'blur(8px)' }}
        data-testid="badges-section"
      >
        <p className="text-[0.62rem] font-mono uppercase tracking-widest text-primary mb-4">Performance Badges</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {badges.map((badge) => (
            <div
              key={badge.title}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                badge.earned
                  ? 'border-opacity-40 bg-opacity-5'
                  : 'border-border bg-background opacity-40'
              }`}
              style={
                badge.earned
                  ? {
                      borderColor: `${badge.color}40`,
                      background: `${badge.color}08`,
                    }
                  : undefined
              }
              data-testid={`badge-${badge.title.toLowerCase().replace(/\s/g, '-')}`}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: badge.earned ? `${badge.color}20` : 'transparent', border: `1px solid ${badge.color}40` }}
              >
                <span className="text-sm font-bold" style={{ color: badge.earned ? badge.color : '#666' }}>
                  {badge.earned ? '★' : '○'}
                </span>
              </div>
              <div>
                <p className="text-xs font-bold text-foreground/90">{badge.title}</p>
                <p className="text-[0.65rem] text-muted-foreground mt-0.5">{badge.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="rounded-2xl border border-border bg-card p-5"
        style={{ backdropFilter: 'blur(8px)' }}
        data-testid="coaching-insights"
      >
        <p className="text-[0.62rem] font-mono uppercase tracking-widest text-primary mb-4">Coaching Insights</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              label: 'Talk Ratio Pattern',
              value: stats ? `${stats.avgTalkRatio > 0 ? stats.avgTalkRatio + '%' : 'N/A'}` : 'No data',
              insight:
                stats && stats.avgTalkRatio > 55
                  ? 'You tend to dominate conversations. Focus on asking more questions.'
                  : stats && stats.avgTalkRatio > 0 && stats.avgTalkRatio < 45
                  ? 'Excellent listener. Your talk ratio is in the ideal range.'
                  : 'Your talk ratio is balanced. Keep maintaining two-way dialogue.',
            },
            {
              label: 'Sentiment Trend',
              value: stats ? String(stats.avgSentiment) : 'N/A',
              insight:
                stats && stats.avgSentiment >= 65
                  ? 'Prospects engage well with your approach. Keep it up.'
                  : stats && stats.avgSentiment >= 50
                  ? 'Neutral sentiment overall. Work on building more rapport early.'
                  : 'Low sentiment scores. Review your opening strategy and objection handling.',
            },
            {
              label: 'Score Consistency',
              value: stats ? `${stats.bestScore} best` : 'N/A',
              insight:
                stats && stats.bestScore - stats.avgScore < 15
                  ? 'Consistent performer — your results are predictable and reliable.'
                  : 'High variance in scores. Identify what makes your best calls different.',
            },
          ].map((item) => (
            <div key={item.label} className="p-3 rounded-xl bg-background border border-border">
              <p className="text-[0.62rem] font-mono uppercase tracking-widest text-muted-foreground mb-1">{item.label}</p>
              <p className="font-mono font-bold text-lg text-primary mb-1">{item.value}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.insight}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
