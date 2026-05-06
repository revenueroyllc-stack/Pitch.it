interface TalkRatioBarProps {
  userPct: number;
  prospectPct: number;
  sessionLive: boolean;
}

export function TalkRatioBar({ userPct, prospectPct, sessionLive }: TalkRatioBarProps) {
  const userColor = userPct > 60 ? '#ff4757' : userPct > 50 ? '#c9960c' : '#00c896';
  const prospectColor = '#4a90d9';

  return (
    <div className="rounded-2xl border border-border bg-card p-4" style={{ backdropFilter: 'blur(8px)' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[0.62rem] font-mono uppercase tracking-widest text-primary">Talk / Listen</p>
        {sessionLive && (
          <span className="text-[0.58rem] font-mono text-muted-foreground">Live</span>
        )}
      </div>

      {/* Split bar */}
      <div className="relative h-4 rounded-full overflow-hidden bg-background border border-border">
        <div
          className="absolute left-0 top-0 h-full transition-all duration-700"
          style={{
            width: `${userPct}%`,
            background: `linear-gradient(90deg, ${userColor}cc, ${userColor})`,
          }}
        />
        <div
          className="absolute top-0 h-full transition-all duration-700"
          style={{
            left: `${userPct}%`,
            width: `${prospectPct}%`,
            background: `linear-gradient(90deg, ${prospectColor}cc, ${prospectColor})`,
          }}
        />
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: userColor }} />
          <span className="text-[0.65rem] font-mono text-muted-foreground">You</span>
          <span className="text-[0.65rem] font-mono font-bold" style={{ color: userColor }}>{userPct}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[0.65rem] font-mono font-bold" style={{ color: prospectColor }}>{prospectPct}%</span>
          <span className="text-[0.65rem] font-mono text-muted-foreground">Prospect</span>
          <span className="w-2 h-2 rounded-full" style={{ background: prospectColor }} />
        </div>
      </div>

      {userPct > 60 && (
        <p className="text-[0.6rem] text-[#ff4757] font-semibold mt-1.5 text-center">
          Ask a question — let them talk
        </p>
      )}
    </div>
  );
}
