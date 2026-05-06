create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.call_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  objective text not null default '',
  talking_points jsonb not null default '[]'::jsonb,
  objections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.call_workspaces(id) on delete set null,
  objective text not null default '',
  transcript jsonb not null default '[]'::jsonb,
  coach_cards jsonb not null default '[]'::jsonb,
  duration_seconds integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_call_workspaces_updated_at on public.call_workspaces;
create trigger trg_call_workspaces_updated_at
before update on public.call_workspaces
for each row
execute function public.set_updated_at();

alter table public.call_workspaces enable row level security;
alter table public.call_sessions enable row level security;

drop policy if exists "Users can read own workspace" on public.call_workspaces;
create policy "Users can read own workspace"
on public.call_workspaces
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own workspace" on public.call_workspaces;
create policy "Users can insert own workspace"
on public.call_workspaces
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own workspace" on public.call_workspaces;
create policy "Users can update own workspace"
on public.call_workspaces
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read own sessions" on public.call_sessions;
create policy "Users can read own sessions"
on public.call_sessions
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own sessions" on public.call_sessions;
create policy "Users can insert own sessions"
on public.call_sessions
for insert
with check (auth.uid() = user_id);
