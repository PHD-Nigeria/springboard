-- Archive PDFs. Additive: nullable columns on publications + one new PRIVATE bucket for the PDFs.
--   * A PDF is the ORIGINAL file of a past edition, stored as-is; it is never converted to articles.
--   * period_label / period_start let an edition that has no web stories (a PDF-only back issue) still be
--     shown with its period and sorted newest-first. Both are optional; existing editions are unchanged.
--   * Bucket 'edition-pdfs' is PRIVATE (a public bucket would serve any known URL to anyone, including the PDF of
--     an unpublished edition). Visitors get a short-lived signed link from /archive/pdf/<slug>, which Storage only
--     issues when the storage read policy below allows it: editors/admins can read every file, and anyone else can
--     read a file only while it is attached to an edition they can already see (publications RLS: published, or
--     scheduled and due). A draft or archived edition's PDF is therefore not retrievable by the public.
--     PDF mime only, 50 MiB. Writes: editor or admin. Delete: admin.
-- Rollback: alter table public.publications drop column pdf_path, drop column pdf_filename,
--   drop column pdf_size_bytes, drop column period_label, drop column period_start;
--   then delete the bucket's objects and the bucket in the Supabase dashboard.

alter table public.publications
  add column if not exists pdf_path text,
  add column if not exists pdf_filename text,
  add column if not exists pdf_size_bytes bigint,
  add column if not exists period_label text,
  add column if not exists period_start date;

alter table public.publications
  drop constraint if exists publications_pdf_path_format,
  add constraint publications_pdf_path_format
    check (pdf_path is null or pdf_path ~ '^editions/[0-9a-fA-F-]{36}\.pdf$'),
  drop constraint if exists publications_period_label_length,
  add constraint publications_period_label_length
    check (period_label is null or char_length(btrim(period_label)) between 1 and 80);

comment on column public.publications.pdf_path is 'Object path inside the edition-pdfs bucket (editions/<uuid>.pdf). Null when the edition has no PDF.';
comment on column public.publications.period_label is 'Human period shown on the Archive card, e.g. "July – September 2025". Optional.';
comment on column public.publications.period_start is 'First day of the edition period; used to sort the Archive newest-first. Optional (falls back to published_at).';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('edition-pdfs', 'edition-pdfs', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

-- Enforce private even if the bucket somehow pre-existed (no object is touched).
update storage.buckets set public = false where id = 'edition-pdfs';

drop policy if exists edition_pdfs_public_read on storage.objects;
drop policy if exists edition_pdfs_read on storage.objects;
create policy edition_pdfs_read
  on storage.objects for select
  using (
    bucket_id = 'edition-pdfs'
    and (
      public.is_editor_or_admin()
      -- The subquery runs under the caller's own publications RLS, so an anonymous visitor only matches
      -- editions that are publicly visible.
      or exists (select 1 from public.publications p where p.pdf_path = storage.objects.name)
    )
  );

drop policy if exists edition_pdfs_write on storage.objects;
create policy edition_pdfs_write
  on storage.objects for insert
  with check (bucket_id = 'edition-pdfs' and public.is_editor_or_admin());

drop policy if exists edition_pdfs_update on storage.objects;
create policy edition_pdfs_update
  on storage.objects for update
  using (bucket_id = 'edition-pdfs' and public.is_editor_or_admin())
  with check (bucket_id = 'edition-pdfs' and public.is_editor_or_admin());

drop policy if exists edition_pdfs_delete on storage.objects;
create policy edition_pdfs_delete
  on storage.objects for delete
  using (bucket_id = 'edition-pdfs' and public.is_admin());
