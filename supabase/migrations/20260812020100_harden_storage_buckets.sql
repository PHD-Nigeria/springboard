-- Hardens the two buckets created in 20260812011200_storage_buckets.sql,
-- which had no allowed_mime_types and no per-bucket file_size_limit (falling
-- back to the global 50MiB default in supabase/config.toml with no MIME
-- restriction at all).
--
-- Allowlist covers what the content model actually needs: content.metadata/
-- body image and gallery blocks (jpeg/png/webp), and the video block's
-- mediaId path (mp4/webm). SVG is deliberately excluded — an SVG can embed
-- <script>, a real XSS vector for user-uploaded files served from the same
-- origin. Larger/longer video is expected to use the video block's
-- `externalUrl` field (an external host) rather than direct upload.
--
-- 25 MiB comfortably covers high-resolution editorial photography and short
-- video clips without being an effectively-unlimited ceiling. Both buckets
-- get the same limits since media-private holds the same kind of files as
-- media-public, just pre-publish.
update storage.buckets
set
  file_size_limit = 26214400, -- 25 MiB, in bytes
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm'
  ]
where id in ('media-public', 'media-private');
