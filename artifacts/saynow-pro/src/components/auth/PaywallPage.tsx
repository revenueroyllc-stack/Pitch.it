import { useState } from 'react';
import { redirectToCheckout } from '@/lib/billing';

interface PaywallPageProps {
  userEmail: string;
  onSignOut: () => void;
}

export function PaywallPage({ userEmail, onSignOut }: PaywallPageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const logoSrc = `${import.meta.env.BASE_URL}saynow-logo.png`.replace('//', '/');

  async function handleSubscribe() {
    setLoading(true);
    setError('');
    try {
      await redirectToCheckout(userEmail);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12 dark">
      <div className="w-full max-w-md flex flex-col items-center gap-8 fade-in-up">

        <img
          src={logoSrc}
          alt="SayNow Pro"
          className="w-20 h-20 rounded-2xl object-cover border border-primary/30"
        />

        <div className="text-center">
          <h1 className="font-display font-black text-3xl tracking-tight">
            SayNow <span className="text-primary">Pro</span>
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Your unfair advantage on every call.
          </p>
        </div>

        <div className="w-full grid grid-cols-1 gap-3">
          {[
            { icon: '🎯', title: 'Pre-Call Intel', desc: 'Battle briefs, objection prep, and prospect context before you dial.' },
            { icon: '🎙️', title: 'Live Coaching', desc: 'Real-time guidance, sentiment analysis, and competitor battlecards mid-call.' },
            { icon: '📊', title: 'Live Score Meter', desc: 'See your performance score update in real time during the call.' },
            { icon: '📋', title: 'Post-Call Debrief', desc: 'Full analysis, wins, misses, and follow-up ready in seconds.' },
            { icon: '🧠', title: 'Coaching Profile', desc: 'Track your improvement across every call over time.' },
          ].map((f) => (
            <div key={f.title} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card/60">
              <span className="text-xl">{f.icon}</span>
              <div>
                <p className="text-sm font-bold text-foreground">{f.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div
          className="w-full rounded-2xl border border-primary/40 p-6 text-center"
          style={{ background: 'rgba(17,17,17,0.92)', backdropFilter: 'blur(12px)' }}
        >
          <p className="text-xs font-mono font-bold text-primary uppercase tracking-widest mb-1">Full Access</p>
          <div className="flex items-end justify-center gap-1 my-3">
            <span className="text-5xl font-black text-foreground">$19</span>
            <span className="text-2xl font-bold text-primary">.99</span>
            <span className="text-sm text-muted-foreground mb-1">/month</span>
          </div>
          <p className="text-xs text-muted-foreground mb-5">Cancel anytime. No contracts.</p>

          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-sm text-primary-foreground transition-all hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #c9960c, #f5d97e)' }}
          >
            {loading ? 'Redirecting to checkout...' : 'Subscribe — $19.99/mo'}
          </button>

          {error && (
            <p className="mt-3 text-xs text-red-400">{error}</p>
          )}
        </div>

        <button
          onClick={onSignOut}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
        >
          Sign out ({userEmail})
        </button>
      </div>
    </div>
  );
}
