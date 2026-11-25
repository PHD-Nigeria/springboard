-- Central Gallery. Additive columns on media so the Gallery is a VIEW of the media library:
-- a photograph is uploaded once and appears in the Gallery automatically (when it is in the public
-- bucket). No new table, no copy of any file.
--   * gallery_visible defaults to true, so every existing and future image is included without any backfill.
--   * gallery_group (event/category label) and taken_on (date) drive grouping.
--   * description is longer-form text alongside the existing caption and alt_text.
--   * Changing gallery_visible / gallery_group / taken_on is editor-or-admin only (a trigger, the same
--     pattern as prevent_media_bucket_change); contributors can still edit description/caption/alt text.
--   * New photographs are uploaded straight into the public bucket by the app (owner decision), so they join the
--     Gallery with no promotion step. Older PRIVATE files are never exposed by this: the Gallery query requires
--     bucket = 'public', and promoting an existing private file stays admin-only (prevent_media_bucket_change).
--   * Administrators hide a photograph with gallery_visible = false, or remove it (media delete is admin-only).
-- Rollback: drop trigger/function, then drop the four columns.

alter table public.media
  add column if not exists description text,
  add column if not exists gallery_visible boolean not null default true,
  add column if not exists gallery_group text,
  add column if not exists taken_on date;

alter table public.media
  drop constraint if exists media_gallery_group_length,
  add constraint media_gallery_group_length
    check (gallery_group is null or char_length(btrim(gallery_group)) between 1 and 80),
  drop constraint if exists media_description_length,
  add constraint media_description_length
    check (description is null or char_length(description) <= 1000);

create index if not exists media_gallery_idx
  on public.media (taken_on desc, created_at desc)
  where gallery_visible and bucket = 'public';

create or replace function public.prevent_gallery_curation_by_contributor()
returns trigger
language plpgsql
as $$
begin
  if (new.gallery_visible is distinct from old.gallery_visible
      or new.gallery_group is distinct from old.gallery_group
      or new.taken_on is distinct from old.taken_on) then
    -- auth.uid() is null for direct/service-role contexts, which are trusted (same reasoning as
    -- prevent_media_bucket_change / prevent_role_self_escalation).
    if auth.uid() is not null and not public.is_editor_or_admin() then
      raise exception 'Only an editor or admin can change a photograph''s Gallery settings.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists media_prevent_gallery_curation on public.media;
create trigger media_prevent_gallery_curation
  before update on public.media
  for each row execute function public.prevent_gallery_curation_by_contributor();
