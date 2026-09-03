-- Emoji reactions on messages.
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  -- Denormalized from messages.conversation_id -- purely so the realtime
  -- subscription can filter by conversation_id the same way messages'
  -- own subscription already does, instead of every client receiving
  -- every reaction change anywhere and filtering client-side.
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

alter table public.message_reactions enable row level security;

create policy "Read reactions on messages you can see"
  on public.message_reactions for select
  to authenticated
  using (
    exists (
      select 1 from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_reactions.message_id
        and (c.type = 'channel' or c.dm_user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

-- Ties message_id and the (denormalized) conversation_id together via the
-- join, so a client can't fake conversation_id to sneak a reaction onto a
-- message in a conversation it can't actually see.
create policy "Add your own reaction on messages you can see"
  on public.message_reactions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_reactions.message_id
        and c.id = message_reactions.conversation_id
        and (c.type = 'channel' or c.dm_user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

create policy "Remove your own reaction"
  on public.message_reactions for delete
  to authenticated
  using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;

-- Message editing: sender-only, never admin (unlike delete -- rewriting
-- someone else's words is a fundamentally different capability than
-- removing them), and never on an already-deleted message. Replaces
-- 0010's "delete only" trigger, which flatly forbade any body change --
-- body can change now, but only under these exact rules. This has to be
-- a trigger rather than an RLS check because the rule depends on
-- comparing old vs. new values together (specifically whether body
-- changed), not just "is this user allowed to touch this row at all"
-- (which is still what the existing UPDATE policy from 0010 gates).
alter table public.messages add column if not exists edited_at timestamptz;

drop trigger if exists messages_delete_only on public.messages;
drop function if exists public.enforce_message_delete_only();

create or replace function public.enforce_message_update_rules()
returns trigger
language plpgsql
as $$
begin
  if new.image_path is distinct from old.image_path
     or new.sender_id is distinct from old.sender_id
     or new.conversation_id is distinct from old.conversation_id
  then
    raise exception 'Messages cannot change who sent them, their photo, or which conversation they belong to';
  end if;

  if new.body is distinct from old.body then
    if old.sender_id is distinct from auth.uid() then
      raise exception 'Only the original sender can edit a message';
    end if;
    if old.deleted_at is not null then
      raise exception 'Cannot edit a deleted message';
    end if;
    new.edited_at := now();
  end if;

  return new;
end;
$$;

create trigger messages_update_rules
  before update on public.messages
  for each row execute function public.enforce_message_update_rules();
