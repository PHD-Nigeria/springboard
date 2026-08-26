-- Phase: Navigation Configuration. Converts the public header's
-- hard-coded three links (Navigation.tsx's NAV_LINKS/SEARCH_LINK) into an
-- ordinary CMS-managed list — same shape as sections/categories, not a
-- site_settings column: nav items are a list of independent records, not
-- singleton config, and need editor-or-admin write (site_settings_write is
-- admin-only table-wide, which would be the wrong fit here).

alter type public.audit_entity_type add value 'NAV_ITEM';

create table public.nav_items (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  href text not null,
  display_order integer not null default 0,
  is_visible boolean not null default true,
  is_external boolean not null default false,
  open_in_new_tab boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.nav_items is 'Public header navigation links, editor/admin-managed. Ordered by display_order.';

create trigger set_nav_items_updated_at
  before update on public.nav_items
  for each row execute function public.set_updated_at();

alter table public.nav_items enable row level security;

-- Public: only visible items, matching authors_select/categories_select's
-- `using (true)`-style openness but gated on is_visible since this table
-- (unlike those) has an explicit visibility toggle.
create policy nav_items_select
  on public.nav_items for select
  using (is_visible);

-- Write: editor-or-admin, matching sections_write/categories_write exactly
-- — contributors get neither USING nor WITH CHECK, so their writes match
-- zero rows (the existing permissionResult() pattern in taxonomy-actions.ts
-- detects and reports that, same as every other taxonomy mutation).
create policy nav_items_write
  on public.nav_items for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

-- Seed: the exact three links Navigation.tsx currently hard-codes, so this
-- migration is a pure refactor — nothing changes in what's rendered until
-- an admin/editor actually edits one of these rows.
insert into public.nav_items (label, href, display_order, is_visible, is_external, open_in_new_tab) values
  ('Insights', '/#more-stories', 1, true, false, false),
  ('People', '/#people', 2, true, false, false),
  ('Search', '/search', 3, true, false, false);
