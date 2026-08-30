-- Single shared JSON blob for the Prioritization Task Backlog (tasks,
-- clients, yearly goals). Same "one shared board for the whole team"
-- design as daily_kill_list_state -- one singleton row, not per-user.
create table if not exists public.task_backlog_state (
  id smallint primary key default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint task_backlog_state_singleton check (id = 1)
);

alter table public.task_backlog_state enable row level security;

create policy "Authenticated users can read the shared backlog"
  on public.task_backlog_state for select
  to authenticated
  using (true);

create policy "Authenticated users can insert the shared backlog"
  on public.task_backlog_state for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update the shared backlog"
  on public.task_backlog_state for update
  to authenticated
  using (true);

insert into public.task_backlog_state (id, data)
values (1, '{}'::jsonb)
on conflict (id) do nothing;
