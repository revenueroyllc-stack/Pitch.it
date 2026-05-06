import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const TABS = ['Prep', 'Live', 'Dialer', 'Vault', 'Debrief', 'Team', 'Settings'];
const FEATURES = [
  'Deepgram real-time transcription',
  'Claude AI coaching · 8s intervals',
  'Twilio outbound calling',
  'Objection Vault + Battlecards',
  'AI Debrief + Follow-up email',
  'Team leaderboard + badges',
  'Stripe subscriptions + credits',
];

export function Scene7() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2800),
      setTimeout(() => setPhase(4), 4500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.8 }}
    >
      {/* Radial glow behind logo */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '60vw',
          height: '60vw',
          background: 'radial-gradient(circle, rgba(201,150,12,0.12), transparent 65%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ scale: 0.3, opacity: 0 }}
        animate={phase >= 1 ? { scale: 1, opacity: 1 } : { scale: 0.3, opacity: 0 }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Logo mark */}
      <motion.div
        className="text-[5vw] font-black tracking-tighter text-center relative z-10"
        style={{ color: 'var(--brand-gold)' }}
        initial={{ scale: 0.7, opacity: 0, y: 20 }}
        animate={phase >= 2 ? { scale: 1, opacity: 1, y: 0 } : { scale: 0.7, opacity: 0, y: 20 }}
        transition={{ duration: 1, type: 'spring', stiffness: 200, damping: 22 }}
      >
        SAYNOW PRO
      </motion.div>

      <motion.div
        className="font-mono text-xs tracking-[0.4em] text-white/40 mt-3 relative z-10"
        initial={{ opacity: 0 }}
        animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        COACHING, REALIZED.
      </motion.div>

      {/* Tab pills */}
      <motion.div
        className="flex gap-2 mt-10 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6 }}
      >
        {TABS.map((tab, i) => (
          <motion.div
            key={i}
            className="px-4 py-2 rounded-full font-mono text-xs font-bold"
            style={{
              background: 'rgba(201,150,12,0.1)',
              border: '1px solid rgba(201,150,12,0.25)',
              color: 'var(--brand-gold-light)',
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 22 }}
          >
            {tab}
          </motion.div>
        ))}
      </motion.div>

      {/* Feature list */}
      <motion.div
        className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-8 max-w-[60vw] relative z-10"
        initial={{ opacity: 0 }}
        animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.6 }}
      >
        {FEATURES.map((f, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-1.5 text-white/40 font-mono text-[10px]"
            initial={{ opacity: 0, y: 6 }}
            animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
            transition={{ delay: i * 0.06 }}
          >
            <div className="w-1 h-1 rounded-full" style={{ background: 'var(--brand-gold)' }} />
            {f}
          </motion.div>
        ))}
      </motion.div>

      {/* Ambient bottom line */}
      <motion.div
        className="absolute bottom-[8vh] w-[40vw] h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--brand-gold), transparent)' }}
        initial={{ opacity: 0, scaleX: 0 }}
        animate={phase >= 4 ? { opacity: 0.4, scaleX: 1 } : { opacity: 0, scaleX: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      />
    </motion.div>
  );
}
