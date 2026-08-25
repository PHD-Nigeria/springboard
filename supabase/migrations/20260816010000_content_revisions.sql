-- Phase 4D: content revision history, scoped to ARTICLE/COMPANY_NEWS only
-- (§11 of the brief) — enforced in application code (content-actions.ts),
-- not a check constraint, since content_type is shared by every content
-- row and the enum itself shouldn't know which types version.
--
-- A revision snapshots the POST-save state of an update (not the pre-edit
-- state) — every successful edit to an already-existing ARTICLE/
-- COMPANY_NEWS row produces one row here, so "revision N" always means
-- "what this looked like right after the Nth save." Restoring an old
-- revision goes back through the same update path and therefore produces
-- a *new* revision of its own — history only ever grows, never shrinks.
create table public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content (id) on delete cascade,
  revision_number int not null,
  editor_id uuid references public.profiles (id) on delete set null,
  -- The editable fields as they stood at save time — enough to restore
  -- from, deliberately not a full raw-row dump (excludes search_vector,
  -- timestamps, etc., which are derived/administrative, not editorial
  -- content).
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (content_id, revision_number)
);

comment on table public.content_revisions is 'Post-save snapshots of ARTICLE/COMPANY_NEWS content, scoped in application code — see saveContentAction.';

create index content_revisions_content_id_idx on public.content_revisions (content_id, revision_number desc);

alter table public.content_revisions enable row level security;

-- Same visibility shape as the content row itself would have to staff:
-- editorial users only, never public. Contributors can see revisions of
-- their OWN content (useful — they can see their own edit history), staff
-- see all. No public policy exists at all, so anon/authenticated-viewer
-- sessions see nothing.
create policy content_revisions_select
  on public.content_revisions for select
  using (
    public.is_editor_or_admin()
    or exists (
      select 1 from public.content c
      where c.id = content_revisions.content_id and c.created_by = auth.uid()
    )
  );

-- Written by the same Server Action that saves content, through the
-- cookie-based client — governed by the same contributor-own-draft /
-- staff-any-content shape as content_update_own_draft / content_update_staff,
-- so a revision can only be inserted for content the actor could actually
-- have just edited.
create policy content_revisions_insert
  on public.content_revisions for insert
  with check (
    public.is_editor_or_admin()
    or exists (
      select 1 from public.content c
      where c.id = content_revisions.content_id and c.created_by = auth.uid()
    )
  );
