-- Communications Hub: channels (open, admin-created) + a private 1-1 DM
-- per regular user that's shared across every admin (a support-inbox
-- model, not a fixed pairing with one specific admin -- so it still works
-- if a second admin is added later). "Admin" is not a separate role
-- column: it's simply a one-letter username (see is_admin() below and
-- 0002_..._seed_tom.sql, which already seeded the username 't').

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('channel', 'dm')),
  name text,
  created_by uuid references public.profiles (id) on delete set null,
  dm_user_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint conversations_channel_has_name check (type <> 'channel' or name is not null),
  constraint conversations_dm_has_user check (type <> 'dm' or dm_user_id is not null)
);

-- One DM conversation per regular user, ever -- enforced here rather than
-- just in application code, since it's also what the profile-insert
-- trigger below relies on via ON CONFLICT.
create unique index if not exists conversations_dm_user_unique
  on public.conversations (dm_user_id)
  where type = 'dm';

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text,
  image_path text,
  created_at timestamptz not null default now(),
  constraint messages_has_content check (
    (body is not null and length(trim(body)) > 0) or image_path is not null
  )
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- The one place "admin" is actually defined: a one-letter username.
create or replace function public.is_admin(p_uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles where id = p_uid and length(username::text) = 1
  );
$$;

create policy "Read channels; DM participants and admins read DMs"
  on public.conversations for select
  to authenticated
  using (
    type = 'channel'
    or dm_user_id = auth.uid()
    or public.is_admin(auth.uid())
  );

-- Only admins create channels (per explicit direction). DM rows are never
-- inserted directly by any client -- only by the trigger below, which runs
-- as the table owner and bypasses RLS -- so there's no INSERT policy for
-- type = 'dm' at all.
create policy "Admins create channels"
  on public.conversations for insert
  to authenticated
  with check (type = 'channel' and public.is_admin(auth.uid()) and created_by = auth.uid());

create policy "Read messages in conversations you can see"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.type = 'channel' or c.dm_user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

create policy "Send messages in conversations you can see"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.type = 'channel' or c.dm_user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

-- Every regular (non-admin) user gets their own DM conversation the moment
-- their profile exists, so it's there immediately -- no "start a DM" flow
-- needed, and admins see every team member listed from day one rather
-- than only after that person opens Communications for the first time.
create or replace function public.handle_new_profile_dm()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if length(new.username::text) > 1 then
    insert into public.conversations (type, dm_user_id)
    values ('dm', new.id)
    on conflict (dm_user_id) where type = 'dm' do nothing;
  end if;
  return new;
end;
$$;

create trigger on_profile_created_make_dm
  after insert on public.profiles
  for each row execute function public.handle_new_profile_dm();

-- Backfill for accounts that already existed before this migration ran.
insert into public.conversations (type, dm_user_id)
select 'dm', p.id
from public.profiles p
where length(p.username::text) > 1
on conflict (dm_user_id) where type = 'dm' do nothing;

-- Realtime: messages need to broadcast on insert so the chat updates
-- live. Guarded so re-running this migration doesn't error on an
-- already-added table.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- Photo uploads. Public bucket (not signed URLs) is a deliberate
-- simplicity trade-off for v1: paths are random UUIDs, this is low-
-- sensitivity internal team chat, and it avoids needing to refresh
-- expired signed URLs just to render an <img>.
-- file_size_limit/allowed_mime_types are enforced by Storage itself, not
-- just the client-side checks in CommunicationsApp.tsx (which can be
-- bypassed by anyone calling the API directly).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-uploads', 'chat-uploads', true, 8388608, array['image/png','image/jpeg','image/gif','image/webp','image/heic','image/heif'])
on conflict (id) do update set
  public = true,
  file_size_limit = 8388608,
  allowed_mime_types = array['image/png','image/jpeg','image/gif','image/webp','image/heic','image/heif'];

create policy "Anyone can view chat uploads"
  on storage.objects for select
  using (bucket_id = 'chat-uploads');

create policy "Authenticated users can upload chat photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-uploads');
