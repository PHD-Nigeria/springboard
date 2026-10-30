import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Block, BodyDocument } from "@/content-types/blocks";
import { getPublicUrl, getSignedPrivateUrl, PRIVATE_PREVIEW_URL_TTL_SECONDS } from "@/lib/storage/buckets";
import { getAdminSession } from "@/lib/auth/session";
import { publicEditionFilter } from "@/lib/content/queries";

interface ResolvedMedia {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  caption?: string;
}

interface ResolvedRelatedContent {
  id: string;
  title: string;
  href: string;
}

export function collectMediaIds(blocks: Block[]): string[] {
  const ids = new Set<string>();
  for (const block of blocks) {
    if (block.type === "image") ids.add(block.mediaId);
    if (block.type === "gallery") block.mediaIds.forEach((id) => ids.add(id));
    if (block.type === "video" && block.mediaId) ids.add(block.mediaId);
    if (block.type === "video" && block.thumbnailMediaId) ids.add(block.thumbnailMediaId);
  }
  return [...ids];
}

function collectRelatedContentIds(blocks: Block[]): string[] {
  const ids = new Set<string>();
  for (const block of blocks) {
    if (block.type === "related-content") block.contentIds.forEach((id) => ids.add(id));
  }
  return [...ids];
}

interface MediaRow {
  id: string;
  storage_path: string;
  bucket: "public" | "private";
  width: number | null;
  height: number | null;
  alt_text: string | null;
  caption: string | null;
}

interface RelatedContentRow {
  id: string;
  title: string;
  slug: string;
  publications: { slug: string } | null;
}

/**
 * Batch-resolves every mediaId/contentId a BodyDocument's blocks reference
 * into the `mediaMap`/`relatedContent` shape BlockRenderer already expects
 * (src/components/blocks/BlockRenderer.tsx) — one query per reference type,
 * not one per block, however many blocks there are.
 *
 * `options.includePrivate` is passed ONLY by the admin content preview (via Content.isStaffPreview). It lets
 * private-bucket images resolve to short-lived signed URLs — and even then only if a signed-in staff session is
 * confirmed again here, so no caller can obtain signed URLs by accident. Public pages never pass it.
 */
export async function resolveBodyReferences(
  supabase: SupabaseClient<Database>,
  body: BodyDocument,
  options: { includePrivate?: boolean } = {}
): Promise<{ mediaMap: Record<string, ResolvedMedia>; relatedContent: ResolvedRelatedContent[] }> {
  const mediaIds = collectMediaIds(body.blocks);
  const relatedIds = collectRelatedContentIds(body.blocks);
  // Related-content links are a public discovery surface too: on a public page, never list a story whose edition is not
  // public. (The staff preview, which passes includePrivate, keeps seeing everything it is allowed to.)
  const editionFilter = options.includePrivate === true ? "id.not.is.null" : await publicEditionFilter();

  const [mediaResult, relatedResult] = await Promise.all([
    mediaIds.length
      ? supabase
          .from("media")
          .select("id, storage_path, bucket, width, height, alt_text, caption")
          .in("id", mediaIds)
          .returns<MediaRow[]>()
      : Promise.resolve({ data: [] as MediaRow[], error: null }),
    relatedIds.length
      ? supabase
          .from("content")
          .select("id, title, slug, publications:publication_id ( slug )")
          .in("id", relatedIds)
          .or(editionFilter)
          .returns<RelatedContentRow[]>()
      : Promise.resolve({ data: [] as RelatedContentRow[], error: null }),
  ]);

  if (mediaResult.error) throw mediaResult.error;
  if (relatedResult.error) throw relatedResult.error;

  // A private-bucket row is skipped rather than resolved to a (404ing)
  // public URL — the same "unreachable is treated as missing" rule
  // lib/content/queries.ts applies to cover/avatar images, so ImageBlock's
  // existing stale-reference handling (block.tsx: `if (!media) return
  // null`) covers this case too, instead of rendering a broken <img>.
  // The one exception is the staff-only admin preview (options.includePrivate,
  // re-checked against a live staff session below): private rows then get
  // short-lived signed URLs instead of being skipped.
  const mediaMap: Record<string, ResolvedMedia> = {};
  const toResolved = (row: MediaRow, url: string): ResolvedMedia => ({
    url,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    alt: row.alt_text ?? undefined,
    caption: row.caption ?? undefined,
  });
  const canSignPrivate = options.includePrivate === true && (await getAdminSession()) !== null;
  const privateRows: MediaRow[] = [];
  for (const row of mediaResult.data ?? []) {
    if (row.bucket !== "public") {
      if (canSignPrivate) privateRows.push(row);
      continue;
    }
    mediaMap[row.id] = toResolved(row, getPublicUrl(supabase, row.storage_path));
  }
  await Promise.all(
    privateRows.map(async (row) => {
      try {
        mediaMap[row.id] = toResolved(row, await getSignedPrivateUrl(supabase, row.storage_path, PRIVATE_PREVIEW_URL_TTL_SECONDS));
      } catch (signError) {
        // Skipped like any unreachable image; log the message only, never the path or URL.
        console.error("preview: could not sign a private body image:", signError instanceof Error ? signError.message : "unknown error");
      }
    })
  );

  const relatedContent: ResolvedRelatedContent[] = (relatedResult.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    href: row.publications ? `/issues/${row.publications.slug}/${row.slug}` : "#",
  }));

  return { mediaMap, relatedContent };
}
