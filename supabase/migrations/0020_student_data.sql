-- Full name, collected at signup (src/app/signup) and editable via the
-- profile modal like username/bio -- nullable since accounts made
-- before this existed have none.
alter table public.profiles add column if not exists full_name text;

-- Updated to also copy full_name out of signup metadata, alongside the
-- username copy this trigger has done since 0001_profiles.sql.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (new.id, new.raw_user_meta_data ->> 'username', new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

-- One row per (student, form) -- the two Typeform-style intake forms
-- under Start Here's CMO/CEO tabs. `answers` is a flat
-- { [questionId]: value } blob, opaque to the database -- only the
-- client (TypeformFlow.tsx) needs to know each question's shape.
create table public.intake_form_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  form text not null check (form in ('cmo', 'ceo')),
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  unique (user_id, form)
);

alter table public.intake_form_submissions enable row level security;

-- A student can read/write only their own submissions; admins can read
-- (never write) anyone's, for the Student Data page below.
create policy "Users can view their own intake submissions, admins view all"
  on public.intake_form_submissions for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy "Users can insert their own intake submissions"
  on public.intake_form_submissions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own intake submissions"
  on public.intake_form_submissions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admin-only roster for the Student Data page: joins profiles with
-- auth.users for fields RLS could never otherwise expose across users
-- (email, the real account-creation timestamp). is_admin() is checked
-- *inside* the function -- SECURITY DEFINER bypasses RLS entirely (that's
-- the only way to reach auth.users/other people's email at all), so this
-- check is the only thing standing between a non-admin caller and
-- everyone's email; a non-admin gets zero rows back, not an error.
-- One-letter (admin) usernames are excluded -- "students" means everyone
-- else.
create or replace function public.admin_list_students()
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_path text,
  email text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.username, p.full_name, p.avatar_path, u.email, u.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin(auth.uid())
    and length(p.username::text) <> 1
  order by u.created_at desc;
$$;

grant execute on function public.admin_list_students() to authenticated;
