-- Phase 4D: editorial audit trail. No equivalent table exists (confirmed by
-- inspection before writing this). Every admin mutation across content,
-- media, people, taxonomy, users, and settings gets one row here, written
-- by the same Server Action that performs the mutation, immediately after
-- it succeeds — never before, and never from the client directly.

create type public.audit_action as enum (
  'CREATE',
  'UPDATE',
  'PUBLISH',
  'UNPUBLISH',
  'ARCHIVE',
  'RESTORE',
  'DELETE',
  'UPLOAD',
  'PROMOTE',
  'REPLACE',
  'ROLE_CHANGE',
  'SETTINGS_UPDATE',
  -- Not in the brief's example list, but scheduling is its own distinct
  -- lifecycle transition in this phase, same granularity as
  -- PUBLISH/UNPUBLISH/ARCHIVE/RESTORE already get individually.
  'SCHEDULE',
  'CANCEL_SCHEDULE'
);

create type public.audit_entity_type as enum (
  'CONTENT',
  'MEDIA',
  'AUTHOR',
  'CATEGORY',
  'SECTION',
  'PUBLICATION',
  'USER',
  'SETTINGS'
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  -- Nullable: the one legitimate actor-less case is the scheduled-publish
  -- job (20260816020000_content_revisions.sql's sibling, the
  -- /api/cron/publish-scheduled route), which runs with no authenticated
  -- human session. Every interactive mutation always sets this.
  actor_user_id uuid references public.profiles (id) on delete set null,
  action public.audit_action not null,
  entity_type public.audit_entity_type not null,
  entity_id uuid,
  -- Small, deliberately-chosen contextual fields only (e.g. title,
  -- status_before/after, role_before/after) — never passwords, tokens,
  -- service-role keys, or full row dumps.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_log is 'Server-side-only editorial audit trail. Written after a mutation succeeds, never before, never from the client.';

create index audit_log_actor_user_id_idx on public.audit_log (actor_user_id);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_created_at_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

-- Read: admin sees everything; editor sees everything except USER/SETTINGS
-- events (role changes, settings changes) — matches the brief's "EDITOR:
-- limited editorial activity visibility." Contributor matches neither
-- policy, so sees nothing ("no global audit access").
create policy audit_log_select_admin
  on public.audit_log for select
  using (public.is_admin());

create policy audit_log_select_editor
  on public.audit_log for select
  using (public.is_editor_or_admin() and entity_type not in ('USER', 'SETTINGS'));

-- Write: any contributor+ can insert a row, but only for themselves —
-- `actor_user_id = auth.uid()` is what stops a user forging another
-- actor's ID. This is inserted by Server Actions using the same
-- cookie-based client every mutation already uses, never the service-role
-- client and never a raw client-side call — RLS is still the boundary,
-- consistent with every other table in this schema.
create policy audit_log_insert
  on public.audit_log for insert
  with check (public.is_contributor_or_above() and actor_user_id = auth.uid());

-- The scheduled-publish job runs with no session (auth.uid() is null there)
-- and uses the service-role client, which bypasses RLS entirely — this
-- policy is only what covers interactive, authenticated inserts.
