import type { ImageBlock as ImageBlockData } from "@/content-types/blocks";

interface ResolvedMedia {
  url: string;
  width?: number;
  height?: number;
}

/** `media` is looked up by the caller from block.mediaId (see BlockRenderer). */
export function ImageBlock({ block, media }: { block: ImageBlockData; media?: ResolvedMedia }) {
  if (!media) return null; // soft-fail on a stale/missing mediaId

  return (
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- placeholder only, real implementation will use next/image */}
      <img src={media.url} alt={block.alt ?? ""} width={media.width} height={media.height} />
      {block.caption ? <figcaption>{block.caption}</figcaption> : null}
    </figure>
  );
}
