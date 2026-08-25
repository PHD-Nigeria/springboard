-- Phase 4D: the Activity page (§6) needs to show WHO performed each
-- action, but profiles_select_own_or_admin (20260812011100_rls_policies.sql)
-- only lets a user see their own profile row unless they're admin — so an
-- EDITOR viewing Activity (their brief-mandated "limited editorial
-- visibility") would see every OTHER actor's name resolve to null via a
-- normal embedded join. Same pattern as list_profiles_with_email
-- (20260814000000), but editor_or_admin rather than admin-only, and
-- exposing only what's needed for attribution — no role, no other fields.
create or replace function public.list_actor_profiles()
returns table (
  id uuid,
  full_name text,
  email text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_editor_or_admin() then
    raise exception 'Only editors and admins can list actor profiles.' using errcode = '42501';
  end if;

  return query
    select p.id, p.full_name, u.email::text
    from public.profiles p
    join auth.users u on u.id = p.id;
end;
$$;

comment on function public.list_actor_profiles is 'Editor/admin-only: id + display name + email for every profile, used solely to attribute audit_log rows to a human-readable actor on the Activity page.';

grant execute on function public.list_actor_profiles() to authenticated;
