-- Lets admins delete a channel (and everything posted in it). Never
-- DMs -- gated on type = 'channel', the same restriction the update
-- policy (admin_only_posting toggle, 0013_channel_lock.sql) already
-- uses. Messages, message_reactions, and conversation_reads all
-- reference conversations.id with `on delete cascade` already (see
-- 0009_communications.sql, 0011_conversation_reads.sql,
-- 0014_reactions_and_edit.sql), so deleting the conversation row alone
-- is enough to clean up everything in it -- no separate cleanup needed.
create policy "Admins can delete channels"
  on public.conversations for delete
  to authenticated
  using (type = 'channel' and public.is_admin(auth.uid()));
