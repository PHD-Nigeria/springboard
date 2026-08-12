import type { GalleryBlock as GalleryBlockData } from "@/content-types/blocks";
import { Gallery } from "@/components/editorial/Gallery";

interface ResolvedMedia {
  url: string;
  alt?: string;
  caption?: string;
}

export function GalleryBlock({
  block,
  mediaMap,
}: {
  block: GalleryBlockData;
  mediaMap: Record<string, ResolvedMedia>;
}) {
  const images = block.mediaIds
    .map((mediaId) => {
      const media = mediaMap[mediaId];
      return media ? { mediaId, ...media } : null;
    })
    .filter((image): image is NonNullable<typeof image> => image !== null);

  return <Gallery images={images} />;
}
