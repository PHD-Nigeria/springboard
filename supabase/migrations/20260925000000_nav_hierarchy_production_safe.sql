-- PRODUCTION-SAFE REPLACEMENT for 20260924000000_nav_hierarchy_and_editorial_categories.sql.
--
-- That migration was written and tested against an empty local database and
-- assumed nav_items had nothing real in it yet. Production does not match
-- that assumption: it already has 9 real nav_items rows and 9 real
-- categories rows, hand-created by PHD Nigeria staff through the live admin
-- between 2026-08-26 and 2026-09-11, entirely independent of this project's
-- local seed data. That migration's `delete from public.nav_items;` would
-- destroy all of it. This migration does the same structural job (adds the
-- parent_id hierarchy, groups the existing items, adds the categories the
-- new landing pages read from) without deleting or overwriting anything
-- real. It is written to be safe to run more than once (every write below
-- is guarded so a second run is a no-op).
--
-- 20260924000000_nav_hierarchy_and_editorial_categories.sql itself is never
-- executed against production. Instead its version is marked "applied" in
-- Supabase's migration history via `supabase migration repair` (metadata
-- only, no SQL from that file ever runs) so a future `supabase db push`
-- skips straight past it to this one. See the accompanying report for the
-- exact command.

-- ---------------------------------------------------------------- nav_items
-- Identical shape to the original migration's schema change (parent_id,
-- href becoming optional for a group heading) — `if not exists` makes it a
-- no-op if this ever runs twice, or if parent_id somehow already exists.
alter table public.nav_items
  add column if not exists parent_id uuid references public.nav_items (id) on delete cascade;

alter table public.nav_items
  alter column href set default '';

-- Only relaxes/reinstates the NOT NULL constraint if it's still active —
-- running this twice must not error the second time.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'nav_items' and column_name = 'href' and is_nullable = 'NO'
  ) then
    alter table public.nav_items alter column href drop not null;
    update public.nav_items set href = '' where href is null;
    alter table public.nav_items alter column href set not null;
  end if;
end $$;

create index if not exists nav_items_parent_id_idx on public.nav_items (parent_id);

comment on column public.nav_items.parent_id is 'Null for a top-level item (a standalone link like Search, or a group heading). Set for a child item nested under a group.';
comment on column public.nav_items.href is 'Empty string for a group heading with no destination of its own (it renders as a disclosure trigger, not a link) — every real destination, top-level or nested, has a non-empty href.';

-- Three group headings. Guarded on (parent_id is null and href = '' and
-- label = X) so re-running this migration never creates duplicates.
do $$
declare
  people_group uuid;
  company_group uuid;
  engagement_group uuid;
