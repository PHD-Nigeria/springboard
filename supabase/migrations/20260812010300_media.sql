-- media stores file metadata/references only; the actual bytes live in
-- Supabase Storage (see the media-public/media-private buckets created in a
-- later migration). Created before content/publications/authors/staff so
-- those tables can reference it directly.
create table public.media (
  id uuid primary key default gen_random_uuid(),
  bucket public.media_bucket not null default 'private',
  storage_path text not null,
  -- Nullable owner content row, used for gallery membership (a GALLERY's
  -- images are media rows with content_id = the gallery content row and an
  -- explicit display_order). The foreign key itself is added in a later
  -- migration once public.content exists (content and media reference each
  -- other, so one side must be added after both tables are created).
  content_id uuid,
  display_order int not null default 0,
  alt_text text,
  caption text,
  mime_type text,
  width int,
  height int,
  file_size_bytes bigint,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.media is 'Metadata/reference to a file in Supabase Storage. No binary data is stored in Postgres.';

create index media_content_id_idx on public.media (content_id);
create unique index media_bucket_storage_path_idx on public.media (bucket, storage_path);
