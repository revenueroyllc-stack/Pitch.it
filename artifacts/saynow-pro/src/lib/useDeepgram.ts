import { useEffect, useRef, useCallback } from 'react';
import { detectCompetitor, type TranscriptEntry, type Objection } from './coach';

export type MicStatus = 'idle' | 'listening' | 'blocked' | 'unsupported' | 'error' | 'connecting';

export interface EventTrigger {
  type: 'objection' | 'silence' | 'competitor' | 'no-question' | 'talk-ratio-warning' | 'filler-spike';
  utterance?: string;
  competitor?: string;
  timestamp: string;
}

interface UseDeepgramOptions {
  sessionLive: boolean;
  talkingPoints: string[];
  objections: Objection[];
  onTranscript: (entry: TranscriptEntry) => void;
  onInterim: (text: string) => void;
  onMicStatus: (status: MicStatus) => void;
  onUserSentiment: (score: number) => void;
  onProspectSentiment: (score: number) => void;
  onEventTrigger: (trigger: EventTrigger) => void;
  formatTime: (secs: number) => string;
  timerSecondsRef: React.MutableRefObject<number>;
}

const OBJECTION_KEYWORDS = [
  'too expensive', 'not interested', 'already have', 'need to think',
  'not in the budget', 'call me back', 'send me an email',
  'no budget', 'too much', 'can\'t afford', 'not ready', 'not now',
  'maybe later', 'next quarter', 'thinking about it', 'shop around',
  'just looking', 'not a priority', 'don\'t have the budget',
  'already using', 'happy with what we have', 'not the right time',
];

const FILLER_WORDS = ['um', 'uh', 'like', 'basically', 'literally', 'actually', 'honestly', 'right', 'so'];

const SILENCE_THRESHOLD_MS = 5000;
const QUESTION_SILENCE_THRESHOLD_S = 240; // 4 minutes

function detectObjection(text: string): boolean {
  const lower = text.toLowerCase();
  return OBJECTION_KEYWORDS.some((kw) => lower.includes(kw));
}

function countFillerWords(text: string): number {
  const words = text.toLowerCase().split(/\s+/);
  return words.filter((w) => FILLER_WORDS.includes(w)).length;
}

function parseSentimentScore(sentiment: unknown): number {
  if (!sentiment || typeof sentiment !== 'object') return 50;
  const s = sentiment as { sentiment?: string; sentiment_score?: number };
  if (s.sentiment_score !== undefined) {
    return Math.round((s.sentiment_score + 1) * 50);
  }
  if (s.sentiment === 'positive') return 75;
  if (s.sentiment === 'negative') return 25;
  return 50;
}

