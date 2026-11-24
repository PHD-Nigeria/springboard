-- Editable homepage team section. Additive: one new table, nothing existing is touched.
--   * Public (anon) can read only rows with is_visible = true; editors/admins can read all.
--   * Only an admin can create, edit, reorder or delete (matches "authorised administrator").
--   * The five initial members are DATA, inserted only if the table is empty, so re-running this
--     migration never duplicates or overwrites what an admin has since changed.
-- Rollback: drop table public.team_members;  (and, optionally, the audit enum value stays; enum values cannot be dropped)

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  display_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_members_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint team_members_role_length check (char_length(btrim(role)) between 1 and 160)
);

comment on table public.team_members is 'People shown in the homepage team section. Managed at /admin/team (admin only).';

create index if not exists team_members_display_order_idx on public.team_members (display_order);

drop trigger if exists set_team_members_updated_at on public.team_members;
create trigger set_team_members_updated_at
  before update on public.team_members
  for each row execute function public.set_updated_at();

alter table public.team_members enable row level security;

drop policy if exists team_members_select on public.team_members;
create policy team_members_select
  on public.team_members for select
  using (is_visible or public.is_editor_or_admin());

drop policy if exists team_members_write on public.team_members;
create policy team_members_write
  on public.team_members for all
  using (public.is_admin())
  with check (public.is_admin());

-- Initial team, as supplied. Skipped entirely if any row already exists.
insert into public.team_members (name, role, display_order)
select v.name, v.role, v.ord
from (values
  ('Henry',   'Editor in Chief',                     1),
  ('Uche',    'Developer/Designer',                  2),
  ('Oganihu', 'Content Creator / Project Manager',   3),
  ('Oge',     'Contributor',                         4),
  ('Sam',     'Contributor',                         5)
) as v(name, role, ord)
where not exists (select 1 from public.team_members);

alter type public.audit_entity_type add value if not exists 'TEAM';
