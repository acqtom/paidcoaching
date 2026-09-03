-- Profile enrichment: avatar, bio, social links -- plus letting users
-- edit their own username via a real UI now (already technically allowed
-- by the "Users can update their own profile" policy from 0001, which
-- only ever checked ownership, never length).
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists instagram_url text;
alter table public.profiles add column if not exists youtube_url text;

-- Closes a real self-promotion hole that letting users edit their own
-- username opens up: admin status is purely "username is one character"
-- (is_admin() in 0009_communications.sql), so without this, any user
-- could rename themselves to a single letter and grant themselves admin.
-- auth.uid() is only present for a request made through the normal
-- RLS-gated path (the deployed app, or any API call carrying a real
-- user's session) -- it's null for a direct SQL connection (e.g. the
-- Supabase SQL editor), which is how provisioning a *new* admin should
-- actually happen going forward, same as the original seed in
-- 0002_..._seed_tom.sql. Only fires on an actual change (old <> new), so
-- an existing admin editing their bio/links doesn't get rejected just
-- for resubmitting their own existing one-letter username unchanged.
create or replace function public.enforce_username_length()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null
     and new.username is distinct from old.username
     and length(new.username::text) < 3
  then
    raise exception 'Username must be at least 3 characters';
  end if;
  return new;
end;
$$;

create trigger profiles_username_length
  before update on public.profiles
  for each row execute function public.enforce_username_length();

-- Avatars. Public bucket + random-UUID filenames, same trade-off as
-- chat-uploads (0009_communications.sql). Each user's files live under
-- avatars/<their-id>/... so the storage policies can restrict who can
-- write where using just the path, without needing to look anything up.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/png','image/jpeg','image/gif','image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png','image/jpeg','image/gif','image/webp'];

create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can replace their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
