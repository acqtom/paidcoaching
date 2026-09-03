-- Per-channel "admins only can post" toggle. Doesn't apply to DMs -- the
-- toggle only ever renders for type = 'channel' conversations.
alter table public.conversations add column if not exists admin_only_posting boolean not null default false;

-- No UPDATE policy on conversations existed before this -- admins can now
-- flip this one setting (or, in principle, rename/etc., but the only
-- thing the UI ever calls this for is admin_only_posting).
create policy "Admins can update channels"
  on public.conversations for update
  to authenticated
  using (type = 'channel' and public.is_admin(auth.uid()))
  with check (type = 'channel' and public.is_admin(auth.uid()));

-- Replaces the INSERT policy from 0009_communications.sql: a locked
-- channel can still be posted in by an admin, just not by anyone else.
-- DMs and unlocked channels are unaffected.
drop policy if exists "Send messages in conversations you can see" on public.messages;

create policy "Send messages in conversations you can see"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (
          (c.type = 'channel' and (not c.admin_only_posting or public.is_admin(auth.uid())))
          or c.dm_user_id = auth.uid()
          or public.is_admin(auth.uid())
        )
    )
  );
