import { useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

interface AuthPageProps {
  onDemoMode: () => void;
  message: string;
  setMessage: (msg: string) => void;
}

export function AuthPage({ onDemoMode, message, setMessage }: AuthPageProps) {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const logoSrc = `${import.meta.env.BASE_URL}saynow-logo.png`.replace('//', '/');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setMessage('Missing Supabase environment variables.');
      return;
    }
    setLoading(true);
    setMessage('');
    const { error } =
      authMode === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(authMode === 'signup' ? 'Account created. Check your email if confirmation is required.' : '');
    setEmail('');
    setPassword('');
  }

  return (
    <div
      className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12"
      data-testid="auth-page"
    >
      <div className="w-full max-w-md flex flex-col items-center gap-8 fade-in-up">
        <div className="flex flex-col items-center gap-4">
          <img
            src={logoSrc}
            alt="SayNow Pro"
            className="w-24 h-24 rounded-2xl object-cover border border-primary/30 amber-glow"
            data-testid="auth-logo"
          />
          <div className="text-center">
            <h1 className="font-display font-black text-4xl tracking-tight">
              SayNow <span className="text-primary">Pro</span>
            </h1>
            <p className="mt-2 text-lg text-muted-foreground font-medium">
              Your unfair advantage on every call.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 w-full">
          {[
            { title: 'Pre-Call Intel', desc: 'Battle briefs, objection prep, and prospect context before you dial.' },
            { title: 'Live Coaching', desc: 'Real-time guidance, sentiment analysis, and competitor battlecards mid-call.' },
            { title: 'Post-Call Debrief', desc: 'Score, analysis, and follow-up email ready in seconds.' },
          ].map((f) => (
            <div
              key={f.title}
              className="p-3 rounded-xl border border-border bg-card/60"
              style={{ backdropFilter: 'blur(8px)' }}
            >
              <p className="text-xs font-mono font-bold text-primary uppercase tracking-widest mb-1">{f.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {isSupabaseConfigured ? (
          <div
            className="w-full rounded-2xl border border-border p-6"
            style={{ background: 'rgba(17,17,17,0.90)', backdropFilter: 'blur(12px)' }}
          >
            <div className="flex gap-1 mb-5 p-1 rounded-lg bg-muted/40">
              {(['signin', 'signup'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setAuthMode(mode)}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                    authMode === mode
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid={`button-${mode}`}
                >
                  {mode === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                autoComplete="email"
                required
                className="w-full px-4 py-3 rounded-xl bg-background border border-input text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors text-sm"
                data-testid="input-email"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                required
                className="w-full px-4 py-3 rounded-xl bg-background border border-input text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors text-sm"
                data-testid="input-password"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-sm text-primary-foreground transition-all hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #c9960c, #f5d97e)' }}
                data-testid="button-auth-submit"
              >
                {loading ? 'Working...' : authMode === 'signup' ? 'Create Account' : 'Sign In'}
              </button>
            </form>
            {message && (
              <p className="mt-3 text-sm text-center text-muted-foreground" data-testid="auth-message">
                {message}
              </p>
            )}
          </div>
        ) : (
          <div
            className="w-full rounded-2xl border border-primary/30 p-6 text-center"
            style={{ background: 'rgba(201,150,12,0.06)', backdropFilter: 'blur(8px)' }}
          >
            <p className="text-sm font-mono font-bold text-primary uppercase tracking-widest mb-2">Demo Mode</p>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Supabase is not configured. All features work locally — nothing is saved between sessions.
            </p>
            <button
              onClick={onDemoMode}
              className="px-6 py-3 rounded-xl font-bold text-sm text-primary-foreground transition-all hover:-translate-y-px"
              style={{ background: 'linear-gradient(135deg, #c9960c, #f5d97e)' }}
              data-testid="button-demo-mode"
            >
              Enter Demo Mode
            </button>
          </div>
        )}

        {isSupabaseConfigured && (
          <button
            onClick={onDemoMode}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
            data-testid="button-explore-demo"
          >
            Explore without an account
          </button>
        )}
      </div>
    </div>
  );
}
