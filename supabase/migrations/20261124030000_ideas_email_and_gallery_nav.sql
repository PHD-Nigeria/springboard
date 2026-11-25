-- Share Your Ideas recipient + Gallery navigation item.
--   * site_settings.ideas_email: the address the header button mails. NULL until the official address is
--     supplied; the button stays disabled while it is NULL. The owner confirmed springboard@phdnigeria.com, which
--     is seeded below ONLY when the column is still empty, so an admin's later change is never overwritten.
--     Written only through the existing admin-only site_settings_write policy.
--   * site_settings_public_ideas: site_settings is contributor+ readable only, so the public header cannot read
--     the address from the table. A narrow SECURITY DEFINER function returns ONLY this one field.
--   * Gallery nav item: inserted once as a top-level link directly after Archive, only if no item points at /gallery.
--     Later top-level items move down one place so the order stays Archive, Gallery, Search; no label, link or
--     visibility of any existing item is changed.
-- Rollback: drop function; alter table public.site_settings drop column ideas_email; delete from public.nav_items where href = '/gallery';

alter table public.site_settings
  add column if not exists ideas_email text;

alter table public.site_settings
  drop constraint if exists site_settings_ideas_email_format,
  add constraint site_settings_ideas_email_format
    check (ideas_email is null or (char_length(ideas_email) <= 254 and ideas_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$'));

comment on column public.site_settings.ideas_email is 'Recipient of the header Share Your Ideas mailto link. Null disables the button.';

update public.site_settings
   set ideas_email = 'springboard@phdnigeria.com'
 where id = true and ideas_email is null;

create or replace function public.site_settings_public_ideas()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select ideas_email from public.site_settings where id = true;
$$;

revoke all on function public.site_settings_public_ideas() from public;
grant execute on function public.site_settings_public_ideas() to anon, authenticated;

do $$
declare
  archive_order int;
begin
  if exists (select 1 from public.nav_items where href = '/gallery') then
    return;
  end if;

  select display_order into archive_order from public.nav_items where href = '/archive' and parent_id is null limit 1;

  if archive_order is not null then
    -- Place Gallery directly after Archive: shift only the top-level items that come after it by one.
    update public.nav_items set display_order = display_order + 1
      where parent_id is null and display_order > archive_order;
    insert into public.nav_items (label, href, display_order, is_visible, is_external, open_in_new_tab)
      values ('Gallery', '/gallery', archive_order + 1, true, false, false);
  else
    insert into public.nav_items (label, href, display_order, is_visible, is_external, open_in_new_tab)
      values ('Gallery', '/gallery', coalesce((select max(display_order) from public.nav_items where parent_id is null), 0) + 1, true, false, false);
  end if;
end $$;
