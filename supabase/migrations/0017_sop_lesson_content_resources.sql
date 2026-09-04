-- Lesson content becomes a full-size block for pasting whatever's
-- needed, not just a short note -- renaming the column to match what it
-- now holds (rendered as a large textarea in SopDetail.tsx, editable by
-- admins, instead of the small "Notes" field that used to live in the
-- add/edit lesson modal). Also adds per-lesson "Resources" links
-- (title + URL, admin-addable, shown underneath that content block).
alter table public.sop_lessons rename column notes to content;

create table public.sop_lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.sop_lessons(id) on delete cascade,
  title text not null,
  url text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.sop_lesson_resources enable row level security;

-- Same view-open-to-everyone, write-gated-to-admins split as the rest of
-- the SOP tables (0016_sops.sql).
create policy "Authenticated users can view SOP lesson resources"
  on public.sop_lesson_resources for select to authenticated using (true);

create policy "Admins can insert SOP lesson resources"
  on public.sop_lesson_resources for insert to authenticated with check (public.is_admin(auth.uid()));
create policy "Admins can update SOP lesson resources"
  on public.sop_lesson_resources for update to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "Admins can delete SOP lesson resources"
  on public.sop_lesson_resources for delete to authenticated using (public.is_admin(auth.uid()));
