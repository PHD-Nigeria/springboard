import type { Block, BodyDocument } from "@/content-types/blocks";
import { parseYouTubeUrl } from "@/lib/video/youtube";

/**
 * Write-side policing of video blocks, run by saveContentAction on the
 * server for every save (the block editor's own checks are only convenience —
 * the browser is never trusted). Deliberately NOT part of the read-side zod
 * schema: a stored body that fails validation renders as an empty document
 * (see lib/content/queries.ts), so tightening the schema for older documents
 * could blank live pages. Here, strictness only ever blocks a *new* save
 * with a clear message the editor can act on.
 *
 * Every accepted video block leaves in one canonical shape — provider
 * "youtube", the validated id, a trimmed title — with the legacy `mediaId`
 * and `externalUrl` fields dropped, so nothing but an id ever gets stored.
 */

export const VIDEO_BLOCK_ERRORS = {
  UNSUPPORTED_LINK:
    "A video block contains a link that isn't a supported YouTube link. Paste a youtube.com or youtu.be video link, or remove the block.",
  UPLOADED_VIDEO: "Uploaded video files aren't supported. Host the video on YouTube and paste its link into the video block.",
  TITLE_REQUIRED: "Every video needs a title — it's the accessible label for the player. Add one to each video block.",
} as const;

export function normalizeVideoBlocks(body: BodyDocument): { body: BodyDocument; error: string | null } {
  const blocks: Block[] = [];

  for (const block of body.blocks) {
    if (block.type !== "video") {
      blocks.push(block);
      continue;
    }

    let videoId = block.videoId ?? null;
    let isShort = false;
    if (!videoId && block.externalUrl) {
      const parsed = parseYouTubeUrl(block.externalUrl);
      if (!parsed) return { body, error: VIDEO_BLOCK_ERRORS.UNSUPPORTED_LINK };
      videoId = parsed.videoId;
      isShort = parsed.isShort;
    }
    if (!videoId) {
      return { body, error: block.mediaId ? VIDEO_BLOCK_ERRORS.UPLOADED_VIDEO : VIDEO_BLOCK_ERRORS.UNSUPPORTED_LINK };
    }

    const title = block.title?.trim();
    if (!title) return { body, error: VIDEO_BLOCK_ERRORS.TITLE_REQUIRED };

    const caption = block.caption?.trim();
    blocks.push({
      type: "video",
      provider: "youtube",
      videoId,
      title,
      ...(caption ? { caption } : {}),
      orientation: block.orientation ?? (isShort ? "portrait" : "landscape"),
      ...(block.thumbnailMediaId ? { thumbnailMediaId: block.thumbnailMediaId } : {}),
    });
  }

  return { body: { ...body, blocks }, error: null };
}
