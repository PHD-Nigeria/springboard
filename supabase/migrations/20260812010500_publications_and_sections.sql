-- publications: an issue/drop, e.g. "Springboard Q2 '26".
create table public.publications (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  cover_media_id uuid references public.media (id) on delete set null,
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_publications_updated_at
  before update on public.publications
  for each row execute function public.set_updated_at();

create index publications_status_publish_at_idx on public.publications (status, publish_at);

-- sections: editor-orderable, relabelable groupings of content within one
-- publication (not a fixed global taxonomy) — a section mixes content types.
create table public.sections (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications (id) on delete cascade,
  slug text not null,
  title text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publication_id, slug)
);

create trigger set_sections_updated_at
  before update on public.sections
  for each row execute function public.set_updated_at();

create index sections_publication_id_idx on public.sections (publication_id);
