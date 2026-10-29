import "server-only";
import { isValidYouTubeId, youTubeWatchUrl } from "@/lib/video/youtube";

/**
 * Asks YouTube's public oEmbed endpoint whether a video exists and can be
 * embedded. The request goes to one fixed host, and its `url` parameter is
 * rebuilt from an already-validated 11-character id — no editor-supplied
 * string is ever interpolated into the request, so this can't be pointed at
 * another host (no SSRF), and redirects are refused outright.
 *
 * It is advisory, not authoritative: oEmbed reports what an anonymous viewer
 * could embed *now*. A video can still be made private or removed later, and
 * Springboard's draft/published status never changes YouTube's own privacy.
 */

export type YouTubeAvailability =
  | "embeddable" // 200 — public or unlisted, embedding allowed
  | "not_embeddable_or_private" // 401 — private, or the owner disabled embedding
  | "not_found" // 404 — deleted, or private, or the id doesn't exist
  | "unknown"; // anything else, including network failure/timeouts

export interface YouTubeCheckResult {
  videoId: string;
  availability: YouTubeAvailability;
  /** The title YouTube reports. Only present when embeddable. Shown to editors to confirm — never saved automatically. */
  title?: string;
  channel?: string;
  /** oEmbed's own width/height — it reports a landscape box even for Shorts, so this is not used to pick orientation. */
  width?: number;
  height?: number;
}

const OEMBED_ENDPOINT = "https://www.youtube.com/oembed";
const TIMEOUT_MS = 6000;

export async function checkYouTubeVideo(videoId: string): Promise<YouTubeCheckResult> {
  const watchUrl = isValidYouTubeId(videoId) ? youTubeWatchUrl(videoId) : null;
  if (!watchUrl) return { videoId, availability: "unknown" };

  const endpoint = `${OEMBED_ENDPOINT}?${new URLSearchParams({ url: watchUrl, format: "json" }).toString()}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
  } catch {
    return { videoId, availability: "unknown" };
  }

  if (response.status === 401) return { videoId, availability: "not_embeddable_or_private" };
  // 404: deleted/private/unknown id. 400: an id YouTube itself rejects as malformed — also "no such video" to an editor.
  if (response.status === 404 || response.status === 400) return { videoId, availability: "not_found" };
  if (!response.ok) return { videoId, availability: "unknown" };

  try {
    const data = (await response.json()) as { title?: unknown; author_name?: unknown; width?: unknown; height?: unknown };
    return {
      videoId,
      availability: "embeddable",
      title: typeof data.title === "string" ? data.title : undefined,
      channel: typeof data.author_name === "string" ? data.author_name : undefined,
      width: typeof data.width === "number" ? data.width : undefined,
      height: typeof data.height === "number" ? data.height : undefined,
    };
  } catch {
    return { videoId, availability: "unknown" };
  }
}
