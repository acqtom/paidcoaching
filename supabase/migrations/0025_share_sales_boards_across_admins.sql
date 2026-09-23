-- 0023_multi_sales_boards.sql scoped every extra Sales Team Board to
-- whichever admin created it (owner_id = auth.uid()), so a second
-- one-letter-username admin saw an empty board list even though both
-- accounts were equally "admin." Per explicit direction, boards are now
-- a single shared pool: any admin can see, edit, and manage every
-- board, not just the ones they personally created. `owner_id` stays on
-- the table as a record of who created each board, but is no longer
-- part of the access check.

drop policy "Admins manage their own sales boards" on public.sales_boards;

create policy "Any admin manages every sales board"
  on public.sales_boards for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy "Admins manage their own board metrics" on public.metrics_tracking_boards;

create policy "Any admin manages every board's metrics"
  on public.metrics_tracking_boards for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
