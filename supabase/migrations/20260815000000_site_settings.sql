-- Phase 4C: the only persisted setting with a concrete, wireable consumer
-- within this phase's constraints (site name/description/social links have
-- no current consumer — Navigation.tsx/Footer.tsx are explicitly off-limits
-- this phase — so adding them now would be decorative fields nothing reads,
-- which is exactly what this phase's brief says not to do). A default
-- publication removes friction from ContentForm's "new content" flow on a
-- site that today has exactly one publication.
--
-- Singleton table: `id boolean primary key default true check (id)` is the
-- standard Postgres pattern for "exactly one row, ever" — an insert of a
-- second row always violates the primary key on `true`.
create table public.site_settings (
  id boolean primary key default true,
  default_publication_id uuid references public.publications (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint site_settings_singleton check (id)
);

comment on table public.site_settings is 'Single-row table of editorial settings. Exactly one row (id = true), enforced by the primary key.';

create trigger set_site_settings_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

insert into public.site_settings (id) values (true) on conflict (id) do nothing;

alter table public.site_settings enable row level security;

-- Read: contributor+ (ContentForm's default-publication convenience is
-- available to anyone who can create content, not just editors/admins).
create policy site_settings_select
  on public.site_settings for select
  using (public.is_contributor_or_above());

-- Write: admin-only, matching this phase's brief ("ADMIN: Full management
-- of editorial settings" — not listed under EDITOR's permissions).
create policy site_settings_write
  on public.site_settings for update
  using (public.is_admin())
  with check (public.is_admin());
