-- In-app notifications
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null
              check (type in ('manager_feedback', 'low_credits', 'team_joined', 'personal_best', 'generic')),
  message     text not null,
  link        text,                               -- optional deep link
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- RLS
alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "Users can mark own notifications read"
  on public.notifications for update
  using (user_id = auth.uid());

-- Service role can insert notifications for any user (server-side only)
-- No insert policy for anon/authenticated — inserts happen via service role key only
