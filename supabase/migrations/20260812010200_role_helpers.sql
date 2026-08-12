-- Role-check helpers used by RLS policies across the schema, so role logic
-- lives in one place instead of being repeated (and risking drift) in every
-- policy definition.

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'viewer'::public.user_role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin';
$$;

create or replace function public.is_editor_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('editor', 'admin');
$$;

create or replace function public.is_contributor_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('contributor', 'editor', 'admin');
$$;
