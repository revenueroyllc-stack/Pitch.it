-- Teams
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null unique,             -- 6-digit join code
  admin_id    uuid not null references auth.users(id) on delete restrict,
  plan        text not null default 'individual'
              check (plan in ('individual', 'team')),
  seat_limit  int not null default 5,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Team members (join table with role)
create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'rep'
             check (role in ('rep', 'manager', 'admin')),
  joined_at  timestamptz not null default now(),
  unique (team_id, user_id)
);

-- RLS for teams
alter table public.teams enable row level security;

create policy "Team members can read their team"
  on public.teams for select
  using (
    id in (
      select team_id from public.team_members where user_id = auth.uid()
    )
  );

create policy "Admin can manage their team"
  on public.teams for all
  using (admin_id = auth.uid());

create policy "Anyone can read team by code (for joining)"
  on public.teams for select
  using (true);

-- RLS for team_members
alter table public.team_members enable row level security;

create policy "Team members can see their team roster"
  on public.team_members for select
  using (
    team_id in (
      select team_id from public.team_members where user_id = auth.uid()
    )
  );

create policy "Managers and admins can manage members"
  on public.team_members for all
  using (
    team_id in (
      select tm.team_id from public.team_members tm
      join public.user_profiles up on up.user_id = auth.uid()
      where tm.user_id = auth.uid() and up.role in ('manager', 'admin')
    )
  );

create policy "Users can insert themselves as member"
  on public.team_members for insert
  with check (user_id = auth.uid());
