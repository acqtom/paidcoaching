-- Moves SOP content (SOPs, sub-categories, lessons) out of the hardcoded
-- src/lib/sops.ts data and into the database so admins (one-letter
-- usernames -- is_admin() from 0009_communications.sql, the one place
-- "admin" is ever defined in this app) can add, edit, and delete them.
-- Departments themselves (Operations, Marketing, Sales, Fulfilment) stay
-- hardcoded in src/lib/sops.ts -- a fixed set of 4 with their own icons,
-- not something that needs to grow.
create table public.sops (
  id uuid primary key default gen_random_uuid(),
  department_slug text not null check (department_slug in ('operations', 'marketing', 'sales', 'fulfilment')),
  slug text not null,
  title text not null,
  description text not null default '',
  gradient text not null default 'from-neutral-800 to-neutral-950',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (department_slug, slug)
);

create table public.sop_subcategories (
  id uuid primary key default gen_random_uuid(),
  sop_id uuid not null references public.sops(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- Lessons store a video link (Loom/YouTube -- rendered as an embed where
-- recognized, otherwise a plain "watch" link) plus free-text notes. No
-- PDF/file upload in this pass -- kept to what's actually needed now.
create table public.sop_lessons (
  id uuid primary key default gen_random_uuid(),
  subcategory_id uuid not null references public.sop_subcategories(id) on delete cascade,
  title text not null,
  video_url text,
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.sops enable row level security;
alter table public.sop_subcategories enable row level security;
alter table public.sop_lessons enable row level security;

-- Any signed-in user can view -- SOPs aren't secret internally, same as
-- everything else in this app that's gated purely by "is this a real
-- logged-in user" rather than a per-row ownership check.
create policy "Authenticated users can view SOPs"
  on public.sops for select to authenticated using (true);
create policy "Authenticated users can view SOP subcategories"
  on public.sop_subcategories for select to authenticated using (true);
create policy "Authenticated users can view SOP lessons"
  on public.sop_lessons for select to authenticated using (true);

-- Only admins can write. Regular users get read-only access via the
-- select policies above and nothing else.
create policy "Admins can insert SOPs"
  on public.sops for insert to authenticated with check (public.is_admin(auth.uid()));
create policy "Admins can update SOPs"
  on public.sops for update to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "Admins can delete SOPs"
  on public.sops for delete to authenticated using (public.is_admin(auth.uid()));

create policy "Admins can insert SOP subcategories"
  on public.sop_subcategories for insert to authenticated with check (public.is_admin(auth.uid()));
create policy "Admins can update SOP subcategories"
  on public.sop_subcategories for update to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "Admins can delete SOP subcategories"
  on public.sop_subcategories for delete to authenticated using (public.is_admin(auth.uid()));

create policy "Admins can insert SOP lessons"
  on public.sop_lessons for insert to authenticated with check (public.is_admin(auth.uid()));
create policy "Admins can update SOP lessons"
  on public.sop_lessons for update to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "Admins can delete SOP lessons"
  on public.sop_lessons for delete to authenticated using (public.is_admin(auth.uid()));

-- Seed: carries over the SOPs that already existed as hardcoded data in
-- src/lib/sops.ts, with the same slugs (so existing /dashboard/sops/...
-- links keep working) and the same single "Getting Started > Overview"
-- starter lesson every SOP had.
insert into public.sops (department_slug, slug, title, description, gradient, position) values
  ('operations', 'vsl-funnel', 'VSL Funnel', 'How the VSL funnel is built and maintained.', 'from-blue-600 to-indigo-800', 0),
  ('operations', 'webinar-funnel', 'Webinar Funnel', 'How the webinar funnel is built and maintained.', 'from-orange-400 via-pink-400 to-purple-500', 1),
  ('operations', 'confirmation-page-best-practices', 'Confirmation Page Best Practices', 'What makes a confirmation page convert.', 'from-purple-700 to-fuchsia-600', 2),
  ('operations', 'crm-setup', 'CRM Setup / Organisation', 'How the CRM is set up and kept organised.', 'from-cyan-700 via-teal-700 to-slate-900', 3),
  ('operations', 'tracking', 'Tracking', 'How tracking is set up across the funnel.', 'from-neutral-800 to-neutral-950', 4),
  ('operations', 'automations', 'Zapier / Automations', 'The automations that connect everything.', 'from-emerald-600 to-teal-800', 5),
  ('marketing', 'webinar-best-practices', 'Webinar Best Practices', 'How to run a webinar that converts.', 'from-blue-600 to-indigo-800', 0),
  ('marketing', 'vsl-best-practices', 'VSL Best Practices', 'How to write and produce a VSL that converts.', 'from-orange-400 via-pink-400 to-purple-500', 1),
  ('marketing', 'youtube-mastery', 'YouTube Mastery', 'How we approach YouTube as a channel.', 'from-purple-700 to-fuchsia-600', 2),
  ('marketing', 'ads-mastery', 'Ads Mastery', 'How we plan, launch, and manage ads.', 'from-cyan-700 via-teal-700 to-slate-900', 3),
  ('sales', 'managing-a-team', 'Managing a Team', 'How to manage the sales team.', 'from-blue-600 to-indigo-800', 0),
  ('sales', 'setters', 'Setters', 'The setter role and process.', 'from-orange-400 via-pink-400 to-purple-500', 1),
  ('sales', 'closers', 'Closers', 'The closer role and process.', 'from-purple-700 to-fuchsia-600', 2),
  ('sales', 'sales-managers', 'Sales Managers', 'The sales manager role and process.', 'from-cyan-700 via-teal-700 to-slate-900', 3);

insert into public.sop_subcategories (sop_id, name, position)
select id, 'Getting Started', 0 from public.sops;

insert into public.sop_lessons (subcategory_id, title, position)
select id, 'Overview', 0 from public.sop_subcategories;
