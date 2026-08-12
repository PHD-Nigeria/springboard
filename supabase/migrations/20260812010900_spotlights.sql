-- staff_spotlights is the 1:1 link between a STAFF_SPOTLIGHT content row and
-- the staff member it profiles; spotlight_questions holds its ordered Q&A.
create table public.staff_spotlights (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null unique references public.content (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_staff_spotlights_updated_at
  before update on public.staff_spotlights
  for each row execute function public.set_updated_at();

create index staff_spotlights_staff_id_idx on public.staff_spotlights (staff_id);

create table public.spotlight_questions (
  id uuid primary key default gen_random_uuid(),
  spotlight_id uuid not null references public.staff_spotlights (id) on delete cascade,
  question text not null,
  answer text not null,
  display_order int not null default 0
);

create index spotlight_questions_spotlight_id_idx on public.spotlight_questions (spotlight_id);
