import type { VideoBlock as VideoBlockData } from "@/content-types/blocks";

interface ResolvedMedia {
  url: string;
}

export function VideoBlock({ block, media }: { block: VideoBlockData; media?: ResolvedMedia }) {
  const src = block.externalUrl ?? media?.url;
  if (!src) return null; // soft-fail on a stale/missing mediaId

  return <video src={src} controls />;
}
