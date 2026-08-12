-- Row Level Security. Public/anon can only ever see published (or
-- time-eligible scheduled) content; contributor/editor/admin get
-- progressively wider access via the role helpers defined earlier.

-- ---------------------------------------------------------------- profiles
alter table public.profiles enable row level security;

create policy profiles_select_own_or_admin
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_own_or_admin
  on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Row creation is handled by the handle_new_user trigger (security definer);
-- no direct insert policy is granted to end users.

-- ------------------------------------------------------------ publications
alter table public.publications enable row level security;

create policy publications_select
  on public.publications for select
  using (
    status = 'published'
    or (status = 'scheduled' and publish_at <= now())
    or public.is_contributor_or_above()
  );

create policy publications_write
  on public.publications for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

-- ----------------------------------------------------------------sections
alter table public.sections enable row level security;

create policy sections_select
  on public.sections for select
  using (
    public.is_contributor_or_above()
    or exists (
      select 1 from public.publications p
      where p.id = sections.publication_id
        and (p.status = 'published' or (p.status = 'scheduled' and p.publish_at <= now()))
    )
  );

create policy sections_write
  on public.sections for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

-- ----------------------------------------------------------------- authors
alter table public.authors enable row level security;

create policy authors_select on public.authors for select using (true);

create policy authors_write
  on public.authors for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

-- ------------------------------------------------------------------- staff
alter table public.staff enable row level security;

create policy staff_select
  on public.staff for select
  using (is_active or public.is_contributor_or_above());

create policy staff_write
  on public.staff for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

-- -------------------------------------------------------------- categories
alter table public.categories enable row level security;

create policy categories_select on public.categories for select using (true);

create policy categories_write
  on public.categories for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

-- -------------------------------------------------------------------- tags
alter table public.tags enable row level security;

create policy tags_select on public.tags for select using (true);

create policy tags_write
  on public.tags for all
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

-- ----------------------------------------------------------------- content
alter table public.content enable row level security;

create policy content_select_public
  on public.content for select
  using (
    status = 'published'
    or (status = 'scheduled' and publish_at <= now())
  );

create policy content_select_own
  on public.content for select
  using (created_by = auth.uid());

create policy content_select_staff
  on public.content for select
  using (public.is_editor_or_admin());

create policy content_insert
  on public.content for insert
  with check (
    public.is_editor_or_admin()
    or (
      public.is_contributor_or_above()
      and created_by = auth.uid()
      and status = 'draft'
    )
  );

create policy content_update_staff
  on public.content for update
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

-- Contributors may only edit their own rows, and only while those rows are
-- still in draft/review — they cannot move content into scheduled/published/
-- archived themselves.
create policy content_update_own_draft
  on public.content for update
  using (
    public.is_contributor_or_above()
    and created_by = auth.uid()
    and status in ('draft', 'review')
  )
  with check (
    public.is_contributor_or_above()
    and created_by = auth.uid()
    and status in ('draft', 'review')
  );

-- Hard delete is admin-only; editors archive (status = 'archived') instead.
create policy content_delete_admin
  on public.content for delete
  using (public.is_admin());

-- ------------------------------------------------------------------- media
alter table public.media enable row level security;

create policy media_select
  on public.media for select
  using (
    content_id is null
    or exists (
      select 1 from public.content c
      where c.id = media.content_id
        and (
          c.status = 'published'
          or (c.status = 'scheduled' and c.publish_at <= now())
          or c.created_by = auth.uid()
          or public.is_editor_or_admin()
        )
    )
  );

create policy media_write
  on public.media for all
  using (public.is_contributor_or_above())
  with check (public.is_contributor_or_above());

-- ---------------------------------------------------------- staff_spotlights
alter table public.staff_spotlights enable row level security;

create policy staff_spotlights_select
  on public.staff_spotlights for select
  using (
    exists (
      select 1 from public.content c
      where c.id = staff_spotlights.content_id
        and (
          c.status = 'published'
          or (c.status = 'scheduled' and c.publish_at <= now())
          or c.created_by = auth.uid()
          or public.is_editor_or_admin()
        )
    )
  );

create policy staff_spotlights_write
  on public.staff_spotlights for all
  using (public.is_contributor_or_above())
  with check (public.is_contributor_or_above());

-- --------------------------------------------------------- spotlight_questions
alter table public.spotlight_questions enable row level security;

create policy spotlight_questions_select
  on public.spotlight_questions for select
  using (
    exists (
      select 1
      from public.staff_spotlights s
      join public.content c on c.id = s.content_id
      where s.id = spotlight_questions.spotlight_id
        and (
          c.status = 'published'
          or (c.status = 'scheduled' and c.publish_at <= now())
          or c.created_by = auth.uid()
          or public.is_editor_or_admin()
        )
    )
  );

create policy spotlight_questions_write
  on public.spotlight_questions for all
  using (public.is_contributor_or_above())
  with check (public.is_contributor_or_above());

-- ------------------------------------------------------------- content_tags
alter table public.content_tags enable row level security;

create policy content_tags_select
  on public.content_tags for select
  using (
    exists (
      select 1 from public.content c
      where c.id = content_tags.content_id
        and (
          c.status = 'published'
          or (c.status = 'scheduled' and c.publish_at <= now())
          or c.created_by = auth.uid()
          or public.is_editor_or_admin()
        )
    )
  );

create policy content_tags_write
  on public.content_tags for all
  using (public.is_contributor_or_above())
  with check (public.is_contributor_or_above());

-- ------------------------------------------------------------ content_staff
alter table public.content_staff enable row level security;

create policy content_staff_select
  on public.content_staff for select
  using (
    exists (
      select 1 from public.content c
      where c.id = content_staff.content_id
        and (
          c.status = 'published'
          or (c.status = 'scheduled' and c.publish_at <= now())
          or c.created_by = auth.uid()
          or public.is_editor_or_admin()
        )
    )
  );

create policy content_staff_write
  on public.content_staff for all
  using (public.is_contributor_or_above())
  with check (public.is_contributor_or_above());
