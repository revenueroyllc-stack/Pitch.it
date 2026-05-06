import { useState } from 'react';

interface Pack {
  label: 'Small' | 'Medium' | 'Large';
  priceId: string;
  price: string;
  intervals: number;
  briefs: number;
  debriefs: number;
  popular?: boolean;
  color: string;
  glow: string;
}

const PACKS: Pack[] = [
  {
    label: 'Small',
    priceId: 'price_1TTT5IQkADh5vQgnZtRjqwt3',
    price: '$4.99',
    intervals: 100,
    briefs: 5,
    debriefs: 5,
    color: 'from-[#5a3ec8] to-[#7c5fe6]',
    glow: 'rgba(90,62,200,0.35)',
  },
  {
    label: 'Medium',
    priceId: 'price_1TTT6NQkADh5vQgnj6bFuBGo',
    price: '$9.99',
    intervals: 300,
    briefs: 15,
    debriefs: 15,
    popular: true,
    color: 'from-[#7c3fc8] to-[#a96ef5]',
    glow: 'rgba(124,63,200,0.45)',
  },
  {
    label: 'Large',
    priceId: 'price_1TTT80QkADh5vQgnHJHrBp5K',
    price: '$24.99',
    intervals: 800,
    briefs: 40,
    debriefs: 40,
    color: 'from-[#2c4e9c] to-[#4a74d8]',
    glow: 'rgba(44,78,156,0.35)',
  },
];

interface CreditPackModalProps {
  userId: string;
  userEmail?: string;
  creditType?: string;
  onClose: () => void;
}

function FeatureRow({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[0.7rem]">{icon}</span>
      <span className="text-xs text-white/80">{label}</span>
    </div>
  );
}

export function CreditPackModal({ userId, userEmail, creditType, onClose }: CreditPackModalProps) {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleBuy(pack: Pack) {
    setError('');
    setLoadingPriceId(pack.priceId);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: pack.priceId, userId, userEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || 'Failed to start checkout');
      setLoadingPriceId(null);
    }
  }

  const creditLabel = creditType === 'brief' ? 'battle briefs' : creditType === 'interval' ? 'live coaching intervals' : creditType === 'debrief' ? 'debriefs' : 'credits';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(160deg, #1a0a3c 0%, #0f1a3c 100%)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {/* Header image */}
        <div className="relative w-full overflow-hidden" style={{ maxHeight: 220 }}>
          <img
            src="/credit-pack-header.png"
            alt="SayNow Pro Credit Packs"
            className="w-full object-cover object-top"
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-all text-lg"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {creditType && (
            <p className="text-center text-sm text-white/60 mb-5">
              You've used all your monthly {creditLabel}. Top up with a credit pack to keep going.
            </p>
          )}

          {error && (
            <p className="text-center text-xs text-red-400 mb-4">{error}</p>
          )}

          <div className="grid grid-cols-3 gap-3">
            {PACKS.map((pack) => (
              <div
                key={pack.priceId}
                className="relative rounded-2xl overflow-hidden flex flex-col"
                style={{
                  background: `linear-gradient(160deg, ${pack.color.includes('5a3ec8') ? '#3d2aa0' : pack.color.includes('7c3fc8') ? '#5a2aaa' : '#1e3a7a'}, ${pack.color.includes('5a3ec8') ? '#5a3ec8' : pack.color.includes('7c3fc8') ? '#7c3fc8' : '#2c4e9c'})`,
                  border: pack.popular ? '2px solid rgba(180,120,255,0.8)' : '1px solid rgba(255,255,255,0.12)',
                  boxShadow: `0 8px 32px ${pack.glow}`,
                }}
              >
                {pack.popular && (
                  <div className="flex justify-center pt-2">
                    <span className="px-3 py-0.5 rounded-full text-[0.6rem] font-bold uppercase tracking-wider bg-[rgba(255,200,80,0.2)] border border-[rgba(255,200,80,0.4)] text-[#ffd060]">
                      🔥 Most Popular
                    </span>
                  </div>
                )}

                <div className={`px-4 ${pack.popular ? 'pt-2' : 'pt-4'} pb-4 flex flex-col flex-1`}>
                  <p className="text-xs font-semibold text-white/70 text-center">SayNow Pro Credits</p>
                  <p className="text-lg font-black text-white text-center mt-0.5">{pack.label}</p>
                  <p
                    className="text-3xl font-black text-center mt-1 mb-3"
                    style={{ color: '#fff', textShadow: `0 0 20px ${pack.glow}` }}
                  >
                    {pack.price}
                  </p>

                  <div className="flex flex-col gap-1.5 mb-4 flex-1">
                    <FeatureRow icon="🎙️" label={`${pack.intervals.toLocaleString()} intervals`} />
                    <FeatureRow icon="⚡" label={`${pack.briefs} briefs`} />
                    <FeatureRow icon="📊" label={`${pack.debriefs} debriefs`} />
                  </div>

                  <button
                    onClick={() => handleBuy(pack)}
                    disabled={loadingPriceId !== null}
                    className="w-full py-2 rounded-xl font-bold text-sm transition-all hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: pack.popular
                        ? 'linear-gradient(135deg, #c9960c, #f5d97e)'
                        : 'rgba(255,255,255,0.15)',
                      color: pack.popular ? '#1a0a0a' : '#fff',
                      border: pack.popular ? 'none' : '1px solid rgba(255,255,255,0.25)',
                    }}
                  >
                    {loadingPriceId === pack.priceId ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <span className="w-3.5 h-3.5 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                        Loading...
                      </span>
                    ) : (
                      `Buy ${pack.label}`
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-[0.65rem] text-white/35 mt-4">
            One-time payment · Credits never expire · Secure checkout via Stripe
          </p>
        </div>
      </div>
    </div>
  );
}
