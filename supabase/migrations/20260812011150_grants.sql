-- Supabase's hosted dashboard auto-configures these GRANTs whenever a table
-- is created through it; since this schema is defined via plain SQL
-- migrations, they must be granted explicitly. RLS policies alone are not
-- sufficient: Postgres requires the coarse table-level GRANT before RLS's
-- per-row filtering is ever evaluated — without it every query 42501s
-- regardless of policy. Granting these broadly to anon/authenticated is
-- still safe: the actual restriction comes from RLS (20260812011100), which
-- permits no writes beyond what's explicitly allowed there.
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

grant execute on all functions in schema public
  to anon, authenticated, service_role;

-- Apply the same grants automatically to anything future migrations add.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;

alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;

alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
