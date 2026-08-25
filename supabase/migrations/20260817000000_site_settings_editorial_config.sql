-- Phase 4F: extends the site_settings singleton (20260815000000) with the
-- editorial-configuration and site-asset fields the Team CMS Workspace
-- needs — still one row, still additive, no new tables. Every column is
-- nullable and defaults to null, so existing behavior (recency-based
-- "featured" content, alphabetical "featured" contributors, the hardcoded
-- banner copy/site title/description) is completely unchanged until an
-- admin explicitly sets one.

alter table public.site_settings
  -- Homepage editorial configuration (§12): CMS controls WHAT, not HOW —
  -- these are content/author picks, not layout or ordering.
  add column featured_content_id uuid references public.content (id) on delete set null,
  add column featured_author_ids uuid[],
  add column banner_title text,
  add column banner_description text,
  -- SEO settings (§14) — extends the metadata src/app/layout.tsx already
  -- builds, replacing its two hardcoded constants with a configurable
  -- default that falls back to the same copy when unset.
  add column site_title text,
  add column seo_default_description text,
  -- Site assets (§11): each is a reference to an existing media row, not a
  -- second media model — "Site Asset -> Media record -> Storage -> Site
  -- configuration reference," exactly as specified.
  add column logo_phd_media_id uuid references public.media (id) on delete set null,
  add column logo_springboard_media_id uuid references public.media (id) on delete set null,
  add column favicon_media_id uuid references public.media (id) on delete set null,
  add column og_image_media_id uuid references public.media (id) on delete set null,
  add column homepage_artwork_media_id uuid references public.media (id) on delete set null;

comment on column public.site_settings.featured_content_id is 'Explicit homepage lead story pick. Null falls back to the existing most-recently-published behavior.';
comment on column public.site_settings.featured_author_ids is 'Ordered, explicit homepage "People" picks (admin-facing UI caps this at 4 slots). Null/empty falls back to the existing alphabetical-first-4 behavior.';

-- site_settings_select (20260815000000) was contributor_or_above-only,
-- correct when the table held exactly one field (default_publication_id)
-- with no public consumer. It now holds fields the homepage and every
-- page's <head> metadata read for anonymous visitors too — public read is
-- the correct shape for what this table actually contains now, the same
-- pattern categories/authors/tags already use (`using (true)`). None of
-- these columns are sensitive; nothing here is a secret or an internal
-- toggle. Write access is unchanged: still admin-only.
drop policy site_settings_select on public.site_settings;

create policy site_settings_select
  on public.site_settings for select
  using (true);
