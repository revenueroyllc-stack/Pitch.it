-- Call recordings (Twilio recordings + metadata)
create table if not exists public.call_recordings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  team_id         uuid references public.teams(id) on delete set null,
  session_id      uuid references public.call_sessions(id) on delete set null,
  twilio_call_sid text,                          -- Twilio CallSid for lookup
  recording_url   text,                          -- Supabase Storage or Twilio URL
  duration        int,                           -- seconds
  score           int,
  transcript      jsonb,
  outcome         text check (outcome in ('closed', 'follow_up', 'no_interest', 'voicemail') or outcome is null),
  created_at      timestamptz not null default now()
);

-- RLS
alter table public.call_recordings enable row level security;

create policy "Users can read own recordings"
  on public.call_recordings for select
  using (user_id = auth.uid());

create policy "Users can insert own recordings"
  on public.call_recordings for insert
  with check (user_id = auth.uid());

create policy "Managers can read team recordings"
  on public.call_recordings for select
  using (
    team_id is not null
    and team_id in (
      select team_id from public.team_members tm
      join public.user_profiles up on up.user_id = auth.uid()
      where tm.user_id = auth.uid() and up.role in ('manager', 'admin')
    )
  );
