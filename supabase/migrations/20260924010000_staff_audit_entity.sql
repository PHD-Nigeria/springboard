-- Phase 2: the new /admin/staff directory manager (staff-actions.ts) logs
-- CREATE/UPDATE/DELETE against the `staff` table through the same
-- logAuditEvent path every other admin mutation uses — same pattern as
-- 20260826000000_nav_items.sql adding 'NAV_ITEM' for the navigation manager.
alter type public.audit_entity_type add value 'STAFF';
