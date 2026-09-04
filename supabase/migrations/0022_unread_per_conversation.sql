-- Per-conversation unread status for the Communications sidebar (bold
-- name + a green dot next to any channel/DM with something unread in
-- it) -- has_unread_communications() (0011_conversation_reads.sql,
-- fixed in 0012) only ever answered "is anything, anywhere, unread",
-- which is enough for the dashboard card but not enough to know *which*
-- sidebar rows to mark. Same query shape, same NULL-safe
-- `sender_id is null or sender_id <> auth.uid()` check (a bot message's
-- sender_id is null, and NULL <> anything is NULL, not true, so without
-- this a welcome message would never count as unread here either) --
-- just grouped by conversation instead of collapsed to one boolean.
-- Deliberately NOT security definer, same reasoning as
-- has_unread_communications(): runs under the caller's own RLS, so it
-- only ever sees conversations/messages that caller could already query
-- directly.
create or replace function public.unread_conversation_ids()
returns table (conversation_id uuid)
language sql
stable
as $$
  select distinct m.conversation_id
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
    );
$$;

grant execute on function public.unread_conversation_ids() to authenticated;
