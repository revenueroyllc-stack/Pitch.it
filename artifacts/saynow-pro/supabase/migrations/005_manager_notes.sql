-- Manager coaching notes on recordings
create table if not exists public.manager_notes (
  id                uuid primary key default gen_random_uuid(),
  recording_id      uuid not null references public.call_recordings(id) on delete cascade,
  manager_id        uuid not null references auth.users(id) on delete cascade,
  rep_id            uuid not null references auth.users(id) on delete cascade,
  timestamp_in_call int not null default 0,       -- seconds into the recording
  note              text not null,
  created_at        timestamptz not null default now()
);

-- RLS
alter table public.manager_notes enable row level security;

create policy "Managers can create notes"
  on public.manager_notes for insert
  with check (manager_id = auth.uid());

create policy "Managers can read their notes"
  on public.manager_notes for select
  using (manager_id = auth.uid());

create policy "Reps can read feedback on their calls"
  on public.manager_notes for select
  using (rep_id = auth.uid());
