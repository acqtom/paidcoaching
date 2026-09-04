-- One payment record per student -- what they paid upfront, what's still
-- owed, and when that's due. Admin-only in both directions (no student-
-- read policy at all): this is internal ops data shown on the Student
-- Data admin page, not something a student ever sees in their own
-- portal. `paid` is an explicit flag (not inferred from amount_due = 0)
-- since a partial payment might never bring the balance to exactly
-- zero, and an admin should be able to clear the overdue flag with one
-- action regardless of the exact amounts involved.
create table public.student_payments (
  user_id uuid primary key references auth.users (id) on delete cascade,
  amount_paid_upfront numeric not null default 0,
  amount_due numeric not null default 0,
  due_date date,
  paid boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.student_payments enable row level security;

create policy "Admins can view student payments"
  on public.student_payments for select
  using (public.is_admin(auth.uid()));

create policy "Admins can insert student payments"
  on public.student_payments for insert
  with check (public.is_admin(auth.uid()));

create policy "Admins can update student payments"
  on public.student_payments for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
