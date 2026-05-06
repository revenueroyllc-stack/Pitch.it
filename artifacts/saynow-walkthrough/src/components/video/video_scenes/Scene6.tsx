import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const LEADERBOARD = [
  { rank: 1, name: 'Alex R.', role: 'REP', score: 94, trend: '+4', color: 'var(--brand-gold)' },
  { rank: 2, name: 'Sam K.', role: 'MANAGER', score: 88, trend: '+1', color: 'var(--brand-blue)' },
  { rank: 3, name: 'Jamie L.', role: 'REP', score: 85, trend: '+6', color: 'var(--brand-green)' },
  { rank: 4, name: 'Dana M.', role: 'REP', score: 79, trend: '-2', color: 'rgba(255,255,255,0.4)' },
];

const NOTIFICATIONS = [
  { type: 'badge', text: 'Alex unlocked "Closer" badge · 94 avg score', icon: '★', color: 'var(--brand-gold)' },
  { type: 'alert', text: 'Jamie: 3 calls without next-step confirmation', icon: '!', color: 'var(--brand-red)' },
  { type: 'team', text: 'Team average this week: 85.5 (+3.2)', icon: '↑', color: 'var(--brand-green)' },
];

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1000),
      setTimeout(() => setPhase(2), 3000),
      setTimeout(() => setPhase(3), 5500),
      setTimeout(() => setPhase(4), 8500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0, x: -60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 60 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Top label */}
      <div className="absolute top-[8vh] left-[5vw] z-10">
        <div className="font-mono text-xs tracking-widest text-brand-gold mb-2">06 // TEAM &amp; SCALE</div>
        <h1 className="text-white text-4xl font-black leading-tight">Coach<br />The Whole Org.</h1>
      </div>

      {/* Main layout */}
      <div className="absolute top-[22vh] left-[5vw] right-[5vw] bottom-[5vh] flex gap-5">
        {/* Leaderboard */}
        <motion.div
          className="w-[40vw] glass-panel rounded-2xl overflow-hidden flex flex-col shrink-0"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
        >
          <div className="h-11 border-b border-brand-gold/20 flex items-center px-5 gap-3 bg-black/40 shrink-0">
            <div className="text-sm font-bold">TEAM LEADERBOARD</div>
            <div className="ml-auto text-[10px] font-mono px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.08)' }}>Q3 2024</div>
          </div>
          <div className="flex-1 p-5 flex flex-col gap-3">
            {LEADERBOARD.map((u, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-3 p-3 glass-panel rounded-xl"
                initial={{ opacity: 0, x: -20 }}
                animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="font-mono text-xl font-black w-5 text-white/30">{u.rank}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{u.name}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>{u.role}</span>
                  </div>
                </div>
                <div className="text-xl font-black" style={{ color: u.color }}>{u.score}</div>
                <div className="font-mono text-[10px] w-10 text-right" style={{ color: u.trend.startsWith('+') ? 'var(--brand-green)' : 'var(--brand-red)' }}>{u.trend}</div>
              </motion.div>
            ))}

            {/* Avg bar */}
            <motion.div
              className="mt-auto glass-panel rounded-xl p-4"
              initial={{ opacity: 0 }}
              animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex justify-between font-mono text-[10px] text-white/50 mb-2">
                <span>TEAM AVG SCORE</span><span>85.5</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, var(--brand-gold), var(--brand-green))' }}
                  initial={{ width: 0 }}
                  animate={phase >= 3 ? { width: '85.5%' } : { width: 0 }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Right column */}
        <div className="flex-1 flex flex-col gap-5">
          {/* Notifications */}
          <motion.div
            className="flex-1 glass-panel rounded-2xl overflow-hidden flex flex-col"
            initial={{ opacity: 0, x: 30 }}
            animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <div className="h-11 border-b border-brand-gold/20 flex items-center px-5 shrink-0 bg-black/40">
              <div className="text-sm font-bold">NOTIFICATION INBOX</div>
              <div className="ml-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-black" style={{ background: 'var(--brand-gold)' }}>3</div>
            </div>
            <div className="flex-1 p-4 flex flex-col gap-3">
              {NOTIFICATIONS.map((n, i) => (
                <motion.div
                  key={i}
                  className="glass-panel rounded-xl p-4 flex items-start gap-3"
                  initial={{ opacity: 0, y: 15 }}
                  animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
                  transition={{ delay: 0.3 + i * 0.12 }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: `${n.color}20`, color: n.color }}
                  >
                    {n.icon}
                  </div>
                  <div className="text-[11px] text-white/75 leading-snug">{n.text}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Profile badges */}
          <motion.div
            className="glass-panel rounded-2xl p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
          >
            <div className="font-mono text-[10px] text-white/40 mb-3">PERFORMANCE BADGES</div>
            <div className="flex gap-3">
              {[
                { label: 'Closer', color: 'var(--brand-gold)' },
                { label: 'No Filler', color: 'var(--brand-green)' },
                { label: 'Top Ratio', color: 'var(--brand-blue)' },
                { label: 'Streak x7', color: 'var(--brand-red)' },
              ].map((b, i) => (
                <motion.div
                  key={i}
                  className="flex-1 text-center py-2 rounded-lg font-mono text-[10px] font-bold"
                  style={{ background: `${b.color}15`, border: `1px solid ${b.color}30`, color: b.color }}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={phase >= 4 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
                  transition={{ delay: i * 0.07, type: 'spring', stiffness: 300, damping: 20 }}
                >
                  {b.label}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
