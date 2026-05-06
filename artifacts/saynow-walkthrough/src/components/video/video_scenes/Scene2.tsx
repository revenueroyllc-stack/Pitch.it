import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const TRANSCRIPT = [
  { speaker: 'YOU', text: 'How is your team managing the data pipeline right now?', delay: 0 },
  { speaker: 'SARAH', text: 'Honestly — custom scripts everywhere. Breaks weekly, costs us hours.', delay: 1200 },
  { speaker: 'YOU', text: "What's the downstream cost when it goes down?", delay: 2800 },
];

const SIGNAL_FLOW = [
  { label: 'PAIN SIGNAL', color: '#ff4757' },
  { label: 'ESCALATE → AI', color: '#c9960c' },
  { label: 'COACHING CARD', color: '#00c896' },
];

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1000),
      setTimeout(() => setPhase(2), 3000),
      setTimeout(() => setPhase(3), 5500),
      setTimeout(() => setPhase(4), 8000),
      setTimeout(() => setPhase(5), 11000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0, y: 80 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -80 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Top label */}
      <div className="absolute top-[8vh] left-[5vw] z-10">
        <div className="font-mono text-xs tracking-widest text-brand-gold mb-2">02 // LIVE COACHING</div>
        <h1 className="text-white text-4xl font-black leading-tight">Real-Time<br />Intelligence.</h1>
      </div>

      {/* Live call header */}
      <motion.div
        className="absolute top-[8vh] right-[5vw] flex items-center gap-3 z-10"
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          className="w-2 h-2 rounded-full bg-brand-red"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
        />
        <span className="font-mono text-sm text-brand-red font-bold">LIVE · 04:32</span>
      </motion.div>

      {/* Main layout */}
      <div className="absolute top-[20vh] left-[5vw] right-[5vw] bottom-[4vh] flex gap-4">
        {/* Transcript column */}
        <motion.div
          className="flex-1 glass-panel rounded-2xl overflow-hidden flex flex-col"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.6 }}
        >
          <div className="h-10 border-b border-brand-red/20 flex items-center px-5 gap-3 bg-brand-red/8 shrink-0">
            <div className="flex gap-0.5 items-end">
              {[8, 16, 10, 20, 12, 18, 8].map((h, i) => (
                <motion.div
                  key={i}
                  className="w-1 rounded-full bg-brand-red"
                  animate={{ height: [`${h}px`, `${h * 1.8}px`, `${h}px`] }}
                  transition={{ repeat: Infinity, duration: 0.4 + i * 0.07, delay: i * 0.05 }}
                />
              ))}
            </div>
            <span className="font-mono text-xs text-white/50">DEEPGRAM · LIVE TRANSCRIPT</span>
          </div>

          <div className="flex-1 p-5 flex flex-col gap-3 overflow-hidden">
            {TRANSCRIPT.map((line, i) => (
              <motion.div
                key={i}
                className="glass-panel p-4 rounded-xl"
                style={line.speaker === 'SARAH' ? { borderColor: 'rgba(201,150,12,0.3)' } : undefined}
                initial={{ opacity: 0, x: line.speaker === 'YOU' ? -20 : 20 }}
                animate={phase >= 1 + i ? { opacity: 1, x: 0 } : { opacity: 0, x: line.speaker === 'YOU' ? -20 : 20 }}
                transition={{ duration: 0.5 }}
              >
                <div
                  className="font-bold text-[10px] mb-1 font-mono"
                  style={{ color: line.speaker === 'YOU' ? 'var(--brand-blue)' : 'var(--brand-gold)' }}
                >
                  {line.speaker}
                </div>
                <div className="text-sm text-white/85">{line.text}</div>
              </motion.div>
            ))}

            {/* AI Card */}
            <motion.div
              className="mt-auto rounded-xl p-5 text-black"
              style={{
                background: 'var(--brand-gold)',
                boxShadow: '0 0 30px rgba(201,150,12,0.5)',
              }}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={phase >= 4 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 40, scale: 0.95 }}
              transition={{ duration: 0.6, type: 'spring', stiffness: 250, damping: 25 }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm">AI COACHING · 8s INTERVAL</span>
                <span className="font-mono text-[10px] opacity-70">ESCALATED VIA DECISION ENGINE</span>
              </div>
              <div className="text-base font-semibold leading-snug">
                "How many engineer-hours go into fixing pipeline failures each month?"
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Metrics sidebar */}
        <div className="w-52 flex flex-col gap-4 shrink-0">
          {/* Score */}
          <motion.div
            className="glass-panel rounded-xl p-5 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
          >
            <div className="font-mono text-[10px] text-white/50 mb-1">CALL SCORE</div>
            <motion.div
              className="text-5xl font-black text-brand-green"
              animate={phase >= 3 ? { opacity: [1, 0.85, 1] } : {}}
              transition={{ repeat: Infinity, duration: 2.5 }}
            >
              87
            </motion.div>
          </motion.div>

          {/* Sentiment */}
          <motion.div
            className="glass-panel rounded-xl p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="font-mono text-[10px] text-white/50 mb-3">SENTIMENT DUAL</div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[10px] font-mono mb-1">
                  <span className="text-brand-blue">YOU</span>
                  <span>CONFIDENT</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <motion.div
                    className="h-full rounded-full bg-brand-blue"
                    initial={{ width: 0 }}
                    animate={phase >= 3 ? { width: '75%' } : { width: 0 }}
                    transition={{ duration: 1 }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-mono mb-1">
                  <span className="text-brand-gold">PROSPECT</span>
                  <span>POSITIVE</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <motion.div
                    className="h-full rounded-full bg-brand-gold"
                    initial={{ width: 0 }}
                    animate={phase >= 3 ? { width: '68%' } : { width: 0 }}
                    transition={{ duration: 1, delay: 0.2 }}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Talk Ratio */}
          <motion.div
            className="glass-panel rounded-xl p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="font-mono text-[10px] text-white/50 mb-3 text-center">TALK RATIO</div>
            <div className="flex h-4 rounded-full overflow-hidden mb-2">
              <motion.div
                style={{ background: 'var(--brand-blue)' }}
                initial={{ width: '0%' }}
                animate={phase >= 3 ? { width: '42%' } : { width: '0%' }}
                transition={{ duration: 1.2 }}
              />
              <motion.div
                style={{ background: 'var(--brand-gold)' }}
                initial={{ width: '0%' }}
                animate={phase >= 3 ? { width: '58%' } : { width: '0%' }}
                transition={{ duration: 1.2 }}
              />
            </div>
            <div className="flex justify-between font-mono text-xs">
              <span className="text-brand-blue">42% YOU</span>
              <span className="text-brand-gold">58% THEM</span>
            </div>
          </motion.div>

          {/* Decision Engine */}
          <motion.div
            className="glass-panel rounded-xl p-4 flex-1"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
          >
            <div className="font-mono text-[10px] text-white/50 mb-3">DECISION ENGINE</div>
            <div className="flex flex-col gap-2">
              {SIGNAL_FLOW.map((s, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={phase >= 4 ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
                  transition={{ delay: i * 0.15 }}
                >
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <div className="text-[10px] font-mono" style={{ color: s.color }}>{s.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
