import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export function Scene3() {
  const [phase, setPhase] = useState(0);
  const [dialDigits, setDialDigits] = useState('');

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 2500),
      setTimeout(() => setPhase(3), 4500),
      setTimeout(() => setPhase(4), 6500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  useEffect(() => {
    if (phase < 2) return;
    const number = '+1 (415) 555-0182';
    let i = 0;
    const id = setInterval(() => {
      if (i < number.length) {
        setDialDigits(number.slice(0, i + 1));
        i++;
      } else {
        clearInterval(id);
      }
    }, 55);
    return () => clearInterval(id);
  }, [phase]);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0, scale: 1.05 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Left label */}
      <div className="absolute top-[12vh] left-[5vw] max-w-[26vw] z-10">
        <div className="font-mono text-xs tracking-widest text-brand-gold mb-3">03 // TWILIO DIALER</div>
        <h1 className="text-white text-5xl font-black leading-tight mb-4">
          Call From<br />Inside The<br />Cockpit.
        </h1>
        <motion.p
          className="text-white/50 text-sm leading-relaxed"
          initial={{ opacity: 0 }}
          animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          Outbound calling via Twilio Voice SDK — dial, record, and coach without switching tabs.
        </motion.p>
      </div>

      {/* Dialer panel */}
      <motion.div
        className="absolute right-[10vw] top-[10vh] w-[38vw] h-[78vh] glass-panel rounded-2xl overflow-hidden flex flex-col"
        initial={{ opacity: 0, x: 60, rotateY: 8 }}
        animate={phase >= 1 ? { opacity: 1, x: 0, rotateY: 0 } : { opacity: 0, x: 60, rotateY: 8 }}
        exit={{ opacity: 0, x: 30 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{ perspective: 1000 }}
      >
        {/* Header */}
        <div className="h-11 border-b border-brand-gold/20 flex items-center px-5 gap-3 bg-black/50 shrink-0">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-brand-red" />
            <div className="w-2.5 h-2.5 rounded-full bg-brand-gold" />
            <div className="w-2.5 h-2.5 rounded-full bg-brand-green" />
          </div>
          <div className="ml-auto font-mono text-[10px] text-brand-gold/50">DIALER PANEL · TWILIO</div>
        </div>

        <div className="flex-1 flex flex-col p-6 gap-5">
          {/* Number display */}
          <motion.div
            className="glass-panel rounded-xl p-4 text-center"
            initial={{ opacity: 0 }}
            animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
          >
            <div className="font-mono text-[10px] text-white/40 mb-2">CALLING</div>
            <div className="font-mono text-2xl font-bold text-brand-gold tracking-widest min-h-[2rem]">
              {dialDigits || <span className="text-white/20">—</span>}
            </div>
          </motion.div>

          {/* Dial pad */}
          <motion.div
            className="grid grid-cols-3 gap-2"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {DIAL_KEYS.map((k, i) => (
              <motion.div
                key={k}
                className="h-10 rounded-lg flex items-center justify-center font-mono text-sm font-bold cursor-default"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                whileHover={{ background: 'rgba(255,255,255,0.1)' }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
                transition={{ delay: 0.3 + i * 0.02 }}
              >
                {k}
              </motion.div>
            ))}
          </motion.div>

          {/* Call button / active state */}
          <motion.div
            className="rounded-xl p-5 flex flex-col items-center gap-3"
            style={{
              background: phase >= 3 ? 'rgba(255,71,87,0.15)' : 'rgba(0,200,150,0.15)',
              border: phase >= 3 ? '1px solid rgba(255,71,87,0.3)' : '1px solid rgba(0,200,150,0.3)',
              transition: 'all 0.5s ease',
            }}
            initial={{ opacity: 0 }}
            animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {phase < 3 ? (
              <>
                <div className="font-mono text-[10px] text-brand-green">READY TO DIAL</div>
                <div className="w-14 h-14 rounded-full bg-brand-green/20 flex items-center justify-center">
                  <svg className="w-7 h-7 text-brand-green" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
                  </svg>
                </div>
                <div className="text-xs text-brand-green font-mono">CALL SARAH JENKINS</div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <motion.div
                    className="w-2 h-2 rounded-full bg-brand-red"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  />
                  <div className="font-mono text-xs text-brand-red">CALL ACTIVE · 01:47</div>
                </div>
                <div className="flex gap-2 font-mono text-[10px]">
                  <div className="px-3 py-1.5 rounded" style={{ background: 'rgba(255,255,255,0.1)' }}>MUTE</div>
                  <div className="px-3 py-1.5 rounded" style={{ background: 'rgba(255,255,255,0.1)' }}>HOLD</div>
                  <div className="px-3 py-1.5 rounded bg-brand-red/30 text-brand-red">END</div>
                </div>
              </>
            )}
          </motion.div>

          {/* Recording indicator */}
          <motion.div
            className="rounded-xl p-4 flex items-center gap-3"
            style={{ background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.2)' }}
            initial={{ opacity: 0 }}
            animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="w-3 h-3 rounded-full bg-brand-red shrink-0"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
            <div>
              <div className="font-mono text-[10px] text-brand-red font-bold">RECORDING ACTIVE</div>
              <div className="text-[10px] text-white/40 font-mono">Stored in call vault · AI coaching live</div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
