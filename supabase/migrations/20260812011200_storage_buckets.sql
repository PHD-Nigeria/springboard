-- Two Storage buckets, matching the media_bucket enum: a public bucket for
-- media attached to published content (plus evergreen public-facing images),
-- and a private bucket for draft/review media, readable only by
-- contributor+ sessions via a signed URL.
insert into storage.buckets (id, name, public)
values
  ('media-public', 'media-public', true),
  ('media-private', 'media-private', false)
on conflict (id) do nothing;

create policy media_public_read
  on storage.objects for select
  using (bucket_id = 'media-public');

create policy media_public_write
  on storage.objects for insert
  with check (bucket_id = 'media-public' and public.is_contributor_or_above());

create policy media_public_update
  on storage.objects for update
  using (bucket_id = 'media-public' and public.is_contributor_or_above())
  with check (bucket_id = 'media-public' and public.is_contributor_or_above());

create policy media_public_delete
  on storage.objects for delete
  using (bucket_id = 'media-public' and public.is_editor_or_admin());

create policy media_private_read
  on storage.objects for select
  using (bucket_id = 'media-private' and public.is_contributor_or_above());

create policy media_private_write
  on storage.objects for insert
  with check (bucket_id = 'media-private' and public.is_contributor_or_above());

create policy media_private_update
  on storage.objects for update
  using (bucket_id = 'media-private' and public.is_contributor_or_above())
  with check (bucket_id = 'media-private' and public.is_contributor_or_above());

create policy media_private_delete
  on storage.objects for delete
  using (bucket_id = 'media-private' and public.is_editor_or_admin());
