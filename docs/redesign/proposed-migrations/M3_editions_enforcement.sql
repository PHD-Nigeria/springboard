-- =============================================================================
-- PROPOSED — NOT APPLIED. Apply only AFTER:
--   1. M1 is live,
--   2. the edition audit (docs/redesign/audit/edition-audit.sql) has been run,
--   3. every row it flags has an editorial decision and the approved backfill
--      (M2, written per-row from that decision — never a bulk guess) has run.
-- Each statement below can reject writes that succeed today, which is why it
-- is separated from M1 and needs explicit approval.
-- =============================================================================

-- 1. Quarter-specific content cannot enter review / schedule / publish without
--    an edition, unless it is explicitly evergreen. Drafts stay unrestricted so
--    work-in-progress is never blocked. (The app enforces the same rule from M1
--    onward with a friendly message; this is the boundary, like RLS.)
create or replace function public.enforce_content_edition_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('review', 'scheduled', 'published')
     and new.publication_id is null
     and not new.is_evergreen then
    raise exception 'Choose an edition, or mark this item Evergreen, before it can be %.', new.status
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger content_edition_assignment
  before insert or update of status, publication_id, is_evergreen on public.content
  for each row execute function public.enforce_content_edition_assignment();

-- 2. A section must belong to the content's own edition (today nothing stops
--    content in edition A from pointing at a section of edition B).
create or replace function public.enforce_content_section_edition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.section_id is not null and not exists (
    select 1 from public.sections s
     where s.id = new.section_id and s.publication_id is not distinct from new.publication_id
  ) then
    raise exception 'That section belongs to a different edition.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger content_section_edition
  before insert or update of section_id, publication_id on public.content
  for each row execute function public.enforce_content_section_edition();

-- 3. Deleting an edition must not silently turn its stories into "no edition"
--    (today: ON DELETE SET NULL). Restrict instead; archive editions rather
--    than delete them.
alter table public.content drop constraint content_publication_id_fkey;
alter table public.content
  add constraint content_publication_id_fkey
  foreign key (publication_id) references public.publications (id) on delete restrict;
