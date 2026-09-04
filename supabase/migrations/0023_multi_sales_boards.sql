-- Lets an admin (one-letter username) run MULTIPLE Sales Team Boards at
-- once (one per offer), each with its own deals/closers/setters, its own
-- team access code, and its own separate Metrics Tracking data --
-- entirely additive and parallel to the existing single-board-per-
-- account system (sales_board_state, metrics_tracking_state), which
-- stays completely untouched and keeps working exactly as before for
-- every non-admin account. Per explicit direction, existing
-- sales_board_state data is NOT migrated into this new system -- an
-- admin's old board simply isn't one of these rows; it stays exactly
-- where it is, unreferenced by anything new, and every admin starts
-- with zero boards here.
create table public.sales_boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  access_code text unique,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sales_boards enable row level security;

-- Admin-only in every direction, not just at the UI layer -- "admin
-- dashboard only" per explicit direction, not merely hidden from
-- non-admins who could otherwise still reach it directly via the API.
create policy "Admins manage their own sales boards"
  on public.sales_boards for all
  to authenticated
  using (owner_id = auth.uid() and public.is_admin(auth.uid()))
  with check (owner_id = auth.uid() and public.is_admin(auth.uid()));

-- One Metrics Tracking dataset per board, auto-created the moment a
-- board is (the "auto syncs with a new metrics tracking it auto makes"
-- part) -- same data shape metrics_tracking_state already uses
-- ({ [metricId]: { [isoDate]: number } }), just keyed by board_id
-- instead of a user id.
create table public.metrics_tracking_boards (
  board_id uuid primary key references public.sales_boards (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  sales_board_dates jsonb not null default '{"vsl":[],"webinar":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.metrics_tracking_boards enable row level security;

create policy "Admins manage their own board metrics"
  on public.metrics_tracking_boards for all
  to authenticated
  using (
    public.is_admin(auth.uid())
    and exists (select 1 from public.sales_boards sb where sb.id = board_id and sb.owner_id = auth.uid())
  )
  with check (
    public.is_admin(auth.uid())
    and exists (select 1 from public.sales_boards sb where sb.id = board_id and sb.owner_id = auth.uid())
  );

-- Runs as the function owner (bypassing RLS, same as every other
-- trigger in this app that creates a related row), so this fires
-- regardless of the inserting policy's own USING/WITH CHECK.
create or replace function public.handle_new_sales_board()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.metrics_tracking_boards (board_id) values (new.id);
  return new;
end;
$$;

create trigger on_sales_board_created
  after insert on public.sales_boards
  for each row execute function public.handle_new_sales_board();

-- ---------- Secret-key (no-login) access for a specific board ----------
-- Own functions, own route (/api/sales-boards/by-code), entirely
-- parallel to get_sales_board_by_code/save_sales_board_by_code
-- (0007_sales_board_access_code.sql), which stay untouched and keep
-- serving the old singleton system's own codes -- the two code spaces
-- are unrelated, so a code from one system is never valid in the other.
create or replace function public.get_board_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select data into result
  from public.sales_boards
  where access_code = upper(p_code);
  return result;
end;
$$;

create or replace function public.save_board_by_code(p_code text, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  update public.sales_boards
  set data = coalesce(data, '{}'::jsonb) || p_patch, updated_at = now()
  where access_code = upper(p_code)
  returning data into result;
  return result;
end;
$$;

-- Resolves a code straight to its board id -- lets the by-code save
-- route push metrics into that exact board's metrics_tracking_boards
-- row without a second round trip through the data itself.
create or replace function public.get_board_id_by_code(p_code text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.sales_boards where access_code = upper(p_code);
$$;

grant execute on function public.get_board_by_code(text) to anon, authenticated;
grant execute on function public.save_board_by_code(text, jsonb) to anon, authenticated;
grant execute on function public.get_board_id_by_code(text) to anon, authenticated;
