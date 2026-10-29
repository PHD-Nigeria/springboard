-- =============================================================================
-- PROPOSED — NOT APPLIED. Lives in docs/, deliberately outside
-- supabase/migrations/, so `supabase db push` / `db reset` can never pick it up.
-- To adopt: review, copy into supabase/migrations/<timestamp>_editions_additive.sql
-- on a reviewed PR, apply to a verified-isolated staging project first.
--
-- M1 — Quarterly editions, additive and backward-compatible.
--   * No existing column is changed, dropped or retyped.
--   * No existing row is modified (every new column is nullable or defaulted).
--   * No RLS policy, role, auth setting or cron is touched.
--   * Existing reads/writes behave exactly as before until the app opts in.
-- =============================================================================

-- ---------------------------------------------------------------- publications
-- A publication row already IS an edition (slug-addressed, own status, cover,
-- sections). M1 gives it a stable quarter identity. Year/quarter are the only
-- inputs; code and period dates are derived so they can never disagree.
-- (Generated expressions are guarded by the same ranges as the CHECKs, so an
-- out-of-range value fails on the named CHECK rather than inside make_date().)
alter table public.publications
  add column edition_year smallint,
  add column edition_quarter smallint,
  add constraint publications_edition_year_range
    check (edition_year is null or edition_year between 2000 and 2100),
  add constraint publications_edition_quarter_range
    check (edition_quarter is null or edition_quarter between 1 and 4),
  -- Either both set (a quarterly edition) or neither (legacy / special issue).
  add constraint publications_edition_pair
    check ((edition_year is null) = (edition_quarter is null));

alter table public.publications
  add column edition_code text generated always as (
    case when edition_year is not null and edition_quarter between 1 and 4
      then edition_year::text || '-Q' || edition_quarter::text end
  ) stored,
  add column period_start date generated always as (
    case when edition_year between 2000 and 2100 and edition_quarter between 1 and 4
      then make_date(edition_year, (edition_quarter - 1) * 3 + 1, 1) end
  ) stored,
  add column period_end date generated always as (
    case when edition_year between 2000 and 2100 and edition_quarter between 1 and 4
      then (make_date(edition_year, (edition_quarter - 1) * 3 + 1, 1) + interval '3 months' - interval '1 day')::date end
  ) stored;

-- One edition per quarter. Partial, so legacy rows without a quarter are unaffected.
create unique index publications_edition_code_key
  on public.publications (edition_code) where edition_code is not null;

-- Archive / "latest edition" ordering.
create index publications_edition_order_idx
  on public.publications (edition_year desc, edition_quarter desc);

comment on column public.publications.edition_code is
  'Stable quarter identifier, e.g. 2026-Q2. Derived from edition_year/edition_quarter; never typed by hand.';

-- -------------------------------------------------------------------- content
-- Today publication_id IS NULL means two different things: "evergreen" and
-- "nobody has decided yet". is_evergreen makes the first one explicit, so
-- unassigned content is never silently treated as evergreen.
--   publication_id set               -> edition content
--   publication_id null, evergreen   -> evergreen (explicit editorial choice)
--   publication_id null, !evergreen  -> unassigned (may not enter review — app
--                                       rule in M1, DB rule in M3)
alter table public.content
  add column is_evergreen boolean not null default false,
  add constraint content_evergreen_has_no_edition
    check (not (is_evergreen and publication_id is not null));

comment on column public.content.is_evergreen is
  'Explicit editorial choice that this item belongs to no quarterly edition. Default false: unassigned content is not evergreen.';

-- --------------------------------------------------------------------- media
-- Edition association for media is DERIVED from where the file is used, so one
-- file reused across editions needs no duplicate upload and can never carry a
-- stale hand-typed quarter. security_invoker = true: the view runs with the
-- caller's RLS on content/media/publications, exactly like querying them directly.
-- Safe text -> uuid: null for anything that is not a well-formed uuid.
create or replace function public.try_uuid(value text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when value ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then value::uuid
  end
$$;

create view public.media_edition_usage
  with (security_invoker = true) as
  -- Block JSON is validated by the app, not the database, so every id taken
  -- from it is cast only when it is a well-formed uuid (CASE guarantees the
  -- cast is never evaluated for anything else; a WHERE filter does not).
  with usages as (
    select c.cover_media_id as media_id, c.publication_id, c.id as content_id, 'content_cover'::text as usage
      from public.content c
     where c.cover_media_id is not null
    union all
    select m.id, c.publication_id, c.id, 'gallery_attachment'
      from public.media m join public.content c on c.id = m.content_id
    union all
    select public.try_uuid(b ->> 'mediaId'), c.publication_id, c.id, 'body_block'
      from public.content c
      cross join lateral jsonb_array_elements(coalesce(c.body -> 'blocks', '[]'::jsonb)) b
    union all
    select public.try_uuid(b ->> 'thumbnailMediaId'), c.publication_id, c.id, 'video_thumbnail'
      from public.content c
      cross join lateral jsonb_array_elements(coalesce(c.body -> 'blocks', '[]'::jsonb)) b
    union all
    select public.try_uuid(g.mid), c.publication_id, c.id, 'gallery_block'
      from public.content c
      cross join lateral jsonb_array_elements(coalesce(c.body -> 'blocks', '[]'::jsonb)) b
      cross join lateral jsonb_array_elements_text(
        case when jsonb_typeof(b -> 'mediaIds') = 'array' then b -> 'mediaIds' else '[]'::jsonb end
      ) g(mid)
    union all
    select p.cover_media_id, p.id, null::uuid, 'edition_cover'
      from public.publications p
     where p.cover_media_id is not null
  )
  select u.media_id, u.publication_id, p.edition_code, u.content_id, u.usage
    from usages u
    left join public.publications p on p.id = u.publication_id
   where u.media_id is not null;

comment on view public.media_edition_usage is
  'Derived: which edition(s) each media file is used in. publication_id null = used by evergreen/unassigned content.';

grant select on public.media_edition_usage to authenticated;
