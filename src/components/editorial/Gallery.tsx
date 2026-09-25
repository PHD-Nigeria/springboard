import Image from "next/image";

interface GalleryImage {
  mediaId: string;
  url: string;
  alt?: string;
  caption?: string;
}

/**
 * Editorial image gallery for a GALLERY body block (e.g. the photos inside
 * "VST 2026" or "Photos of the Quarter"), a responsive masonry: CSS
 * multi-column layout, each image at its own real aspect ratio rather than
 * a uniform grid. Was a raw, unstyled stack of native `<img>` tags at full
 * source pixel size, which is what produced the reported "images have
 * inconsistent widths... consume too much vertical space... doesn't look
 * like a polished editorial publication."
 *
 * No uploaded image's real width/height is ever recorded (see Hero.tsx's
 * note, same constraint applies here), so this can't size each tile from a
 * known ratio up front. `width`/`height` below are a placeholder box next/
 * image needs to reserve initial space (preventing layout shift before the
 * image loads) and pick a source resolution, they are NOT enforced once
 * the real image loads: `h-auto` means the rendered height follows the
 * browser's own `aspect-ratio: auto` behavior for a loaded image, which
 * prefers the image's true natural ratio over the attribute hint the
 * moment it's available. Verified directly (not assumed): a 448x662
 * portrait and a 555x508 near-square photo run through this exact
 * `width={1200} height={900}` placeholder both rendered at their own real
 * proportions, not the placeholder's 4:3.
 */
export function Gallery({ images }: { images: GalleryImage[] }) {
  if (images.length === 0) return null;

  return (
    <div className="my-10 columns-1 gap-6 sm:columns-2">
      {images.map((image) => (
        <figure key={image.mediaId} className="mb-6 break-inside-avoid">
          <Image
            src={image.url}
            alt={image.alt ?? ""}
            width={1200}
            height={900}
            sizes="(min-width: 640px) 50vw, 100vw"
            className="h-auto w-full rounded-sm bg-surface"
          />
          {image.caption && (
            <figcaption className="mt-2 font-body text-sm text-foreground-muted">{image.caption}</figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
