create table public.content_tags (
  content_id uuid not null references public.content (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (content_id, tag_id)
);

create index content_tags_tag_id_idx on public.content_tags (tag_id);

-- content_staff: the one table added beyond the originally named list,
-- needed so BIRTHDAY entries and staff mentions can reference one or more
-- staff members with real referential integrity (a JSONB array of staff ids
-- couldn't cascade on staff deletion/rename or be joined from a staff page).
create table public.content_staff (
  content_id uuid not null references public.content (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  role text,
  primary key (content_id, staff_id)
);

create index content_staff_staff_id_idx on public.content_staff (staff_id);
