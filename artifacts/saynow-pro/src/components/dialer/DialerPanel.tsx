import { useState, useEffect, useRef } from 'react';

type CallStatus = 'idle' | 'ready' | 'connecting' | 'ringing' | 'in-call' | 'error' | 'unconfigured';

interface DialerPanelProps {
  userId?: string;
  onCallStarted?: () => void;
  onCallEnded?: () => void;
}

function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

function formatDuration(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const DIAL_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

export function DialerPanel({ userId, onCallStarted, onCallEnded }: DialerPanelProps) {
  const [phoneInput, setPhoneInput] = useState('');
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const deviceRef = useRef<unknown>(null);
  const callRef = useRef<unknown>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function pressKey(key: string) {
    if (callStatus === 'in-call' || callStatus === 'ringing') return;
    setPhoneInput((prev) => {
      const digits = prev.replace(/\D/g, '');
      if (key === '*' || key === '#') return prev + key;
      if (digits.length >= 11) return prev;
      return digits + key;
    });
  }

  function backspace() {
    setPhoneInput((prev) => {
      const digits = prev.replace(/\D/g, '');
      return digits.slice(0, -1);
    });
  }

  async function initializeTwilio() {
    setErrorMsg('');
    setCallStatus('connecting');
    try {
      const res = await fetch('/api/twilio-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'Twilio not configured') {
          setCallStatus('unconfigured');
          setErrorMsg('Twilio not configured');
          return null;
        }
        throw new Error(data.error || 'Token fetch failed');
      }
      const { Device } = await import('@twilio/voice-sdk');
      const device = new Device(data.token, { logLevel: 1 });
      device.on('error', (err: Error) => { setErrorMsg(err.message); setCallStatus('error'); });
      device.on('disconnect', () => endCallCleanup());
      await device.register();
      deviceRef.current = device;
      setCallStatus('ready');
      return device;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setCallStatus('error');
      return null;
    }
  }

  async function handleCall() {
    const digits = phoneInput.replace(/\D/g, '');
    if (digits.length < 10) return;
    const to = toE164(phoneInput);
    let device = deviceRef.current as { connect?: (opts: { params: { To: string } }) => Promise<unknown> } | null;
    if (!device) {
      device = await initializeTwilio() as typeof device;
      if (!device) return;
    }
    setCallStatus('ringing');
    setErrorMsg('');
    try {
      const call = await device.connect?.({ params: { To: to } });
      callRef.current = call;
      setCallStatus('in-call');
      setCallDuration(0);
      timerRef.current = setInterval(() => setCallDuration((s) => s + 1), 1000);
      onCallStarted?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setCallStatus('ready');
    }
  }

  function handleHangup() {
    if (callRef.current && typeof callRef.current === 'object') {
      try { (callRef.current as { disconnect?: () => void }).disconnect?.(); } catch {}
    }
    endCallCleanup();
  }

  function endCallCleanup() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    callRef.current = null;
    setCallStatus('ready');
    onCallEnded?.();
  }

  const statusColors: Record<CallStatus, string> = {
    idle: '#888', ready: '#00c896', connecting: '#c9960c', ringing: '#f5d97e',
    'in-call': '#00c896', error: '#ff4757', unconfigured: '#c9960c',
  };
  const isOnCall = callStatus === 'in-call' || callStatus === 'ringing';
  const digits = phoneInput.replace(/\D/g, '');
  const canCall = digits.length >= 10 && !isOnCall && callStatus !== 'connecting';
  const statusColor = statusColors[callStatus];

  return (
    <div
      className="rounded-2xl border border-border bg-card overflow-hidden"
      style={{ backdropFilter: 'blur(8px)' }}
      data-testid="dialer-panel"
    >
      {/* ── Header ── */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={statusColor} strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.52 12 19.79 19.79 0 0 1 1.42 3.18 2 2 0 0 1 3.4 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.13 6.13l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          <span className="text-[0.62rem] font-mono uppercase tracking-widest" style={{ color: statusColor }}>
            {callStatus === 'in-call'
              ? `In Call · ${formatDuration(callDuration)}`
              : callStatus === 'ringing' ? 'Ringing...'
              : callStatus === 'connecting' ? 'Connecting...'
              : callStatus === 'ready' ? 'Dialer — Ready'
              : callStatus === 'unconfigured' ? 'Dialer — Preview'
              : callStatus === 'error' ? 'Dialer — Error'
              : 'Dialer'}
          </span>
        </div>
        {callStatus === 'in-call' && (
          <span className="w-2 h-2 rounded-full bg-[#00c896] animate-pulse" />
        )}
      </div>

      <div className="px-4 py-3 flex flex-col gap-3">

        {/* ── Twilio not configured notice (always visible when unconfigured, non-blocking) ── */}
        {callStatus === 'unconfigured' && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl border border-[rgba(201,150,12,0.3)] bg-[rgba(201,150,12,0.06)]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c9960c" strokeWidth="2" className="mt-0.5 shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-[0.65rem] text-[#c9960c] leading-relaxed">
              Twilio not configured — set <code className="font-mono">TWILIO_ACCOUNT_SID</code>, <code className="font-mono">TWILIO_API_KEY</code>, <code className="font-mono">TWILIO_API_SECRET</code> and <code className="font-mono">TWILIO_TWIML_APP_SID</code> to enable live calls.
            </p>
          </div>
        )}

        {/* ── Error notice ── */}
        {callStatus === 'error' && errorMsg && (
          <p className="text-[0.65rem] text-[#ff4757] px-1">{errorMsg}</p>
        )}

        {/* ── Phone number input ── */}
        <div className="flex gap-2 items-center">
          <input
            type="tel"
            value={formatPhoneDisplay(digits)}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
              setPhoneInput(raw);
            }}
            placeholder="(555) 000-0000"
            disabled={isOnCall}
            className="flex-1 px-3 py-2.5 rounded-xl bg-background border border-border text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 disabled:opacity-50"
            data-testid="dialer-phone-input"
          />
          {digits.length > 0 && !isOnCall && (
            <button
              onClick={backspace}
              className="p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground transition-all"
              title="Backspace"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
              </svg>
            </button>
          )}
        </div>

        {/* ── Dial pad ── */}
        <div className="grid grid-cols-3 gap-2" data-testid="dial-pad">
          {DIAL_KEYS.flat().map((key) => (
            <button
              key={key}
              onClick={() => pressKey(key)}
              disabled={isOnCall}
              className="py-2.5 rounded-xl border border-border bg-background font-mono font-bold text-sm text-foreground hover:bg-white/[0.06] hover:border-primary/30 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid={`dial-key-${key}`}
            >
              {key}
            </button>
          ))}
        </div>

        {/* ── Call / Hang up button ── */}
        {isOnCall ? (
          <button
            onClick={handleHangup}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'rgba(255,71,87,0.15)', border: '1px solid rgba(255,71,87,0.4)', color: '#ff4757' }}
            data-testid="dialer-hangup"
          >
            End Call
          </button>
        ) : (
          <button
            onClick={callStatus === 'idle' || callStatus === 'unconfigured' || callStatus === 'error'
              ? initializeTwilio
              : handleCall}
            disabled={callStatus === 'connecting' || (callStatus === 'ready' && !canCall)}
            className="w-full py-3 rounded-xl font-bold text-sm text-primary-foreground transition-all hover:-translate-y-px active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: canCall || callStatus === 'idle' || callStatus === 'unconfigured'
              ? 'linear-gradient(135deg, #c9960c, #f5d97e)'
              : 'rgba(201,150,12,0.3)',
              color: '#1a0a0a' }}
            data-testid="dialer-call"
          >
            {callStatus === 'connecting' ? 'Connecting...'
              : callStatus === 'idle' || callStatus === 'unconfigured' || callStatus === 'error' ? 'Initialize Dialer'
              : 'Call'}
          </button>
        )}

        <p className="text-[0.58rem] text-muted-foreground text-center">
          Outbound calls use your verified caller ID · Powered by Twilio
        </p>
      </div>
    </div>
  );
}
