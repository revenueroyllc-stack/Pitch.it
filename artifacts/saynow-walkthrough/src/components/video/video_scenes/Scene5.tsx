import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const OUTCOMES = ['CLOSED', 'FOLLOW-UP', 'NO INTEREST', 'VOICEMAIL'];

export function Scene5() {
  const [phase, setPhase] = useState(0);
  const [selectedOutcome, setSelectedOutcome] = useState(-1);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1000),
      setTimeout(() => setPhase(2), 3000),
      setTimeout(() => setPhase(3), 5500),
      setTimeout(() => setPhase(4), 7500),
      setTimeout(() => setSelectedOutcome(0), 8200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const outcomeColors: Record<number, string> = { 0: 'var(--brand-green)', 1: 'var(--brand-blue)', 2: 'var(--brand-red)', 3: 'rgba(255,255,255,0.4)' };

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0, rotateY: 90 }}
      animate={{ opacity: 1, rotateY: 0 }}
      exit={{ opacity: 0, rotateY: -90 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      style={{ perspective: 1500 }}
    >
      {/* Right label */}
      <div className="absolute top-[10vh] right-[5vw] text-right z-10 max-w-[26vw]">
        <div className="font-mono text-xs tracking-widest text-brand-gold mb-3">05 // AI DEBRIEF</div>
        <h1 className="text-white text-4xl font-black leading-tight">
          Every Call<br />Makes You<br />Sharper.
        </h1>
      </div>

      {/* Debrief card */}
      <motion.div
        className="absolute left-[5vw] top-[10vh] w-[58vw] h-[78vh] glass-panel rounded-2xl overflow-hidden flex flex-col p-7"
        initial={{ opacity: 0, scale: 0.88 }}
        animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.88 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        {/* Score row */}
        <div className="flex gap-7 mb-6 shrink-0">
          <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
            <svg className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="56" cy="56" r="50" stroke="rgba(255,255,255,0.08)" strokeWidth="7" fill="none" />
              <motion.circle
                cx="56" cy="56" r="50"
                stroke="var(--brand-green)"
                strokeWidth="7"
                fill="none"
                strokeDasharray="314"
                initial={{ strokeDashoffset: 314 }}
                animate={phase >= 1 ? { strokeDashoffset: 314 - 314 * 0.92 } : { strokeDashoffset: 314 }}
                transition={{ duration: 1.8, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute text-center">
              <div className="text-4xl font-black text-white">92</div>
              <div className="text-[9px] font-mono text-white/40">SCORE</div>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-3 gap-3">
            {[
              { grade: 'A', label: 'TALK RATIO', color: 'var(--brand-green)' },
              { grade: 'B+', label: 'SENTIMENT', color: 'var(--brand-gold)' },
              { grade: 'A-', label: 'DISCOVERY', color: 'var(--brand-green)' },
            ].map((g, i) => (
              <motion.div
                key={i}
                className="glass-panel rounded-xl flex flex-col items-center justify-center py-3"
                initial={{ opacity: 0, y: 15 }}
                animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
                transition={{ delay: 0.2 + i * 0.1 }}
              >
                <div className="text-3xl font-black" style={{ color: g.color }}>{g.grade}</div>
                <div className="text-[9px] font-mono text-white/40 mt-1">{g.label}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Strengths / Misses */}
        <motion.div
          className="grid grid-cols-2 gap-5 mb-5"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="glass-panel rounded-xl p-4 border-t-2 border-brand-green">
            <div className="text-brand-green font-bold text-xs mb-2">+ STRENGTHS</div>
            <ul className="text-xs space-y-1.5 text-white/75">
              <li>Strong objection handling on price.</li>
              <li>Talk ratio perfectly balanced at 42%.</li>
              <li>Excellent discovery question cadence.</li>
            </ul>
          </div>
          <div className="glass-panel rounded-xl p-4 border-t-2 border-brand-red">
            <div className="text-brand-red font-bold text-xs mb-2">- MISSES</div>
            <ul className="text-xs space-y-1.5 text-white/75">
              <li>Missed buying signal at 14:20.</li>
              <li>Next steps not confirmed clearly.</li>
              <li>No urgency created around Q3 deadline.</li>
            </ul>
          </div>
        </motion.div>

        {/* Outcome selector */}
        <motion.div
          className="mb-4 shrink-0"
          initial={{ opacity: 0, y: 15 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
          transition={{ duration: 0.5 }}
        >
          <div className="font-mono text-[10px] text-white/40 mb-2">CALL OUTCOME</div>
          <div className="flex gap-2">
            {OUTCOMES.map((o, i) => (
              <motion.div
                key={i}
                className="flex-1 text-center py-2 rounded-lg font-mono text-[10px] font-bold cursor-default"
                style={{
                  background: selectedOutcome === i ? `${outcomeColors[i]}25` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selectedOutcome === i ? outcomeColors[i] : 'rgba(255,255,255,0.08)'}`,
                  color: selectedOutcome === i ? outcomeColors[i] : 'rgba(255,255,255,0.35)',
                  transition: 'all 0.3s ease',
                }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={phase >= 3 ? { opacity: 1, scale: selectedOutcome === i ? 1.03 : 1 } : { opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.06 }}
              >
                {o}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* AI Follow-up email */}
        <motion.div
          className="glass-panel-gold rounded-xl p-4 mt-auto shrink-0"
          initial={{ opacity: 0, y: 15 }}
          animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex justify-between items-center mb-2">
            <div className="text-brand-gold font-bold text-[10px]">AI FOLLOW-UP EMAIL · DRAFTED</div>
            <div className="text-black text-[9px] px-2 py-1 rounded font-bold" style={{ background: 'var(--brand-gold)' }}>READY TO SEND</div>
          </div>
          <div className="text-[11px] text-white/55 font-mono leading-relaxed" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            Hi Sarah, great connecting today. As discussed, our data pipeline migration eliminates the weekly outages and reduces engineering overhead by ~40%. I'd love to set up a 30-min pilot scoping call...
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
