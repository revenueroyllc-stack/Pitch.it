import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PACK_PRICE_IDS = new Set([
  'price_1TTT5IQkADh5vQgnZtRjqwt3',
  'price_1TTT6NQkADh5vQgnj6bFuBGo',
  'price_1TTT80QkADh5vQgnHJHrBp5K',
]);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { priceId, userId, userEmail } = req.body || {};

  if (!priceId || !PACK_PRICE_IDS.has(priceId)) {
    return res.status(400).json({ error: 'Invalid or missing priceId' });
  }
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const origin = req.headers.origin || req.headers.referer || 'https://saynowpro.repl.co';
  const baseUrl = origin.replace(/\/$/, '');

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      ...(userEmail ? { customer_email: userEmail } : {}),
      metadata: { type: 'credit_pack', userId, priceId },
      success_url: `${baseUrl}/?credits_added=true`,
      cancel_url: `${baseUrl}/`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    return res.status(502).json({ error: `Stripe error: ${err.message}` });
  }
}
