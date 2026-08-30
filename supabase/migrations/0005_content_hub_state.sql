-- Single JSON blob per user for the Weekly Content Hub (Kanban board +
-- Content documents). Unlike every other feature's shared team-wide
-- singleton row, this one is private per account -- each user only ever
-- sees their own row, gated by auth.uid() rather than a fixed id.
create table if not exists public.content_hub_state (
  id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.content_hub_state enable row level security;

create policy "Users can read their own content hub state"
  on public.content_hub_state for select
  using (auth.uid() = id);

create policy "Users can insert their own content hub state"
  on public.content_hub_state for insert
  with check (auth.uid() = id);

create policy "Users can update their own content hub state"
  on public.content_hub_state for update
  using (auth.uid() = id);
