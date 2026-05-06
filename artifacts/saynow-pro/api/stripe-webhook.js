import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: { bodyParser: false },
};

// Credit amounts per price ID
const CREDIT_PACK_GRANTS = {
  'price_1TTT5IQkADh5vQgnZtRjqwt3': { pack_briefs: 5,  pack_intervals: 100,  pack_debriefs: 5  },
  'price_1TTT6NQkADh5vQgnj6bFuBGo': { pack_briefs: 15, pack_intervals: 300,  pack_debriefs: 15 },
  'price_1TTT80QkADh5vQgnHJHrBp5K': { pack_briefs: 40, pack_intervals: 800, pack_debriefs: 40 },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function getUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;
  return data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function handleSubscription(session) {
  const customerEmail =
    session.customer_details?.email || session.customer_email;

  if (!customerEmail) {
    console.error('No customer email in session:', session.id);
    return { status: 400, error: 'No customer email in session' };
  }

  const user = await getUserByEmail(customerEmail);
  if (!user) {
    console.error('No auth user found for email:', customerEmail);
    return { status: 404, error: 'User not found for email' };
  }

  const { error: upsertError } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: user.id,
        email: customerEmail,
        stripe_customer_id: session.customer,
        stripe_session_id: session.id,
        status: 'active',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (upsertError) throw upsertError;

  console.log('Subscription activated for user:', user.id);
  return { status: 200 };
}

async function handleCreditPack(session) {
  const { userId, priceId } = session.metadata || {};

  if (!userId || !priceId) {
    console.error('Missing userId or priceId in credit_pack metadata');
    return { status: 400, error: 'Missing credit pack metadata' };
  }

  const grant = CREDIT_PACK_GRANTS[priceId];
  if (!grant) {
    console.error('Unknown credit pack priceId:', priceId);
    return { status: 400, error: `Unknown priceId: ${priceId}` };
  }

  const resetDay = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  })();

  // Get existing credits row (if any)
  const { data: existing } = await supabase
    .from('credits')
    .select('pack_briefs, pack_intervals, pack_debriefs')
    .eq('user_id', userId)
    .maybeSingle();

  const newBriefs    = (existing?.pack_briefs    || 0) + grant.pack_briefs;
  const newIntervals = (existing?.pack_intervals || 0) + grant.pack_intervals;
  const newDebriefs  = (existing?.pack_debriefs  || 0) + grant.pack_debriefs;

  const { error: upsertError } = await supabase
    .from('credits')
    .upsert(
      {
        user_id: userId,
        pack_briefs: newBriefs,
        pack_intervals: newIntervals,
        pack_debriefs: newDebriefs,
        reset_date: existing ? undefined : resetDay,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (upsertError) throw upsertError;

  console.log(`Credit pack applied to user ${userId}: +${grant.pack_briefs} briefs, +${grant.pack_intervals} intervals, +${grant.pack_debriefs} debriefs`);
  return { status: 200 };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    try {
      let result;
      if (session.metadata?.type === 'credit_pack') {
        result = await handleCreditPack(session);
      } else {
        result = await handleSubscription(session);
      }

      if (result.error) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('Error processing checkout.session.completed:', err.message);
      return res.status(500).json({ error: 'Failed to process event' });
    }
  }

  return res.status(200).json({ received: true });
}
