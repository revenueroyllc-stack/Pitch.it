import { useRef, useCallback, useEffect } from 'react';
import type { CoachCard } from './coach';

export function useVoiceCoach(enabled: boolean) {
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const lastSpokenKeyRef = useRef<string>('');
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    return () => {
      synthRef.current?.cancel();
    };
  }, []);

  const speakCard = useCallback((card: CoachCard) => {
    if (!enabled) return;
    const synth = synthRef.current;
    if (!synth) return;

    const key = `${card.tone}:${card.text.slice(0, 60)}`;
    if (lastSpokenKeyRef.current === key) return;
    lastSpokenKeyRef.current = key;

    synth.cancel();

    const prefix =
      card.type === 'Warning' ? 'Heads up. ' :
      card.type === 'Battlecard' ? 'Battlecard. ' :
      card.type === 'Response' ? 'Try saying: ' :
      card.type === 'Question' ? 'Ask them: ' :
      '';

    const raw = card.text.length > 120 ? card.text.slice(0, 117) + '...' : card.text;
    const utter = new SpeechSynthesisUtterance(prefix + raw);

    // Priority-based delivery — warnings are faster + sharper, tips are calmer
    const urgency: Record<string, { rate: number; pitch: number; volume: number }> = {
      warning:    { rate: 1.18, pitch: 1.12, volume: 1.0  },
      battlecard: { rate: 1.12, pitch: 1.06, volume: 0.95 },
      response:   { rate: 1.06, pitch: 1.02, volume: 0.90 },
      question:   { rate: 1.02, pitch: 1.00, volume: 0.85 },
      tip:        { rate: 0.96, pitch: 0.97, volume: 0.78 },
    };
    const cfg = urgency[card.tone] ?? { rate: 1.0, pitch: 1.0, volume: 0.82 };
    utter.rate   = cfg.rate;
    utter.pitch  = cfg.pitch;
    utter.volume = cfg.volume;
    utterRef.current = utter;
    synth.speak(utter);
  }, [enabled]);

  const silence = useCallback(() => {
    synthRef.current?.cancel();
    lastSpokenKeyRef.current = '';
  }, []);

  return { speakCard, silence };
}
