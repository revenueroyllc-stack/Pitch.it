import { useRef, useCallback } from 'react';

export function useAudioFeedback() {
  const ctxRef = useRef<AudioContext | null>(null);

  function getCtx(): AudioContext {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }

  const playTone = useCallback(
    (freq: number, durationS: number, vol = 0.12, type: OscillatorType = 'sine') => {
      try {
        const ctx = getCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationS);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + durationS + 0.01);
      } catch {
        // AudioContext may be blocked before user gesture
      }
    },
    []
  );

  const pingCoach = useCallback(() => {
    playTone(880, 0.12, 0.1);
    setTimeout(() => playTone(1108, 0.1, 0.06), 90);
  }, [playTone]);

  const pingWarning = useCallback(() => {
    playTone(440, 0.1, 0.18, 'square');
    setTimeout(() => playTone(554, 0.18, 0.1, 'sine'), 110);
  }, [playTone]);

  const pingStart = useCallback(() => {
    playTone(523, 0.07, 0.09);
    setTimeout(() => playTone(659, 0.07, 0.09), 75);
    setTimeout(() => playTone(784, 0.14, 0.11), 150);
  }, [playTone]);

  const pingStop = useCallback(() => {
    playTone(784, 0.07, 0.09);
    setTimeout(() => playTone(523, 0.14, 0.07), 75);
  }, [playTone]);

  return { pingCoach, pingWarning, pingStart, pingStop };
}