begin
  if not exists (select 1 from public.nav_items where parent_id is null and href = '' and label = 'People & Culture') then
    insert into public.nav_items (label, href, display_order, is_visible, is_external, open_in_new_tab)
      values ('People & Culture', '', 1, true, false, false)
      returning id into people_group;
  else
    select id into people_group from public.nav_items where parent_id is null and href = '' and label = 'People & Culture';
  end if;

  if not exists (select 1 from public.nav_items where parent_id is null and href = '' and label = 'Company & Business') then
    insert into public.nav_items (label, href, display_order, is_visible, is_external, open_in_new_tab)
      values ('Company & Business', '', 2, true, false, false)
      returning id into company_group;
  else
    select id into company_group from public.nav_items where parent_id is null and href = '' and label = 'Company & Business';
  end if;

  if not exists (select 1 from public.nav_items where parent_id is null and href = '' and label = 'Engagement & Community') then
    insert into public.nav_items (label, href, display_order, is_visible, is_external, open_in_new_tab)
      values ('Engagement & Community', '', 3, true, false, false)
      returning id into engagement_group;
  else
    select id into engagement_group from public.nav_items where parent_id is null and href = '' and label = 'Engagement & Community';
  end if;

  -- Re-parent the EXISTING rows (matched by href, not recreated) into their
  -- group. `and parent_id is null` makes each update a no-op on a second
  -- run. display_order is deliberately reset here: production's current
  -- values are 1 or 3 with no real ordering intent behind them (six rows
  -- share "1", none use "2"), not a hand-tuned sequence this migration
  -- would be overwriting, so assigning the intended 1..4 / 1..2 sequence
  -- within each group is a real, documented transformation, not a silent
  -- discard of deliberate admin work. Every other column (label, is_visible,
  -- is_external, open_in_new_tab) is left exactly as it is today — in
  -- particular, the existing "Company News" row currently has
  -- is_external=true and open_in_new_tab=true, which looks like a
  -- data-entry mistake (its href, /company-news, is an internal path) but
  -- this migration does not touch it: fixing that is a separate, deliberate
  -- admin decision, not something to fold silently into a schema migration.
  update public.nav_items set parent_id = people_group, display_order = 1 where href = '/hr-corner' and parent_id is null;
  update public.nav_items set parent_id = people_group, display_order = 2 where href = '/staff-spotlight' and parent_id is null;
  update public.nav_items set parent_id = people_group, display_order = 3 where href = '/staff-news' and parent_id is null;
  update public.nav_items set parent_id = people_group, display_order = 4 where href = '/healthline' and parent_id is null;

  update public.nav_items set parent_id = company_group, display_order = 1 where href = '/company-news' and parent_id is null;
  update public.nav_items set parent_id = company_group, display_order = 2 where href = '/articles' and parent_id is null;

  update public.nav_items set parent_id = engagement_group, display_order = 1 where href = '/photos-of-the-quarter' and parent_id is null;
  update public.nav_items set parent_id = engagement_group, display_order = 2 where href = '/games' and parent_id is null;

  -- Search stays top-level (parent_id untouched, already null) — only its
  -- display_order moves from 3 to 4, so it doesn't tie with the
  -- Engagement & Community heading above it (also order 3) in the
  -- top-level list. This is the one existing row whose display_order this
  -- migration changes without also reparenting it.
  update public.nav_items set display_order = 4 where href = '/search' and parent_id is null and display_order <> 4;
end $$;

-- --------------------------------------------------------- editorial categories
-- Unchanged from the original migration: additive only, `on conflict do
-- nothing` means every slug that already exists in production (7 of 8 do)
-- is left completely untouched. The one real effect in production is
-- adding 'healthline' — production's existing "Healthline" nav item
-- (/healthline) currently has no matching category at all (production's
-- health category is separately slugged 'health-tips', which nothing
-- references: confirmed zero content rows use either 'health-tips' or the
-- unrelated 'tootls-tips' category before this migration runs), so this
-- fixes a pre-existing gap rather than creating a duplicate that competes
-- with real content. Neither 'health-tips' nor 'tootls-tips' is touched,
-- renamed, or removed here — reconciling those, if wanted, is a separate,
-- explicit decision for whoever owns the taxonomy, not something this
-- migration decides on its own.
insert into public.categories (slug, name, description) values
  ('company-news', 'Company News', 'Company achievements, awards, and business announcements.'),
  ('articles', 'Articles', 'Thought leadership and industry analysis written by PHD Nigeria staff.'),
  ('staff-spotlight', 'Staff Spotlight', 'Employee profiles and interviews.'),
  ('staff-news', 'Staff News', 'Staff birthdays, announcements, and internal people news.'),
  ('hr-corner', 'HR Corner', 'HR communication and information for staff.'),
  ('healthline', 'Healthline', 'Health, wellbeing, and employee wellness content.'),
  ('photos-of-the-quarter', 'Photos of the Quarter', 'Photo-driven content and event galleries.'),
  ('games', 'Games', 'Puzzles and interactive employee engagement content.')
on conflict (slug) do nothing;
