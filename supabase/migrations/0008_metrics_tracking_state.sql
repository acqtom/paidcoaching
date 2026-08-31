-- Single JSON blob per user for Metrics Tracking (public/tracking-app/),
-- keyed the same way its existing localStorage shape already was --
-- { [metricId]: { [isoDate]: number } } -- so the client-side port to
-- this table needed no data-shape changes, just a new place to read/write
-- it from. Same per-user design as content_hub_state/sales_board_state:
-- each user only ever sees their own row, gated by auth.uid().
--
-- Only the metric *values* live here -- targets, tab names, card order,
-- and which funnel mode (VSL/Webinar) is currently displayed stay in
-- that browser's localStorage as before, since those are view
-- preferences, not data that needs to sync across devices or that the
-- Sales Team Board needs to write into.
--
-- This table is also where the Sales Team Board's Post Call Form
-- automatically pushes closed-call numbers on every save (see
-- src/lib/metrics-tracking-state.ts, called from
-- src/app/api/sales-board/save and /by-code) -- there's no separate
-- table or access-code flow for that, it's a normal write into this same
-- per-user row.
-- sales_board_dates tracks which dates the Sales Team Board push has
-- actually written a value for, per funnel mode ({vsl:[...],
-- webinar:[...]}) -- kept as its own column, not a key inside `data`,
-- specifically so a recompute can tell "a date I previously pushed to,
-- now with no qualifying deals" (zero it out) apart from "a date the user
-- manually typed a number into under one of the same metric ids, that no
-- deal has ever touched" (never touch it). See mergeSalesBoardMetrics in
-- src/lib/metrics-tracking-state.ts. The tracking UI never reads or
-- writes this column itself -- /api/tracking/session only ever returns
-- `data`.
create table if not exists public.metrics_tracking_state (
  id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  sales_board_dates jsonb not null default '{"vsl":[],"webinar":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.metrics_tracking_state enable row level security;

create policy "Users can read their own metrics tracking state"
  on public.metrics_tracking_state for select
  using (auth.uid() = id);

create policy "Users can insert their own metrics tracking state"
  on public.metrics_tracking_state for insert
  with check (auth.uid() = id);

create policy "Users can update their own metrics tracking state"
  on public.metrics_tracking_state for update
  using (auth.uid() = id);

-- Lets a Sales Team Board save made via its secret-key (no-login) flow
-- push into the right person's metrics_tracking_state row without ever
-- exposing anything else about that row. Safe to expose just the id: an
-- anonymous caller who already holds a valid access_code already has
-- full read/write access to that account's sales data via
-- get_sales_board_by_code/save_sales_board_by_code (0007_...sql) -- this
-- adds no capability beyond what the code itself already grants, and RLS
-- still requires actually being authenticated as that id for anything
-- else.
create or replace function public.get_sales_board_owner_id(p_code text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from public.sales_board_state where access_code = upper(p_code);
$$;

grant execute on function public.get_sales_board_owner_id(text) to anon, authenticated;
