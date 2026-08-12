-- authors: bylines for content (may or may not correspond to a login/profile).
create table public.authors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  bio text,
  avatar_media_id uuid references public.media (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_authors_updated_at
  before update on public.authors
  for each row execute function public.set_updated_at();

-- staff: the employee directory used for spotlights, birthdays, and mentions.
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  full_name text not null,
  title text,
  department text,
  bio text,
  photo_media_id uuid references public.media (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_staff_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();
