-- Auto-welcomes every new signup into a #general channel with a message
-- from a "bot" -- not a real account, so sender_id becomes nullable
-- (null = system/bot message, not "unknown sender"). Avoids needing a
-- fake auth.users row just to have something to post as.
alter table public.messages alter column sender_id drop not null;

-- Channel names must be unique -- also what makes "find or create
-- #general" race-safe if two people happen to sign up at the same time.
create unique index if not exists conversations_channel_name_unique
  on public.conversations (name)
  where type = 'channel';

create or replace function public.handle_new_profile_welcome()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  general_id uuid;
begin
  insert into public.conversations (type, name)
  values ('channel', 'general')
  on conflict (name) where type = 'channel' do nothing;

  select id into general_id
  from public.conversations
  where type = 'channel' and name = 'general';

  insert into public.messages (conversation_id, sender_id, body)
  values (
    general_id,
    null,
    '👋 Everyone, please welcome @' || new.username ||
      ' to the team! So glad you''re here — jump in, say hi, and make yourself at home.'
  );

  return new;
end;
$$;

create trigger on_profile_created_welcome
  after insert on public.profiles
  for each row execute function public.handle_new_profile_welcome();

-- Fix for a real bug this feature would otherwise introduce:
-- has_unread_communications() (0011_conversation_reads.sql) originally
-- checked `m.sender_id <> auth.uid()`, but in SQL NULL <> anything is
-- NULL, not true -- so a bot message (sender_id null) would silently
-- never count as unread and the dashboard badge would never notice a
-- welcome message. `is null or ...` makes a bot message always count as
-- "not from me".
create or replace function public.has_unread_communications()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.messages m
    where (m.sender_id is null or m.sender_id <> auth.uid())
      and m.deleted_at is null
      and m.created_at > coalesce(
        (
          select cr.last_read_at
          from public.conversation_reads cr
          where cr.user_id = auth.uid() and cr.conversation_id = m.conversation_id
        ),
        'epoch'::timestamptz
      )
  );
$$;