export function useDeepgram(opts: UseDeepgramOptions) {
  const {
    sessionLive,
    onTranscript,
    onInterim,
    onMicStatus,
    onUserSentiment,
    onProspectSentiment,
    onEventTrigger,
    formatTime,
    timerSecondsRef,
  } = opts;

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const silenceFiredRef = useRef(false);
  const lastQuestionTimeRef = useRef<number>(0);
  const questionCountRef = useRef(0);
  const usingWebSpeech = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wsRecRef = useRef<any>(null);
  const shouldRestartWSRef = useRef(false);
  const objectionFiredUtterancesRef = useRef<Set<string>>(new Set());
  const competitorFiredRef = useRef<Set<string>>(new Set());
  const fillerSpikeCountRef = useRef(0);

  // Stable callback refs so effect doesn't re-run on re-render
  const cbRefs = useRef({
    onTranscript,
    onInterim,
    onMicStatus,
    onUserSentiment,
    onProspectSentiment,
    onEventTrigger,
    formatTime,
    timerSecondsRef,
  });
  useEffect(() => {
    cbRefs.current = { onTranscript, onInterim, onMicStatus, onUserSentiment, onProspectSentiment, onEventTrigger, formatTime, timerSecondsRef };
  });

  const handleFinalUtterance = useCallback((text: string, speaker: number, sentiment?: unknown) => {
    if (!text.trim()) return;
    const cb = cbRefs.current;
    const ts = cb.formatTime(cb.timerSecondsRef.current);
    const speakerLabel = speaker === 0 ? 'You' : 'Prospect';
    const entry: TranscriptEntry = { speaker: speakerLabel, text: text.trim(), timestamp: ts };
    cb.onTranscript(entry);

    // Update sentiment per speaker
    const sentimentScore = parseSentimentScore(sentiment);
    if (speaker === 0) cb.onUserSentiment(sentimentScore);
    else cb.onProspectSentiment(sentimentScore);

    // Reset silence
    lastSpeechTimeRef.current = Date.now();
    silenceFiredRef.current = false;

    // Question tracking
    if (text.includes('?')) {
      questionCountRef.current += 1;
      lastQuestionTimeRef.current = cb.timerSecondsRef.current;
    }

    // Objection detection (user speech only)
    if (speaker === 0) {
      const key = text.trim().slice(0, 60);
      if (detectObjection(text) && !objectionFiredUtterancesRef.current.has(key)) {
        objectionFiredUtterancesRef.current.add(key);
        cb.onEventTrigger({ type: 'objection', utterance: text.trim(), timestamp: ts });
      }

      // Competitor detection
      const competitor = detectCompetitor(text);
      if (competitor && !competitorFiredRef.current.has(competitor + ts.slice(0, 2))) {
        competitorFiredRef.current.add(competitor + ts.slice(0, 2));
        cb.onEventTrigger({ type: 'competitor', competitor, utterance: text.trim(), timestamp: ts });
      }

      // Filler word spike detection — 3+ fillers in one utterance, fires after 2 such utterances
      if (countFillerWords(text) >= 3) {
        fillerSpikeCountRef.current += 1;
        if (fillerSpikeCountRef.current >= 2) {
          fillerSpikeCountRef.current = 0;
          cb.onEventTrigger({ type: 'filler-spike', utterance: text.trim(), timestamp: ts });
        }
      }
    }
  }, []);

  // Silence detection loop
  useEffect(() => {
    if (!sessionLive) return;
    silenceFiredRef.current = false;
    lastSpeechTimeRef.current = Date.now();
    questionCountRef.current = 0;
    lastQuestionTimeRef.current = 0;
    objectionFiredUtterancesRef.current.clear();
    competitorFiredRef.current.clear();
    fillerSpikeCountRef.current = 0;

    silenceTimerRef.current = setInterval(() => {
      const cb = cbRefs.current;
      const now = Date.now();
      const silenceSec = (now - lastSpeechTimeRef.current) / 1000;
      const elapsed = cb.timerSecondsRef.current;
      const ts = cb.formatTime(elapsed);

      // 5s silence
      if (silenceSec >= 5 && !silenceFiredRef.current && elapsed > 10) {
        silenceFiredRef.current = true;
        cb.onEventTrigger({ type: 'silence', timestamp: ts });
      }

      // No question in 4 minutes
      if (elapsed > QUESTION_SILENCE_THRESHOLD_S && elapsed > 0) {
        const secsSinceQuestion = elapsed - (lastQuestionTimeRef.current || 0);
        if (secsSinceQuestion >= QUESTION_SILENCE_THRESHOLD_S && questionCountRef.current === 0) {
          cb.onEventTrigger({ type: 'no-question', timestamp: ts });
          lastQuestionTimeRef.current = elapsed; // debounce
        }
      }
    }, 1000);

    return () => {
      if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
    };
  }, [sessionLive]);

  // Main Deepgram / Web Speech effect
  useEffect(() => {
    if (!sessionLive) {
      cleanup();
      return;
    }

    startTranscription();
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLive]);

  async function startTranscription() {
    cbRefs.current.onMicStatus('connecting');

    // Try Deepgram first
    try {
      const tokenRes = await fetch('/api/deepgram-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const tokenData = await tokenRes.json();

      if (tokenRes.ok && tokenData.key) {
        await startDeepgramSession(tokenData.key);
        return;
      }

      // Fallback to Web Speech
      if (tokenData.fallback === 'webspeech') {
        startWebSpeechFallback();
        return;
      }

      throw new Error(tokenData.error || 'Token fetch failed');
    } catch {
      startWebSpeechFallback();
    }
  }

  async function startDeepgramSession(key: string) {
    usingWebSpeech.current = false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      cbRefs.current.onMicStatus('blocked');
      return;
    }

    streamRef.current = stream;

    const wsUrl = [
      'wss://api.deepgram.com/v1/listen',
      '?model=nova-2',
      '&language=en-US',
      '&smart_format=true',
      '&punctuate=true',
      '&diarize=true',
      '&interim_results=true',
      '&utterance_end_ms=1000',
      '&vad_events=true',
      '&sentiment=true',
      `&token=${encodeURIComponent(key)}`,
    ].join('');

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      cbRefs.current.onMicStatus('listening');
      const mr = new MediaRecorder(stream, { mimeType: getSupportedMimeType() });
      mediaRecorderRef.current = mr;
      mr.addEventListener('dataavailable', (e) => {
        if (ws.readyState === WebSocket.OPEN && e.data.size > 0) {
          ws.send(e.data);
        }
      });
      mr.start(250);
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);

        if (data.type === 'Results') {
          const alt = data.channel?.alternatives?.[0];
          if (!alt) return;
          const text: string = alt.transcript || '';
          const isFinal: boolean = data.is_final === true;
          const words: Array<{ word: string; speaker?: number; start?: number }> = alt.words || [];
          const speaker: number = words[0]?.speaker ?? 0;
          const sentiment = alt.sentiment;

          if (isFinal && text.trim()) {
            handleFinalUtterance(text, speaker, sentiment);
            cbRefs.current.onInterim('');
          } else if (!isFinal && text.trim()) {
            cbRefs.current.onInterim(text);
          }
        } else if (data.type === 'UtteranceEnd') {
          cbRefs.current.onInterim('');
        }
      } catch {}
    };

    ws.onerror = () => {
      cbRefs.current.onMicStatus('error');
    };

    ws.onclose = () => {
      cbRefs.current.onMicStatus('idle');
    };
  }

  function startWebSpeechFallback() {
    usingWebSpeech.current = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR: (new () => any) | undefined = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SR) {
      cbRefs.current.onMicStatus('unsupported');
      return;
    }

    shouldRestartWSRef.current = true;
    const recognition = new SR();
    wsRecRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => cbRefs.current.onMicStatus('listening');
    recognition.onerror = (e: Event) => {
      const ev = e as Event & { error?: string };
      if (ev.error === 'not-allowed') {
        shouldRestartWSRef.current = false;
        cbRefs.current.onMicStatus('blocked');
      } else {
        cbRefs.current.onMicStatus('error');
      }
    };
    recognition.onend = () => {
      cbRefs.current.onMicStatus('idle');
      if (shouldRestartWSRef.current) {
        setTimeout(() => {
          if (shouldRestartWSRef.current) {
            try { wsRecRef.current?.start(); } catch {}
          }
        }, 300);
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      cbRefs.current.onInterim(interim);
      if (finalText.trim()) handleFinalUtterance(finalText, 0, undefined);
    };

    try {
      recognition.start();
    } catch {
      cbRefs.current.onMicStatus('error');
    }
  }

  function cleanup() {
    // Close Deepgram WebSocket
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    // Stop MediaRecorder
    if (mediaRecorderRef.current) {
      try { mediaRecorderRef.current.stop(); } catch {}
      mediaRecorderRef.current = null;
    }
    // Stop MediaStream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    // Stop Web Speech
    shouldRestartWSRef.current = false;
    if (wsRecRef.current) {
      try { wsRecRef.current.stop(); } catch {}
      wsRecRef.current = null;
    }
    cbRefs.current.onMicStatus('idle');
    cbRefs.current.onInterim('');
  }
}

function getSupportedMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}
