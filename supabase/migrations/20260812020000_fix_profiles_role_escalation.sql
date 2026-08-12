-- Fixes a confirmed privilege-escalation bug: profiles_update_own_or_admin
-- (20260812011100_rls_policies.sql) lets a user UPDATE any column of their
-- own row, including `role`, because `role` never appeared in that policy's
-- USING/WITH CHECK expression. Empirically verified: a freshly signed-up
-- 'viewer' could PATCH /rest/v1/profiles?id=eq.<self> with {"role":"admin"}
-- using only their own session JWT and succeed.
--
-- RLS's USING/WITH CHECK model governs which ROWS a statement may touch, not
-- which COLUMNS within an allowed row may change — there's no clean way to
-- compare NEW.role against OLD.role from a policy expression alone. A
-- BEFORE UPDATE trigger is the standard fix for exactly this shape of
-- problem, and is added here rather than trying to force it into RLS.
--
-- The existing profiles_update_own_or_admin policy is left in place — it
-- still correctly governs row access (own row, or any row if admin). This
-- trigger adds the missing column-level restriction on top of it.

create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role then
    -- auth.uid() is null outside of a PostgREST-authenticated request context
    -- (a direct Postgres connection as a superuser/service-role, e.g. the
    -- manual admin-bootstrap step documented in supabase/seed.sql, or a
    -- future privileged backend job run via the service-role client). Those
    -- contexts are trusted by definition — service_role already bypasses RLS
    -- entirely; this trigger still fires for it because triggers are not
    -- skipped by RLS bypass, so it must be allowed through explicitly here.
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Only an admin can change a profile''s role.'
        using errcode = '42501'; -- insufficient_privilege -> PostgREST 403
    end if;
  end if;
  return new;
end;
$$;

comment on function public.prevent_role_self_escalation is
  'BEFORE UPDATE guard on public.profiles: blocks a non-admin, authenticated user from changing role (their own or anyone else''s). Admins and privileged/non-PostgREST contexts (auth.uid() is null) are unaffected.';

create trigger prevent_role_self_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();
