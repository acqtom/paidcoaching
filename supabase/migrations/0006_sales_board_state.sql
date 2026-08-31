-- Single JSON blob per sales-board account (Alex/Adriel/Des), replacing
-- the original app's Upstash Redis keys (deals:<offer>, closers:<offer>,
-- setters:<offer>) with one row per account holding all three. Shared
-- team-wide design like daily_kill_list_state/task_backlog_state -- RLS
-- just gates "is this an authenticated portal user" (to authenticated),
-- since the real "which account" check is the offer/password pair
-- validated server-side in the API routes (src/lib/sales-board-auth.ts),
-- matching the original app's own security model.
create table if not exists public.sales_board_state (
  account text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.sales_board_state enable row level security;

create policy "Authenticated users can read the shared sales board state"
  on public.sales_board_state for select
  to authenticated
  using (true);

create policy "Authenticated users can insert the shared sales board state"
  on public.sales_board_state for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update the shared sales board state"
  on public.sales_board_state for update
  to authenticated
  using (true);

insert into public.sales_board_state (account, data)
values
  ('alex', '{"deals": [], "closers": [], "setters": []}'::jsonb),
  ('adriel', '{"deals": [], "closers": [], "setters": []}'::jsonb),
  ('des', '{"deals": [], "closers": [], "setters": []}'::jsonb)
on conflict (account) do nothing;
