import type { BodyDocument } from "@/content-types/blocks";

/**
 * Development-only fixture exercising all 9 content.body block types, for
 * verifying the BodyDocument schema + BlockRenderer end-to-end without
 * touching Supabase or inventing real Springboard editorial content.
 * Rendered at /dev/block-fixture (see src/app/dev/block-fixture/page.tsx),
 * which 404s outside development. Not imported by any production code path.
 *
 * mediaId/contentId values are fixture-only UUIDs with no corresponding
 * database rows; they resolve through the companion maps below instead of a
 * real Supabase query.
 */

const MEDIA_IMAGE = "00000000-0000-4000-8000-000000000001";
const MEDIA_GALLERY_1 = "00000000-0000-4000-8000-000000000002";
const MEDIA_GALLERY_2 = "00000000-0000-4000-8000-000000000003";
const MEDIA_GALLERY_3 = "00000000-0000-4000-8000-000000000004";
const MEDIA_VIDEO = "00000000-0000-4000-8000-000000000005";

const RELATED_CONTENT_1 = "00000000-0000-4000-8000-000000000006";
const RELATED_CONTENT_2 = "00000000-0000-4000-8000-000000000007";

export const blockDocumentFixture: BodyDocument = {
  version: 1,
  blocks: [
    {
      type: "paragraph",
      text: "Sample paragraph block, used to verify plain text rendering.",
    },
    {
      type: "heading",
      level: 2,
      text: "Sample heading block (level 2)",
    },
    {
      type: "image",
      mediaId: MEDIA_IMAGE,
      caption: "Sample image caption.",
      alt: "Sample placeholder image.",
    },
    {
      type: "gallery",
      mediaIds: [MEDIA_GALLERY_1, MEDIA_GALLERY_2, MEDIA_GALLERY_3],
    },
    {
      type: "quote",
      text: "Sample quote block text, used to verify blockquote rendering.",
      attribution: "Sample Attribution",
    },
    {
      type: "statistic",
      value: "42",
      label: "Sample statistic label",
      description: "Sample statistic description text.",
    },
    {
      type: "video",
      // Deliberately unresolvable playback target — this fixture verifies
      // the render path (a <video src> element is produced from a resolved
      // mediaId), not actual video playback.
      mediaId: MEDIA_VIDEO,
    },
    {
      type: "callout",
      style: "info",
      text: "Sample callout block text.",
    },
    {
      type: "related-content",
      contentIds: [RELATED_CONTENT_1, RELATED_CONTENT_2],
    },
  ],
};

export const blockDocumentFixtureMediaMap = {
  [MEDIA_IMAGE]: { url: "/dev-fixtures/placeholder.svg", width: 800, height: 450 },
  [MEDIA_GALLERY_1]: { url: "/dev-fixtures/placeholder.svg" },
  [MEDIA_GALLERY_2]: { url: "/dev-fixtures/placeholder.svg" },
  [MEDIA_GALLERY_3]: { url: "/dev-fixtures/placeholder.svg" },
  [MEDIA_VIDEO]: { url: "/dev-fixtures/placeholder.mp4" },
};

export const blockDocumentFixtureRelatedContent = [
  { id: RELATED_CONTENT_1, title: "Sample Related Item One", href: "#" },
  { id: RELATED_CONTENT_2, title: "Sample Related Item Two", href: "#" },
];
