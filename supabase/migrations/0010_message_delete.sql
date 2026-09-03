-- Soft delete for messages: a sender can delete their own message, an
-- admin can delete anyone's. This is a soft delete (deleted_at set, row
-- kept), not an erase -- reconciling "delete this from the chat" with the
-- earlier explicit requirement that all text be saved. The UI just shows
-- "This message was deleted" in place of the real content once set.

alter table public.messages add column if not exists deleted_at timestamptz;
alter table public.messages add column if not exists deleted_by uuid references public.profiles (id);

create policy "Sender or admin can soft-delete a message"
  on public.messages for update
  to authenticated
  using (sender_id = auth.uid() or public.is_admin(auth.uid()))
  with check (sender_id = auth.uid() or public.is_admin(auth.uid()));

-- The UPDATE policy above only checks *who* can update a row, not *what*
-- they change -- this trigger is what actually restricts it to a delete
-- (deleted_at/deleted_by) rather than silently allowing message content
-- to be edited, which was never asked for.
create or replace function public.enforce_message_delete_only()
returns trigger
language plpgsql
as $$
begin
  if new.body is distinct from old.body
     or new.image_path is distinct from old.image_path
     or new.sender_id is distinct from old.sender_id
     or new.conversation_id is distinct from old.conversation_id
  then
    raise exception 'Messages can only be soft-deleted, not edited';
  end if;
  return new;
end;
$$;

create trigger messages_delete_only
  before update on public.messages
  for each row execute function public.enforce_message_delete_only();
