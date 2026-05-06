interface IntelligenceStatusProps {
  talkRatio: number;
  prospectSentiment: number;
  liveScore: number;
  questionCount: number;
  timerSeconds: number;
  eventThinking: boolean;
}

type StatusLevel = 'critical' | 'warning' | 'positive' | 'neutral';

interface StatusInfo {
  label: string;
  sub: string;
  level: StatusLevel;
}

function computeStatus(p: IntelligenceStatusProps): StatusInfo {
  if (p.eventThinking) {
    return { label: 'Claude analyzing event...', sub: 'Targeted coaching on the way', level: 'neutral' };
  }
  if (p.talkRatio > 70) {
    return {
      label: `Dominating at ${p.talkRatio}% — stop and ask`,
      sub: 'Let the prospect respond now',
      level: 'critical',
    };
  }
  if (p.prospectSentiment < 28) {
    return {
      label: 'Prospect disengaging',
      sub: 'Sentiment critical — pivot or ask a direct question',
      level: 'critical',
    };
  }
  if (p.talkRatio > 60) {
    return {
      label: 'Balance the dialogue',
      sub: `${p.talkRatio}% talk ratio — pause and invite their response`,
      level: 'warning',
    };
  }
  if (p.timerSeconds > 120 && p.questionCount === 0) {
    return {
      label: 'No discovery questions yet',
      sub: 'Ask an open question before continuing to pitch',
      level: 'warning',
    };
  }
  if (p.prospectSentiment >= 72 && p.liveScore >= 68) {
    return {
      label: 'Close window opening',
      sub: 'Prospect engaged and score strong — move toward the ask',
      level: 'positive',
    };
  }
  if (p.prospectSentiment >= 65) {
    return {
      label: 'Prospect engaged',
      sub: 'Keep listening and build on their momentum',
      level: 'positive',
    };
  }
  if (p.liveScore >= 75) {
    return {
      label: 'Strong call',
      sub: 'Top-range performance — stay consistent',
      level: 'positive',
    };
  }
  if (p.talkRatio >= 40 && p.talkRatio <= 55) {
    return {
      label: 'Ideal dialogue rhythm',
      sub: 'Balanced conversation — excellent pacing',
      level: 'positive',
    };
  }
  return {
    label: 'Monitoring call...',
    sub: 'Real-time signals active — keep speaking',
    level: 'neutral',
  };
}

const LEVEL_STYLES: Record<
  StatusLevel,
  { bg: string; border: string; dot: string; textColor: string }
> = {
  critical: {
    bg: 'rgba(255,71,87,0.07)',
    border: 'rgba(255,71,87,0.32)',
    dot: '#ff4757',
    textColor: '#ff4757',
  },
  warning: {
    bg: 'rgba(201,150,12,0.07)',
    border: 'rgba(201,150,12,0.30)',
    dot: '#c9960c',
    textColor: '#c9960c',
  },
  positive: {
    bg: 'rgba(0,200,150,0.06)',
    border: 'rgba(0,200,150,0.22)',
    dot: '#00c896',
    textColor: '#00c896',
  },
  neutral: {
    bg: 'rgba(255,255,255,0.02)',
    border: 'rgba(255,255,255,0.08)',
    dot: '#666',
    textColor: 'hsl(var(--muted-foreground))',
  },
};

export function IntelligenceStatus(props: IntelligenceStatusProps) {
  const { label, sub, level } = computeStatus(props);
  const s = LEVEL_STYLES[level];

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all duration-700"
      style={{ background: s.bg, borderColor: s.border }}
      data-testid="intelligence-status"
    >
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${level !== 'neutral' ? 'animate-pulse' : ''}`}
        style={{ background: s.dot, boxShadow: `0 0 8px ${s.dot}70` }}
      />
      <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
        <span className="text-sm font-bold leading-tight" style={{ color: s.textColor }}>
          {label}
        </span>
        <span className="text-xs text-muted-foreground leading-tight hidden sm:block truncate">
          {sub}
        </span>
      </div>
      <span className="text-[0.58rem] font-mono text-muted-foreground uppercase tracking-widest shrink-0">
        Live Intel
      </span>
    </div>
  );
}
