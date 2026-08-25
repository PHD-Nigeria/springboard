import Image from "next/image";
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
      <div className="relative overflow-hidden bg-surface">
        <Image
          src={media.url}
          alt={block.alt ?? block.caption ?? ""}
          width={media.width ?? 1200}
          height={media.height ?? 800}
          sizes="(min-width: 1024px) 672px, 100vw"
          className="h-auto w-full object-cover"
        />
      </div>
      {block.caption ? (
        <figcaption className="mt-2 font-body text-sm text-foreground-muted">{block.caption}</figcaption>
      ) : null}
    </figure>
  );
}
