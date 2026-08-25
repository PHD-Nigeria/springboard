-- Phase 4B security tightening. The brief is explicit: "only admins promote
-- private media, only admins delete media" — stricter than the
-- is_editor_or_admin() pattern used for other staff-level writes elsewhere
-- in this schema. Two gaps existed against that requirement:
--
-- 1. media_write (20260812011100_rls_policies.sql) grants ALL operations,
--    including DELETE, to any contributor+ with no ownership check — so a
--    contributor could delete any media row via the table API directly.
-- 2. media_write also grants UPDATE to contributor+ with no column
--    restriction, so a contributor could set bucket = 'public' directly,
--    bypassing promoteMediaAction's safe Storage-move-then-DB-update
--    sequence entirely (the exact anti-pattern the brief calls out: "Do not
--    simply change the database bucket value without actually moving/
--    copying the object").
--
-- Both are closed the same way prevent_role_self_escalation
-- (20260812020000) closed an analogous gap: RLS for row access, a trigger
-- for the column-level restriction RLS can't express on its own.

drop policy media_write on public.media;

create policy media_insert
  on public.media for insert
  with check (public.is_contributor_or_above());

create policy media_update
  on public.media for update
  using (public.is_contributor_or_above())
  with check (public.is_contributor_or_above());

-- Hard delete is admin-only, matching content_delete_admin's precedent for
-- other irreversible operations (editors get archive there; there's no
-- non-destructive equivalent for media, so this is a flat admin gate).
create policy media_delete
  on public.media for delete
  using (public.is_admin());

create or replace function public.prevent_media_bucket_change()
returns trigger
language plpgsql
as $$
begin
  if new.bucket is distinct from old.bucket then
    -- See prevent_role_self_escalation for why auth.uid() is null is
    -- exempted: direct/service-role contexts are trusted by definition and
    -- are not skipped by triggers even when they bypass RLS.
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Only an admin can change a media item''s bucket.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.prevent_media_bucket_change is
  'BEFORE UPDATE guard on public.media: blocks a non-admin from changing bucket directly, so Private -> Public promotion can only happen through promoteMediaAction''s safe copy-then-flip sequence, never a bare column update.';

create trigger prevent_media_bucket_change
  before update on public.media
  for each row execute function public.prevent_media_bucket_change();
