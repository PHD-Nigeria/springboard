-- Flattens the text-bearing fields of a content.body block document (see
-- src/content-types/blocks for the TypeScript/zod shape of this JSON) into
-- plain text, so full-text search can index block-based bodies. Must be
-- IMMUTABLE to be used inside the generated search_vector column below;
-- jsonb array element order is preserved by Postgres, so this is genuinely
-- deterministic for a given input.
create or replace function public.extract_block_text(body jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    string_agg(
      coalesce(elem ->> 'text', '') || ' ' ||
      coalesce(elem ->> 'label', '') || ' ' ||
      coalesce(elem ->> 'caption', '') || ' ' ||
      coalesce(elem ->> 'attribution', '') || ' ' ||
      coalesce(elem ->> 'description', ''),
      ' '
    ),
    ''
  )
  from jsonb_array_elements(coalesce(body -> 'blocks', '[]'::jsonb)) as elem;
$$;

comment on function public.extract_block_text is 'Flattens the text-bearing fields of a content.body block document into plain text for full-text indexing.';

-- content is the polymorphic core: every EDITOR_NOTE, ARTICLE, COMPANY_NEWS,
-- EVENT, STAFF_SPOTLIGHT, BIRTHDAY, HEALTH_TIP, and GALLERY row lives here.
-- Type-specific fields (an EVENT's date/location, a HEALTH_TIP's source, ...)
-- live in `metadata`, validated at the application layer against the
-- content-type registry's zod schema rather than as dedicated columns/tables.
create table public.content (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.publications (id) on delete set null,
  content_type public.content_type not null,
  slug text not null,
  title text not null,
  subtitle text,
  summary text,
  -- Versioned JSON block document: { version: 1, blocks: [...] }.
  body jsonb not null default '{"version": 1, "blocks": []}'::jsonb,
  -- Content-type-specific structured fields (event date/location, health tip
  -- source, etc.), validated by the app against the registry's zod schema.
  metadata jsonb not null default '{}'::jsonb,
  status public.content_status not null default 'draft',
  section_id uuid references public.sections (id) on delete set null,
  author_id uuid references public.authors (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  cover_media_id uuid references public.media (id) on delete set null,
  display_order int not null default 0,
  publish_at timestamptz,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  search_vector tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(public.extract_block_text(body), '')
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Publication-scoped slug uniqueness (e.g. one "editor-note" per issue).
  constraint content_slug_unique_per_publication unique (publication_id, slug)
);

-- Evergreen content (publication_id is null) isn't covered by the constraint
-- above, since Postgres treats every NULL as distinct for uniqueness — this
-- partial index closes that gap so evergreen slugs can't collide either.
create unique index content_slug_unique_evergreen_idx
  on public.content (slug)
  where publication_id is null;

create index content_status_publish_at_idx on public.content (status, publish_at);
create index content_publication_id_idx on public.content (publication_id);
create index content_section_id_idx on public.content (section_id);
create index content_created_by_idx on public.content (created_by);
create index content_search_vector_idx on public.content using gin (search_vector);

create trigger set_content_updated_at
  before update on public.content
  for each row execute function public.set_updated_at();
