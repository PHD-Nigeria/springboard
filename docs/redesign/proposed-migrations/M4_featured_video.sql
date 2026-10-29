-- =============================================================================
-- PROPOSED — NOT APPLIED. Lives in docs/, deliberately outside
-- supabase/migrations/, so `supabase db push` / `db reset` can never pick it up.
-- To adopt: review, copy into supabase/migrations/<timestamp>_featured_video.sql
-- on a reviewed PR, apply to a verified-isolated staging project first.
--
-- M4 — Admin-selectable homepage featured video. Additive only.
--   * One nullable pair of columns on site_settings. No existing column,
--     row, policy, role, auth setting or cron is touched.
--   * No new table and no copy of any video: videos stay YouTube blocks inside
--     content bodies, exactly as today. This only records WHICH one to feature.
--   * Write access is inherited from the existing site_settings_write policy
--     (admin only today) and read from site_settings_select. Nothing is widened.
--   * Edition association needs no new column: a video belongs to the edition of
--     the story that contains it (content.publication_id). Making a new quarter
--     active changes site_settings.default_publication_id only, so older
--     editions keep their stories and therefore their videos.
-- =============================================================================

alter table public.site_settings
  add column featured_video_content_id uuid
    references public.content (id) on delete set null,
  add column featured_video_id text,
  -- Same shape the app enforces in lib/video/youtube.ts (11 chars, A-Z a-z 0-9 _ -).
  add constraint site_settings_featured_video_id_format
    check (featured_video_id is null or featured_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  -- Either both set or neither: a video id without its story cannot be resolved.
  add constraint site_settings_featured_video_pair
    check ((featured_video_content_id is null) = (featured_video_id is null));

comment on column public.site_settings.featured_video_content_id is
  'Story that contains the homepage featured video. The app re-reads that story, requires status=published, and finds the video block whose videoId matches featured_video_id. Anything missing fails closed to "no featured video" (or the newest published video).';
comment on column public.site_settings.featured_video_id is
  'YouTube id (11 chars) of the featured video block inside featured_video_content_id. Never a URL.';

-- Rollback (nothing else depends on these columns):
--   alter table public.site_settings
--     drop constraint site_settings_featured_video_pair,
--     drop constraint site_settings_featured_video_id_format,
--     drop column featured_video_id,
--     drop column featured_video_content_id;
