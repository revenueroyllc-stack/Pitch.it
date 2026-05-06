export const ADMIN_EMAIL = 'executive@revenueroyllc.com';
export const STRIPE_PRICE_ID = 'price_1TTQ4XQkADh5vQgn5MU81Lhc';
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '';

export function isAdmin(email?: string | null): boolean {
  return (email ?? '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

export async function redirectToCheckout(userEmail: string): Promise<void> {
  // Call server-side session creator then redirect to Stripe URL
  const res = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      priceId: STRIPE_PRICE_ID,
      userId: 'subscription',
      userEmail,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Checkout failed' }));
    throw new Error(err.error ?? 'Failed to create checkout session');
  }
  const { url } = await res.json();
  if (url) window.location.href = url;
}
