-- User profiles: caller ID, team membership, role
create table if not exists public.user_profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  display_name  text,
  phone_number  text,                          -- user's real phone for caller ID
  verified_phone text,                         -- Twilio-verified caller ID
  team_id       uuid,                          -- null if solo user
  role          text not null default 'rep'    -- rep | manager | admin
                check (role in ('rep', 'manager', 'admin')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id)
);

-- Call outcome tracking (extend call_sessions)
alter table public.call_sessions
  add column if not exists outcome text
    check (outcome in ('closed', 'follow_up', 'no_interest', 'voicemail') or outcome is null);

-- RLS
alter table public.user_profiles enable row level security;

create policy "Users can read own profile"
  on public.user_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = user_id);

-- Managers can read profiles of their team members
create policy "Managers can read team member profiles"
  on public.user_profiles for select
  using (
    team_id is not null
    and team_id in (
      select team_id from public.user_profiles
      where user_id = auth.uid() and role in ('manager', 'admin')
    )
  );
