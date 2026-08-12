-- media.content_id can only reference public.content now that it exists
-- (content and media reference each other, so this side is added last).
alter table public.media
  add constraint media_content_id_fkey
  foreign key (content_id) references public.content (id) on delete cascade;
