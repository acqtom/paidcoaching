-- Single JSON blob per user for the Weekly Content Hub (Kanban board +
-- Content documents + Team roster). Unlike every other feature's shared
-- team-wide singleton row, this one is private per account -- each user
-- only ever sees their own row, gated by auth.uid() rather than a fixed
-- id.
--
-- access_code is a 5-character secret each user's row gets automatically
-- (generated app-side on first load, see src/lib/content-hub-code.ts) so
-- a team member without a portal account can reach that one person's hub
-- via /team-access, without ever logging in. It's a dedicated column
-- (not buried in the jsonb) so it can be looked up directly and carries
-- its own uniqueness constraint.
create table if not exists public.content_hub_state (
  id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  access_code text unique,
  updated_at timestamptz not null default now()
);

alter table public.content_hub_state enable row level security;

create policy "Users can read their own content hub state"
  on public.content_hub_state for select
  using (auth.uid() = id);

create policy "Users can insert their own content hub state"
  on public.content_hub_state for insert
  with check (auth.uid() = id);

create policy "Users can update their own content hub state"
  on public.content_hub_state for update
  using (auth.uid() = id);

-- ---------- Secret-key access (no login) ----------
-- Two narrow, SECURITY DEFINER functions are the only way an anonymous
-- visitor ever touches this table -- each does exactly one thing (look up
-- or overwrite the data blob for a single matching access_code) and never
-- returns anything else about the row (no id/user reference), so there's
-- no need for a service-role key anywhere in the app to support this.
create or replace function public.get_content_hub_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select data into result
  from public.content_hub_state
  where access_code = upper(p_code);
  return result;
end;
$$;

create or replace function public.save_content_hub_by_code(p_code text, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  update public.content_hub_state
  set data = p_data, updated_at = now()
  where access_code = upper(p_code)
  returning data into result;
  return result;
end;
$$;

grant execute on function public.get_content_hub_by_code(text) to anon, authenticated;
grant execute on function public.save_content_hub_by_code(text, jsonb) to anon, authenticated;
