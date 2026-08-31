-- Single JSON blob per user for the Sales Team Board (deals, closers,
-- setters), replacing the original app's fixed 3-account (Alex/Adriel/Des)
-- Upstash Redis keys. Private per portal account -- each user only ever
-- sees their own row, gated by auth.uid() rather than a shared team-wide
-- singleton. Same design as content_hub_state.
create table if not exists public.sales_board_state (
  id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.sales_board_state enable row level security;

create policy "Users can read their own sales board state"
  on public.sales_board_state for select
  using (auth.uid() = id);

create policy "Users can insert their own sales board state"
  on public.sales_board_state for insert
  with check (auth.uid() = id);

create policy "Users can update their own sales board state"
  on public.sales_board_state for update
  using (auth.uid() = id);
