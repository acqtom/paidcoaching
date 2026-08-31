-- Adds no-login team access to the Sales Team Board via a secret key,
-- mirroring the Weekly Content Hub's access_code design
-- (0005_content_hub_state.sql) but as its own separate column and
-- functions -- a team member with the sales board's key should never get
-- access to the content hub, or vice versa.
--
-- access_code is generated app-side on first load (see
-- ensureSalesBoardRow in src/lib/sales-board-state.ts), same as Content
-- Hub's.
alter table public.sales_board_state
  add column if not exists access_code text unique;

-- ---------- Secret-key access (no login) ----------
-- Two narrow, SECURITY DEFINER functions are the only way an anonymous
-- visitor ever touches this table. Unlike Content Hub's equivalent
-- functions (which overwrite the whole data blob), save here does a
-- shallow jsonb merge (`||`) of just the given patch over the existing
-- data -- the sales board's client only ever sends the fields that
-- changed (deals, or closers+setters), relying on the server to preserve
-- the rest, the same way the session-cookie /api/sales-board/save route
-- already does for logged-in owners.
create or replace function public.get_sales_board_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select data into result
  from public.sales_board_state
  where access_code = upper(p_code);
  return result;
end;
$$;

create or replace function public.save_sales_board_by_code(p_code text, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  update public.sales_board_state
  set data = coalesce(data, '{}'::jsonb) || p_patch, updated_at = now()
  where access_code = upper(p_code)
  returning data into result;
  return result;
end;
$$;

grant execute on function public.get_sales_board_by_code(text) to anon, authenticated;
grant execute on function public.save_sales_board_by_code(text, jsonb) to anon, authenticated;
