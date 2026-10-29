-- =============================================================================
-- Edition audit — READ-ONLY. Every statement is a SELECT; nothing is written.
-- Run by the project owner (Supabase SQL editor, read-only role preferred)
-- BEFORE any edition migration or backfill. Share the output for review;
-- each flagged row needs an editorial decision, not a scripted guess.
-- =============================================================================

-- A. Every publication, with a suggested quarter parsed from its slug/title.
--    The suggestion is a hint for the editor to confirm, never applied automatically.
select p.id, p.slug, p.title, p.status, p.published_at,
       substring(lower(p.slug || ' ' || p.title) from 'q([1-4])') as suggested_quarter,
       substring(lower(p.slug || ' ' || p.title) from 'q[1-4][^0-9]*([0-9]{2,4})') as suggested_year_fragment,
       (select count(*) from public.sections s where s.publication_id = p.id) as sections,
       (select count(*) from public.content c where c.publication_id = p.id) as content_total,
       (select count(*) from public.content c where c.publication_id = p.id and c.status = 'published') as content_published
  from public.publications p
 order by p.published_at desc nulls last, p.created_at desc;

-- B. Content with NO edition. Today these can't be published through the CMS
--    (publish requires a publication), so anything published here was inserted
--    directly. Each row: decide edition vs. evergreen.
select c.id, c.content_type, c.status, c.slug, c.title, cat.slug as category, c.published_at, c.created_at
  from public.content c
  left join public.categories cat on cat.id = c.category_id
 where c.publication_id is null
 order by c.status, c.created_at;

-- C. Section/edition mismatches: content whose section belongs to a different edition.
select c.id, c.title, c.publication_id as content_edition, s.publication_id as section_edition, s.title as section
  from public.content c
  join public.sections s on s.id = c.section_id
 where s.publication_id is distinct from c.publication_id;

-- D. Edition content with no section (shows on the edition page only via "all stories").
select c.id, c.title, p.slug as edition, c.status
  from public.content c join public.publications p on p.id = c.publication_id
 where c.section_id is null;

-- E. Embargo check: content that is publicly visible while its edition is NOT.
--    These items appear today in homepage / category / search listings even
--    though their edition page 404s.
select c.id, c.title, c.status as content_status, p.slug as edition, p.status as edition_status, p.publish_at
  from public.content c join public.publications p on p.id = c.publication_id
 where (c.status = 'published' or (c.status = 'scheduled' and c.publish_at <= now()))
   and not (p.status = 'published' or (p.status = 'scheduled' and p.publish_at <= now()));

-- F. Content whose publish date falls outside the quarter its edition will be
--    assigned (run after A is decided; informational — late publication of a
--    quarter's edition is normal, so this flags, it doesn't reject).
select c.id, c.title, p.slug, c.published_at
  from public.content c join public.publications p on p.id = c.publication_id
 where c.published_at is not null
 order by p.slug, c.published_at;

-- G. Media reused across more than one edition (legitimate; listed so the
--    media-library quarter filter can be checked against it after M1).
with usages as (
  select cover_media_id as media_id, publication_id from public.content where cover_media_id is not null
  union
  select id, (select publication_id from public.content where id = media.content_id) from public.media where content_id is not null
  union
  select cover_media_id, id from public.publications where cover_media_id is not null
)
select media_id, count(distinct publication_id) as editions
  from usages where publication_id is not null
 group by media_id having count(distinct publication_id) > 1;
