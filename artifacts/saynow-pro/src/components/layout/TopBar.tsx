import { isSupabaseConfigured } from '@/lib/supabase';
import { formatTime } from '@/lib/coach';

interface TopBarProps {
  session: { user: { email?: string } } | null;
  sessionLive: boolean;
  timerSeconds: number;
  onSignOut: () => void;
  saving: boolean;
  savingSession: boolean;
  onSaveWorkspace: () => void;
  onSaveSession: () => void;
}

export function TopBar({
  session,
  sessionLive,
  timerSeconds,
  onSignOut,
  saving,
  savingSession,
  onSaveWorkspace,
  onSaveSession,
}: TopBarProps) {
  const logoSrc = `${import.meta.env.BASE_URL}saynow-logo.png`.replace('//', '/');

  return (
    <header
      className="relative z-10 flex items-center justify-between gap-4 px-5 py-3 border-b border-border"
      style={{ background: 'rgba(8,8,8,0.90)', backdropFilter: 'blur(12px)' }}
      data-testid="topbar"
    >
      <div className="flex items-center gap-4 min-w-0">
        <img
          src={logoSrc}
          alt="SayNow Pro"
          className="w-12 h-12 rounded-xl object-cover border border-primary/25 shrink-0"
          style={{ boxShadow: '0 0 20px rgba(201,150,12,0.20)' }}
          data-testid="brand-logo"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display font-extrabold text-lg tracking-tight leading-none">
              SayNow <span className="text-primary">Pro</span>
            </h1>
            {!isSupabaseConfigured && (
              <span className="px-2 py-0.5 rounded-full text-[0.6rem] font-mono font-bold uppercase tracking-widest border border-primary/25 bg-[rgba(201,150,12,0.10)] text-primary">
                Demo
              </span>
            )}
          </div>
          <p className="text-[0.72rem] text-muted-foreground mt-0.5">
            Real-time sales intelligence
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {session && (
          <>
            <button
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
              onClick={onSaveWorkspace}
              disabled={saving}
              data-testid="button-save-workspace"
            >
              {saving ? 'Saving...' : 'Save Workspace'}
            </button>
            <button
              className="px-3 py-1.5 text-xs font-semibold rounded-lg text-primary-foreground transition-all hover:-translate-y-px"
              style={{ background: 'linear-gradient(135deg, #c9960c, #f5d97e)' }}
              onClick={onSaveSession}
              disabled={savingSession}
              data-testid="button-save-session"
            >
              {savingSession ? 'Saving...' : 'Save Session'}
            </button>
            <button
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 transition-all"
              onClick={onSignOut}
              data-testid="button-sign-out"
            >
              Sign Out
            </button>
          </>
        )}

        <div className="flex items-center gap-3 ml-2">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[0.7rem] font-mono uppercase tracking-widest transition-all ${
              sessionLive
                ? 'border-[#00c896] text-[#00c896] bg-[rgba(0,200,150,0.08)]'
                : 'border-border text-muted-foreground bg-card'
            }`}
            data-testid="live-indicator"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${sessionLive ? 'bg-[#00c896] pulse-amber' : 'bg-muted-foreground'}`}
            />
            {sessionLive ? 'Live' : 'Offline'}
          </div>
          <span className="font-mono text-sm text-muted-foreground tracking-widest" data-testid="timer-display">
            {formatTime(timerSeconds)}
          </span>
        </div>
      </div>
    </header>
  );
}
