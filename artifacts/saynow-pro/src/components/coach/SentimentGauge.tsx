interface SentimentGaugeProps {
  value: number;
  isLive: boolean;
  label?: string;
}

function getSentimentLabel(value: number): string {
  if (value >= 72) return 'Warming Up';
  if (value >= 55) return 'Engaged';
  if (value >= 40) return 'Neutral';
  if (value >= 25) return 'Cooling Down';
  return 'Disengaged';
}

function getSentimentColor(value: number): string {
  if (value >= 65) return '#00c896';
  if (value >= 45) return '#f5d97e';
  return '#ff4757';
}

export function SentimentGauge({ value, isLive, label }: SentimentGaugeProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const color = getSentimentColor(clampedValue);
  const sentimentLabel = getSentimentLabel(clampedValue);

  const radius = 54;
  const circumference = Math.PI * radius;
  const dashArray = (clampedValue / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2" data-testid="sentiment-gauge">
      <div className="relative" style={{ width: 140, height: 80 }}>
        <svg width="140" height="80" viewBox="0 0 140 80">
          <path
            d="M 10 70 A 60 60 0 0 1 130 70"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M 10 70 A 60 60 0 0 1 130 70"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dashArray} ${circumference}`}
            className="sentiment-arc"
            style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span
            className="font-mono font-bold text-xl leading-none"
            style={{ color }}
            data-testid="sentiment-value"
          >
            {clampedValue}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-mono font-semibold tracking-widest uppercase" style={{ color }}>
          {sentimentLabel}
        </span>
        <span className="text-xs text-muted-foreground">
          {label ?? (isLive ? 'Live sentiment' : 'Last reading')}
        </span>
      </div>
    </div>
  );
}
