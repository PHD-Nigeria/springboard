import type { VideoBlock as VideoBlockData } from "@/content-types/blocks";
import { isValidYouTubeId, parseYouTubeUrl } from "@/lib/video/youtube";
import { YouTubeEmbed } from "./YouTubeEmbed";

interface ResolvedMedia {
  url: string;
  alt?: string;
}

/**
 * Renders a video block. The current format stores a validated YouTube id and
 * renders the click-to-play player. Two LEGACY shapes are still tolerated so
 * older stored documents keep behaving:
 *  - an `externalUrl` that is a supported YouTube link is treated as that
 *    video (re-validated here — the stored string is never used as a URL);
 *  - a `mediaId` resolving to a public Media Library file renders a native
 *    <video> (its URL comes from our own public bucket, not editor input).
 * Anything else — including any non-YouTube `externalUrl`, which used to be
 * handed straight to <video src> — renders nothing.
 */
export function VideoBlock({
  block,
  media,
  thumbnail,
}: {
  block: VideoBlockData;
  media?: ResolvedMedia;
  thumbnail?: ResolvedMedia;
}) {
  const fromUrl = !block.videoId && block.externalUrl ? parseYouTubeUrl(block.externalUrl) : null;
  const videoId = isValidYouTubeId(block.videoId) ? block.videoId : (fromUrl?.videoId ?? null);

  if (videoId) {
    return (
      <YouTubeEmbed
        videoId={videoId}
        title={block.title?.trim() || "Video"}
        caption={block.caption?.trim() || undefined}
        orientation={block.orientation ?? (fromUrl?.isShort ? "portrait" : "landscape")}
        thumbnail={thumbnail ? { url: thumbnail.url, alt: thumbnail.alt } : undefined}
      />
    );
  }

  if (block.mediaId && media) {
    return <video src={media.url} controls preload="none" />;
  }

  return null; // stale/unsupported reference — soft-fail like every other block
}
