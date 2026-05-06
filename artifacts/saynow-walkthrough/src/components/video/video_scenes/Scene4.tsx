import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const CARDS = [
  { title: 'Price Too High', hex: '#ff4757', delay: 0 },
  { title: 'Competitor X', hex: '#4a90d9', delay: 0.1 },
  { title: 'Not Now', hex: '#c9960c', delay: 0.2 },
  { title: 'Missing Feature', hex: '#00c896', delay: 0.3 },
];

const BATTLECARDS = [
  { name: 'Salesforce', position: 'Enterprise CRM', win: 'Cost + speed' },
  { name: 'HubSpot', position: 'SMB / Marketing', win: 'AI depth' },
];

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1000),
      setTimeout(() => setPhase(2), 2800),
      setTimeout(() => setPhase(3), 5000),
      setTimeout(() => setPhase(4), 7500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center overflow-hidden"
      initial={{ opacity: 0, scale: 1.08 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header */}
      <div className="mt-[8vh] text-center z-10">
        <motion.div
          className="font-mono text-xs tracking-widest text-brand-gold mb-2"
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          04 // OBJECTION VAULT
        </motion.div>
        <motion.h1
          className="text-white text-4xl font-black"
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          Never Freeze Again.
        </motion.h1>
      </div>

      {/* Objection Cards */}
      <div className="mt-[4vh] w-[88vw] h-[42vh] flex gap-4" style={{ perspective: '1000px' }}>
        {CARDS.map((card, i) => (
          <motion.div
            key={i}
            className="flex-1 glass-panel rounded-2xl p-5 flex flex-col relative overflow-hidden"
            initial={{ opacity: 0, rotateX: -25, y: 40 }}
            animate={phase >= 1 ? { opacity: 1, rotateX: 0, y: 0 } : { opacity: 0, rotateX: -25, y: 40 }}
            exit={{ opacity: 0, y: 25 }}
            transition={{ duration: 0.7, delay: card.delay, type: 'spring', stiffness: 220, damping: 22 }}
          >
            <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: card.hex }} />
            <div className="text-base font-bold mb-3">{card.title}</div>

            <motion.div
              className="space-y-3 flex-1"
              initial={{ opacity: 0 }}
              animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
              transition={{ delay: card.delay + 0.3 }}
            >
              <div className="p-3 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="text-white/40 text-[10px] mb-1">STRATEGY</div>
                <div>Acknowledge · Isolate · Pivot to value</div>
              </div>
              <div
                className="p-3 rounded-lg text-xs"
                style={{ background: `${card.hex}14`, border: `1px solid ${card.hex}35` }}
              >
                <div className="text-[10px] mb-1 font-bold" style={{ color: card.hex }}>TALK TRACK</div>
                <div>"Besides that — does our solution solve the core problem?"</div>
              </div>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Competitor Battlecards */}
      <motion.div
        className="mt-4 w-[88vw] flex gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.5 }}
      >
        <div className="font-mono text-[10px] text-white/40 flex items-center pr-3">BATTLECARDS</div>
        {BATTLECARDS.map((bc, i) => (
          <motion.div
            key={i}
            className="flex-1 glass-panel rounded-xl p-4 flex items-center justify-between"
            initial={{ opacity: 0, x: 15 }}
            animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 15 }}
            transition={{ delay: i * 0.1 }}
          >
            <div>
              <div className="font-bold text-sm">{bc.name}</div>
              <div className="text-[10px] text-white/40">{bc.position}</div>
            </div>
            <div className="text-[10px] px-2 py-1 rounded font-mono" style={{ background: 'rgba(0,200,150,0.15)', color: 'var(--brand-green)' }}>
              WIN: {bc.win}
            </div>
          </motion.div>
        ))}
        <motion.div
          className="flex items-center gap-2 px-4 glass-panel rounded-xl"
          initial={{ opacity: 0 }}
          animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
          <div className="font-mono text-[10px] text-brand-gold">+12 MORE</div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
