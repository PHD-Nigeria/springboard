-- Phase 4B additive changes: preserve the uploader's original filename (the
-- existing storage_path is a generated uploads/<uuid>.<ext>, not something a
-- non-technical editor can recognise in the Media Library grid), and expose
-- a safe, admin-gated way to list users with their auth.users email — the
-- app's normal PostgREST access only reaches public.* tables, and auth.users
-- deliberately isn't exposed there.

alter table public.media add column original_filename text;

comment on column public.media.original_filename is
  'The filename the uploader submitted, kept for display only — storage_path (a generated uploads/<uuid>.<ext>) is still what governs the object''s location.';

-- SECURITY DEFINER so it can join auth.users without granting broad access
-- to that schema; the admin check inside is what actually gates it, the
-- same pattern prevent_role_self_escalation already established. Any
-- authenticated caller may invoke this function, but only an admin gets
-- rows back — everyone else hits the exception.
create or replace function public.list_profiles_with_email()
returns table (
  id uuid,
  email text,
  role public.user_role,
  full_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can list users.' using errcode = '42501';
  end if;

  return query
    select p.id, u.email, p.role, p.full_name, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at asc;
end;
$$;

comment on function public.list_profiles_with_email is
  'Admin-only: profiles joined with their auth.users email, for the /admin/users page. Enforces is_admin() internally rather than relying solely on callers to gate access.';

grant execute on function public.list_profiles_with_email() to authenticated;
