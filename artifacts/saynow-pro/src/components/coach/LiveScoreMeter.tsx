interface LiveScoreMeterProps {
  score: number;
  isLive: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 75) return '#00c896';
  if (score >= 50) return '#c9960c';
  return '#ff4757';
}

function getScoreLabel(score: number): string {
  if (score >= 85) return 'Elite';
  if (score >= 75) return 'Strong';
  if (score >= 60) return 'Solid';
  if (score >= 45) return 'Building';
  return 'Needs Work';
}

export function LiveScoreMeter({ score, isLive }: LiveScoreMeterProps) {
  const clampedScore = Math.min(99, Math.max(0, score));
  const color = getScoreColor(clampedScore);
  const label = getScoreLabel(clampedScore);

  const circumference = 2 * Math.PI * 40;
  const dashArray = (clampedScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2" data-testid="live-score-meter">
      <div className="relative" style={{ width: 100, height: 100 }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r="40"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="8"
          />
          <circle
            cx="50" cy="50" r="40"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dashArray} ${circumference}`}
            strokeDashoffset={circumference * 0.25}
            style={{
              transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)',
              filter: `drop-shadow(0 0 6px ${color}50)`,
              transformOrigin: '50% 50%',
              transform: 'rotate(-90deg)',
            }}
          />
          <circle cx="50" cy="50" r="30" fill="hsl(var(--card))" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-mono font-bold text-2xl leading-none ${isLive ? 'score-live' : ''}`}
            style={{ color }}
            data-testid="live-score-value"
          >
            {clampedScore}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-mono font-semibold tracking-widest uppercase" style={{ color }}>
          {label}
        </span>
        <span className="text-xs text-muted-foreground">Call score</span>
      </div>
    </div>
  );
}
