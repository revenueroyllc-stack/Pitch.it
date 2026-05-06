export const ADMIN_EMAIL = 'executive@revenueroyllc.com';
export const STRIPE_PRICE_ID = 'price_1TTQ4XQkADh5vQgn5MU81Lhc';
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '';

export function isAdmin(email?: string | null): boolean {
  return (email ?? '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

export async function redirectToCheckout(userEmail: string): Promise<void> {
  const { loadStripe } = await import('@stripe/stripe-js');
  const stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY);
  if (!stripe) throw new Error('Stripe failed to load');
  await stripe.redirectToCheckout({
    lineItems: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    mode: 'subscription',
    customerEmail: userEmail,
    successUrl: window.location.origin + '?subscribed=true',
    cancelUrl: window.location.origin + '?cancelled=true',
  });
}
