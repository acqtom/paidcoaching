-- Public profile per user, holding the username shown to other students.
-- citext gives case-insensitive uniqueness ("Tom" and "tom" collide) while
-- preserving the case the user typed.
create extension if not exists citext;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext not null unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Creates the profile row automatically when someone signs up, pulling the
-- username out of the metadata passed to supabase.auth.signUp().
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
