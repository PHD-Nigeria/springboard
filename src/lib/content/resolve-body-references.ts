import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Block, BodyDocument } from "@/content-types/blocks";
import { getPublicUrl } from "@/lib/storage/buckets";

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

function collectMediaIds(blocks: Block[]): string[] {
  const ids = new Set<string>();
  for (const block of blocks) {
    if (block.type === "image") ids.add(block.mediaId);
    if (block.type === "gallery") block.mediaIds.forEach((id) => ids.add(id));
    if (block.type === "video" && block.mediaId) ids.add(block.mediaId);
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
 */
export async function resolveBodyReferences(
  supabase: SupabaseClient<Database>,
  body: BodyDocument
): Promise<{ mediaMap: Record<string, ResolvedMedia>; relatedContent: ResolvedRelatedContent[] }> {
  const mediaIds = collectMediaIds(body.blocks);
  const relatedIds = collectRelatedContentIds(body.blocks);

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
  const mediaMap: Record<string, ResolvedMedia> = {};
  for (const row of mediaResult.data ?? []) {
    if (row.bucket !== "public") continue;
    mediaMap[row.id] = {
      url: getPublicUrl(supabase, row.storage_path),
      width: row.width ?? undefined,
      height: row.height ?? undefined,
      alt: row.alt_text ?? undefined,
      caption: row.caption ?? undefined,
    };
  }

  const relatedContent: ResolvedRelatedContent[] = (relatedResult.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    href: row.publications ? `/issues/${row.publications.slug}/${row.slug}` : "#",
  }));

  return { mediaMap, relatedContent };
}
