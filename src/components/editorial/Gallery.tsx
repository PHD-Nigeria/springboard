interface GalleryImage {
  mediaId: string;
  url: string;
  alt?: string;
  caption?: string;
}

/** Placeholder — renders an ordered set of images for a GALLERY content item. */
export function Gallery({ images }: { images: GalleryImage[] }) {
  return (
    <div>
      {images.map((image) => (
        // eslint-disable-next-line @next/next/no-img-element -- placeholder only, real implementation will use next/image
        <img key={image.mediaId} src={image.url} alt={image.alt ?? ""} />
      ))}
    </div>
  );
}
