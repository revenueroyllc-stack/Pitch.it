import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 2500),
      setTimeout(() => setPhase(3), 4200),
      setTimeout(() => setPhase(4), 6500),
      setTimeout(() => setPhase(5), 9000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex overflow-hidden"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Left label */}
      <div className="absolute top-[12vh] left-[5vw] max-w-[26vw] z-10">
        <motion.div
          className="font-mono text-xs tracking-widest text-brand-gold mb-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          01 // PRE-CALL PREP
        </motion.div>
        <motion.h1
          className="text-white text-5xl font-black leading-tight mb-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 25 }}
        >
          Intelligence<br />Before<br />The Ring.
        </motion.h1>
        <motion.div
          className="space-y-2 font-mono text-xs text-white/50"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {['Prospect Intel', 'AI Battle Brief', 'Talking Points', 'Objection Prep'].map((item, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -10 }}
              animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
              transition={{ delay: 0.5 + i * 0.08 }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-brand-gold/60" />
              {item}
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* App UI panel */}
      <motion.div
        className="absolute right-[4vw] top-[10vh] w-[60vw] h-[78vh] glass-panel rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        initial={{ opacity: 0, x: 80, rotateY: 10 }}
        animate={{ opacity: 1, x: 0, rotateY: 0 }}
        exit={{ opacity: 0, x: 40 }}
        transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ perspective: 1200 }}
      >
        {/* Title bar */}
        <div className="h-11 border-b border-brand-gold/20 flex items-center px-5 gap-3 bg-black/50 shrink-0">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-brand-red" />
            <div className="w-2.5 h-2.5 rounded-full bg-brand-gold" />
            <div className="w-2.5 h-2.5 rounded-full bg-brand-green" />
          </div>
          <div className="ml-auto font-mono text-xs text-brand-gold/50">SAYNOW_PRO // PREP</div>
        </div>

        <div className="p-6 flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Prospect Intel */}
          <motion.div
            className="glass-panel rounded-xl p-5 shrink-0"
            initial={{ opacity: 0, y: 15 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-brand-gold font-mono text-[10px] mb-2 tracking-wider">PROSPECT INTEL</div>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xl font-bold">Sarah Jenkins</div>
                <div className="text-white/50 text-sm">VP of Engineering · TechCorp · Series B</div>
              </div>
              <div className="flex gap-2">
                <div className="bg-brand-blue/20 text-brand-blue px-2 py-1 rounded text-[10px] font-mono">DECISION MAKER</div>
                <div className="bg-brand-green/20 text-brand-green px-2 py-1 rounded text-[10px] font-mono">HIGH INTENT</div>
              </div>
            </div>
          </motion.div>

          <div className="flex gap-4 flex-1 min-h-0">
            {/* Battle Brief */}
            <motion.div
              className="flex-1 glass-panel rounded-xl p-5 border border-brand-gold/25 relative overflow-hidden"
              initial={{ opacity: 0, y: 15 }}
              animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
              transition={{ duration: 0.5 }}
            >
              <div className="absolute top-0 left-0 w-0.5 h-full bg-brand-gold" style={{ boxShadow: '0 0 12px var(--brand-gold)' }} />
              <div className="flex justify-between items-center mb-3">
                <div className="text-brand-gold-light font-bold text-sm flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                  AI BATTLE BRIEF
                </div>
                <div className="font-mono text-[10px] text-brand-gold">GENERATED 0.4s</div>
              </div>
              <div className="space-y-2 font-mono text-xs text-white/75">
                {[
                  '> Objective: Secure pilot program agreement',
                  '> Pain: Legacy pipeline breaks weekly (-$40k)',
                  '> Hook: Zero-downtime API migration story',
                  '> Risk: Q3 budget freeze — move fast',
                  '> Champion: CTO backing the initiative',
                ].map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
                    transition={{ delay: i * 0.07 }}
                  >
                    {line}
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Talking Points + Objection Prep */}
            <div className="w-56 flex flex-col gap-4 shrink-0">
              <motion.div
                className="glass-panel rounded-xl p-4"
                initial={{ opacity: 0, x: 15 }}
                animate={phase >= 4 ? { opacity: 1, x: 0 } : { opacity: 0, x: 15 }}
                transition={{ duration: 0.5 }}
              >
                <div className="text-brand-blue font-mono text-[10px] mb-3 tracking-wider">TALKING POINTS</div>
                <div className="space-y-2">
                  {['Zero-downtime migration', 'Real-time monitoring', 'SOC 2 compliant'].map((pt, i) => (
                    <motion.div
                      key={i}
                      className="text-xs flex items-center gap-2"
                      initial={{ opacity: 0 }}
                      animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
                      transition={{ delay: 0.1 + i * 0.1 }}
                    >
                      <div className="w-1 h-1 rounded-full bg-brand-blue/80 shrink-0" />
                      {pt}
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                className="glass-panel rounded-xl p-4 flex-1"
                initial={{ opacity: 0, x: 15 }}
                animate={phase >= 5 ? { opacity: 1, x: 0 } : { opacity: 0, x: 15 }}
                transition={{ duration: 0.5 }}
              >
                <div className="text-brand-red font-mono text-[10px] mb-3 tracking-wider">OBJECTION PREP</div>
                <div className="space-y-2">
                  {['Price pushback', 'Competitor comparison', 'Timeline concern'].map((obj, i) => (
                    <motion.div
                      key={i}
                      className="text-[11px] flex items-center gap-2"
                      initial={{ opacity: 0 }}
                      animate={phase >= 5 ? { opacity: 1 } : { opacity: 0 }}
                      transition={{ delay: 0.1 + i * 0.1 }}
                    >
                      <div className="w-1 h-1 rounded-full bg-brand-red/80 shrink-0" />
                      {obj}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
