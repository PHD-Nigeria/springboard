/**
 * The one place a YouTube link becomes a video id — and the only place a
 * video id becomes a URL. Dependency-free (and written in erasable
 * TypeScript only) so scripts/test-youtube-url.mjs can import it directly,
 * and so the same code runs in the browser (instant feedback in the block
 * editor) and on the server (saveContentAction re-validates; the browser is
 * never trusted).
 *
 * The stored value is only ever the 11-character id, never the URL the
 * editor pasted: every URL that reaches a page is rebuilt here from that id
 * against a fixed host. That is what rules out arbitrary iframe HTML,
 * arbitrary embed domains and unsafe schemes — none of them can be
 * represented in the stored data in the first place.
 */

export const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** Exact hostnames only — never a suffix match, so "youtube.com.evil.example" and "notyoutube.com" are rejected. */
const WATCH_HOSTS: readonly string[] = ["youtube.com", "www.youtube.com", "m.youtube.com"];
const SHORT_LINK_HOSTS: readonly string[] = ["youtu.be", "www.youtu.be"];
const NOCOOKIE_HOSTS: readonly string[] = ["youtube-nocookie.com", "www.youtube-nocookie.com"];

const MAX_INPUT_LENGTH = 300;

export interface ParsedYouTubeUrl {
  videoId: string;
  /** True only for a youtube.com/shorts/<id> link — the editor uses this to default the player to vertical. */
  isShort: boolean;
}

export function isValidYouTubeId(value: unknown): value is string {
  return typeof value === "string" && YOUTUBE_ID_PATTERN.test(value);
}

/** "/a/b/" -> ["a", "b"]. Returns null if any segment is empty ("//"), so odd paths never match by accident. */
function pathSegments(pathname: string): string[] | null {
  const trimmed = pathname.replace(/\/$/, "");
  if (trimmed === "") return [];
  const segments = trimmed.slice(1).split("/");
  return segments.some((segment) => segment === "") ? null : segments;
}

/**
 * Accepts exactly these shapes (https only), and returns null for anything else:
 *   https://youtu.be/<id>
 *   https://youtube.com|www.youtube.com|m.youtube.com/watch?v=<id>
 *   https://youtube.com|www.youtube.com|m.youtube.com/shorts/<id>
 *   https://youtube.com|www.youtube.com|m.youtube.com/embed/<id>
 *   https://youtube.com|www.youtube.com|m.youtube.com/live/<id>
 *   https://youtube-nocookie.com|www.youtube-nocookie.com/embed/<id>
 * Extra query parameters (tracking, start times, playlists) are ignored, never stored.
 */
export function parseYouTubeUrl(input: unknown): ParsedYouTubeUrl | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (raw.length === 0 || raw.length > MAX_INPUT_LENGTH) return null;
  // Whitespace/control characters or angle brackets inside the value mean this is not a bare URL
  // (e.g. pasted iframe HTML) — reject before the URL parser gets a chance to be lenient.
  if (/[\s\u0000-\u001f\u007f<>"'`\\]/.test(raw)) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  if (url.username !== "" || url.password !== "") return null;
  if (url.port !== "") return null;

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const segments = pathSegments(url.pathname);
  if (!segments) return null;

  if (SHORT_LINK_HOSTS.includes(host)) {
    if (segments.length !== 1) return null;
    return isValidYouTubeId(segments[0]) ? { videoId: segments[0], isShort: false } : null;
  }

  if (NOCOOKIE_HOSTS.includes(host)) {
    if (segments.length !== 2 || segments[0] !== "embed") return null;
    return isValidYouTubeId(segments[1]) ? { videoId: segments[1], isShort: false } : null;
  }

  if (WATCH_HOSTS.includes(host)) {
    if (segments.length === 1 && segments[0] === "watch") {
      const id = url.searchParams.get("v");
      return isValidYouTubeId(id) ? { videoId: id, isShort: false } : null;
    }
    if (segments.length === 2 && ["shorts", "embed", "live"].includes(segments[0])) {
      return isValidYouTubeId(segments[1]) ? { videoId: segments[1], isShort: segments[0] === "shorts" } : null;
    }
  }

  return null;
}

/** Privacy-enhanced embed host, built only from a validated id. Returns null if the id is not valid. */
export function youTubeEmbedUrl(videoId: string, options: { autoplay?: boolean } = {}): string | null {
  if (!isValidYouTubeId(videoId)) return null;
  const params = new URLSearchParams({ rel: "0", playsinline: "1", modestbranding: "1" });
  if (options.autoplay) params.set("autoplay", "1");
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

/** The public watch page — used for the "Watch on YouTube" fallback link. Returns null if the id is not valid. */
export function youTubeWatchUrl(videoId: string, isShort = false): string | null {
  if (!isValidYouTubeId(videoId)) return null;
  return isShort ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * YouTube's own poster image, built only from a validated id against one
 * fixed host. Using it means the visitor's browser contacts Google as soon as
 * the thumbnail loads (before any play click) — callers must opt in
 * deliberately; the article Video block does not. Returns null if the id is not valid.
 */
export function youTubeThumbnailUrl(videoId: string): string | null {
  if (!isValidYouTubeId(videoId)) return null;
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
