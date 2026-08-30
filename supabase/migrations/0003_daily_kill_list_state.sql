-- Single shared JSON blob for the Daily Kill List app (needle-movers, calls,
-- client to-dos, braindump, revenue). This app has exactly one shared state
-- across everyone with access to the portal, not per-user data, so it's one
-- singleton row rather than a table keyed by user.
create table if not exists public.daily_kill_list_state (
  id smallint primary key default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint daily_kill_list_state_singleton check (id = 1)
);

alter table public.daily_kill_list_state enable row level security;

-- Anyone who made it past Supabase Auth login (i.e. anyone with a portal
-- account) can read and write the shared state -- matching the original
-- app's own "this app has exactly one user" design, just extended to
-- "one shared team", not locked down per-person.
create policy "Authenticated users can read the shared state"
  on public.daily_kill_list_state for select
  to authenticated
  using (true);

create policy "Authenticated users can insert the shared state"
  on public.daily_kill_list_state for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update the shared state"
  on public.daily_kill_list_state for update
  to authenticated
  using (true);

insert into public.daily_kill_list_state (id, data)
values (1, '{}'::jsonb)
on conflict (id) do nothing;
