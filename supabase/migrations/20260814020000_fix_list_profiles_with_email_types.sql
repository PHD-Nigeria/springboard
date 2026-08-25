-- Fixes a real defect found during Phase 4B testing: auth.users.email is
-- character varying(255), not text, so list_profiles_with_email's declared
-- `text` return column mismatched at execution time ("structure of query
-- does not match function result type", 42804) and every call 500'd.
-- CREATE OR REPLACE can't change an existing function's return signature,
-- so this drops and recreates it.

drop function if exists public.list_profiles_with_email();

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
    select p.id, u.email::text, p.role, p.full_name, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at asc;
end;
$$;

comment on function public.list_profiles_with_email is
  'Admin-only: profiles joined with their auth.users email, for the /admin/users page. Enforces is_admin() internally rather than relying solely on callers to gate access.';

grant execute on function public.list_profiles_with_email() to authenticated;
