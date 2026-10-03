-- Accounting hub numbers, one JSON blob per account, private to that
-- account (auth.uid() = id), same shape as sales_board_state and
-- metrics_tracking_state. Previously this lived only in each browser's
-- localStorage, shared by everyone who used that browser. New accounts
-- start with no row, so every account starts at zero.
create table if not exists public.accounting_state (
  id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.accounting_state enable row level security;

create policy "Users can read their own accounting state"
  on public.accounting_state for select
  using (auth.uid() = id);

create policy "Users can insert their own accounting state"
  on public.accounting_state for insert
  with check (auth.uid() = id);

create policy "Users can update their own accounting state"
  on public.accounting_state for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
