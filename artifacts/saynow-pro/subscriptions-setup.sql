-- Run this in your Supabase SQL Editor

create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive',
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Admin insert/update policy (for webhook)
create policy "Service role can manage subscriptions"
  on public.subscriptions for all
  using (true)
  with check (true);

-- Index for fast lookups
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_stripe_sub_idx on public.subscriptions(stripe_subscription_id);
