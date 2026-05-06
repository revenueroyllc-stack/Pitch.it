-- Credits table for SayNow Pro token/credit system
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.credits (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_briefs_used    integer NOT NULL DEFAULT 0,
  monthly_intervals_used integer NOT NULL DEFAULT 0,
  monthly_debriefs_used  integer NOT NULL DEFAULT 0,
  pack_briefs    integer NOT NULL DEFAULT 0,
  pack_intervals integer NOT NULL DEFAULT 0,
  pack_debriefs  integer NOT NULL DEFAULT 0,
  reset_date     date NOT NULL DEFAULT CURRENT_DATE,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

-- Users can only read their own credits
CREATE POLICY "Users read own credits" ON public.credits
  FOR SELECT USING (auth.uid() = user_id);

-- Only service role can insert/update (done via API with service key)
-- No client-side write policies needed

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS credits_user_id_idx ON public.credits(user_id);
