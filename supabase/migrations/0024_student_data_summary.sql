-- Powers the summary cards at the top of Student Data: total accounts,
-- total users (accounts + the closer/setter names students have added to
-- their own Sales Boards), total cash students have collected in their
-- own Sales Boards (all-time / 90d / 30d), and average daily time-on-site.

-- Every student's own sales_board_state row (deals, closers, setters) --
-- this is revenue THEY collected running their own business via the
-- Sales Board tool, not anything the coaching business charged them.
-- Same admin-only, one-letter-usernames-excluded shape as
-- admin_list_students() in 0020_student_data.sql.
create or replace function public.admin_list_student_sales_data()
returns table (user_id uuid, data jsonb)
language sql
security definer
set search_path = public
stable
as $$
  select s.id, s.data
  from public.sales_board_state s
  join public.profiles p on p.id = s.id
  where public.is_admin(auth.uid())
    and length(p.username::text) <> 1;
$$;

grant execute on function public.admin_list_student_sales_data() to authenticated;

-- One row per (user, calendar day), accumulating seconds spent with the
-- portal open and visible -- fed by record_activity_heartbeat() below.
-- No table-level policies: every access (from any account, admin or not)
-- goes through the two SECURITY DEFINER functions, so no one can read or
-- inflate another user's activity directly.
create table public.activity_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  active_seconds integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.activity_daily enable row level security;

-- Called every ~20s by ActivityHeartbeat while a logged-in user has the
-- portal open and visible. p_seconds is clamped to a sane range so a
-- stale timer (e.g. a laptop waking from sleep) can't inflate a day's
-- total; the date comes from the browser's own local calendar day, same
-- as the "Today's Cash Collected" fix.
create or replace function public.record_activity_heartbeat(p_date date, p_seconds integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  insert into public.activity_daily (user_id, date, active_seconds, updated_at)
  values (auth.uid(), p_date, least(greatest(p_seconds, 0), 60), now())
  on conflict (user_id, date)
  do update set
    active_seconds = public.activity_daily.active_seconds + least(greatest(p_seconds, 0), 60),
    updated_at = now();
end;
$$;

grant execute on function public.record_activity_heartbeat(date, integer) to authenticated;

-- Average seconds per (student, active day) -- i.e. "on a day a student
-- uses the portal, how long do they spend here on average." Students
-- only, same exclusion as everywhere else on this page.
create or replace function public.admin_average_daily_activity_seconds()
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(avg(a.active_seconds), 0)
  from public.activity_daily a
  join public.profiles p on p.id = a.user_id
  where public.is_admin(auth.uid())
    and length(p.username::text) <> 1;
$$;

grant execute on function public.admin_average_daily_activity_seconds() to authenticated;
