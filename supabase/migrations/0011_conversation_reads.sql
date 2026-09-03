-- Powers the dashboard's Communications card turning green when there's
-- an unread message in any channel or the user's DM. Needs per-conversation
-- tracking, not one global "last opened Communications" timestamp -- a
-- user who read channel A today but has never opened channel B (which has
-- an older unread message) must still see the badge; a single global
-- timestamp would incorrectly clear it.

create table if not exists public.conversation_reads (
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

alter table public.conversation_reads enable row level security;

create policy "Users manage their own read state"
  on public.conversation_reads for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- True if any conversation visible to the caller has a message from
-- someone else, not deleted, newer than the caller's last_read_at for
-- that conversation (or the conversation has never been read at all).
-- Deliberately NOT security definer -- runs with the caller's own RLS, so
-- it only ever sees what that user could already see directly, and never
-- needs an explicit visibility check duplicating the messages/
-- conversations policies.
create or replace function public.has_unread_communications()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.messages m
    where m.sender_id <> auth.uid()
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

grant execute on function public.has_unread_communications() to authenticated;
