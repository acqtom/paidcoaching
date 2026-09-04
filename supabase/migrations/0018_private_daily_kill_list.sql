-- Reverses the original "one shared team-wide board" design from
-- 0003_daily_kill_list_state.sql / 0004_task_backlog_state.sql: Daily
-- Kill List (both the day-scoped state and the persistent backlog +
-- Yearly Goals) becomes private per account, at the user's explicit
-- direction -- matching every other feature in this app except
-- Communications, which is the one deliberately shared feature.
--
-- THIS DROPS BOTH TABLES AND EVERYTHING IN THEM. That's intentional --
-- there's no way to attribute which tasks in the old shared board
-- belonged to which person, so per the user's own call every account
-- starts fresh rather than everyone getting a duplicate copy of the old
-- shared list. This is a genuine, deliberate data-loss migration, not
-- the usual "DROP POLICY/TRIGGER immediately followed by CREATE" kind of
-- destructive-operation warning seen on most other migrations in this
-- app -- if today's shared Daily Kill List / backlog / Yearly Goals
-- content still matters, save a copy of it before running this.
drop table if exists public.daily_kill_list_state;
drop table if exists public.task_backlog_state;

create table public.daily_kill_list_state (
  id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.task_backlog_state (
  id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.daily_kill_list_state enable row level security;
alter table public.task_backlog_state enable row level security;

create policy "Users can read their own daily kill list state"
  on public.daily_kill_list_state for select
  using (auth.uid() = id);
create policy "Users can insert their own daily kill list state"
  on public.daily_kill_list_state for insert
  with check (auth.uid() = id);
create policy "Users can update their own daily kill list state"
  on public.daily_kill_list_state for update
  using (auth.uid() = id);

create policy "Users can read their own task backlog state"
  on public.task_backlog_state for select
  using (auth.uid() = id);
create policy "Users can insert their own task backlog state"
  on public.task_backlog_state for insert
  with check (auth.uid() = id);
create policy "Users can update their own task backlog state"
  on public.task_backlog_state for update
  using (auth.uid() = id);
