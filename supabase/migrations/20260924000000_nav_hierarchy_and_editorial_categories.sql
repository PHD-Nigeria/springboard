-- Phase: Springboard editorial navigation upgrade. Replaces the flat,
-- anchor-based nav_items list (Insights/People/Search) with the grouped
-- structure the Q2 '26 editorial brief calls for: three parent headings
-- (People & Culture / Company & Business / Engagement & Community), each
-- with real child destinations, plus a standalone Search item that stays
-- outside every group. Also seeds the categories each child destination
-- reads from, so the public landing pages added alongside this migration
-- have something to query from day one.

-- ---------------------------------------------------------------- nav_items
-- Self-referencing parent_id gives nav_items two levels (group -> child)
-- without a second table — matches this schema's existing preference for
-- one flexible table over a parallel structure (see e.g. content.metadata
-- vs. a table per content type). A group heading has no real destination of
-- its own, so href becomes optional rather than switching the column to
-- nullable + threading `string | null` through Navigation.tsx/NavigationManager
-- for a case that's just "empty string means non-clickable heading."
alter table public.nav_items
  add column parent_id uuid references public.nav_items (id) on delete cascade;

alter table public.nav_items
  alter column href set default '',
  alter column href drop not null;

update public.nav_items set href = '' where href is null;
alter table public.nav_items alter column href set not null;

create index nav_items_parent_id_idx on public.nav_items (parent_id);

comment on column public.nav_items.parent_id is 'Null for a top-level item (a standalone link like Search, or a group heading). Set for a child item nested under a group.';
comment on column public.nav_items.href is 'Empty string for a group heading with no destination of its own (it renders as a disclosure trigger, not a link) — every real destination, top-level or nested, has a non-empty href.';

-- Nothing references nav_items by FK (confirmed in taxonomy-actions.ts's
-- getNavItemUsageAction) and it holds only the 3 rows this table's original
-- migration seeded, so replacing them outright is a clean reset rather than
-- a destructive data change — same spirit as that migration's own "pure
-- refactor" seed, just for the new shape.
delete from public.nav_items;

do $$
declare
  people_group uuid;
  company_group uuid;
  engagement_group uuid;
begin
  insert into public.nav_items (label, href, display_order, is_visible, is_external, open_in_new_tab)
    values ('People & Culture', '', 1, true, false, false)
    returning id into people_group;
  insert into public.nav_items (label, href, display_order, is_visible, is_external, open_in_new_tab)
    values ('Company & Business', '', 2, true, false, false)
    returning id into company_group;
  insert into public.nav_items (label, href, display_order, is_visible, is_external, open_in_new_tab)
    values ('Engagement & Community', '', 3, true, false, false)
    returning id into engagement_group;

  insert into public.nav_items (parent_id, label, href, display_order, is_visible, is_external, open_in_new_tab) values
    (people_group, 'HR Corner', '/hr-corner', 1, true, false, false),
    (people_group, 'Staff Spotlight', '/staff-spotlight', 2, true, false, false),
    (people_group, 'Staff News', '/staff-news', 3, true, false, false),
    (people_group, 'Healthline', '/healthline', 4, true, false, false),
    (company_group, 'Company News', '/company-news', 1, true, false, false),
    (company_group, 'Articles', '/articles', 2, true, false, false),
    (engagement_group, 'Photos of the Quarter', '/photos-of-the-quarter', 1, true, false, false),
    (engagement_group, 'Games', '/games', 2, true, false, false);

  -- Standalone, outside every group, ordered after the three group headings.
  insert into public.nav_items (label, href, display_order, is_visible, is_external, open_in_new_tab)
    values ('Search', '/search', 4, true, false, false);
end $$;

-- ----------------------------------------------------------- categories seed
-- One category per navigable editorial area, including the two the content
-- model has no dedicated content_type for (HR Corner, Games) — per the
-- editorial brief, those are ARTICLE/GALLERY rows tagged with a category,
-- not new content_type enum values. The other six give every landing page
-- the same query shape (content.category_id = this category's id), even
-- where a type-based filter would also work, so admins manage one
-- consistent "editorial area" concept instead of two.
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
