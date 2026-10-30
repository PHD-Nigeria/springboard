import Image from "next/image";
import Link from "next/link";
import type { ActiveEdition, EditionGallery } from "@/lib/content/queries";

/**
 * "Photos of the Quarter · 2026 Q3": the first photographs of the edition's published gallery. Every image is a public
 * Media Library image with the alt text the editors entered; nothing is a placeholder. The link opens the full gallery.
 */
export function PhotoBand({ edition, gallery }: { edition: ActiveEdition; gallery: EditionGallery }) {
  if (gallery.photos.length === 0) return null;
  return (
    <section aria-labelledby="photo-band-title" className="home-bg-deep">
      <div className="mx-auto max-w-6xl px-gutter py-section-md">
        <div className="mb-6 flex items-baseline justify-between gap-4 border-b border-white/25 pb-3">
          <h2 id="photo-band-title" className="font-display text-lg font-semibold tracking-wide text-white uppercase">
            <span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 bg-secondary-400 align-middle" />
            {gallery.title}
            {edition.code ? ` · ${edition.code}` : ""}
          </h2>
          {gallery.href && (
            <Link href={gallery.href} className="shrink-0 font-body text-sm font-medium text-secondary-400 underline-offset-2 hover:underline">
              View all {gallery.total} photos
            </Link>
          )}
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {gallery.photos.map((photo, index) => (
            <li key={photo.url} className="relative aspect-[4/5] overflow-hidden bg-primary-800">
              <Image src={photo.url} alt={photo.alt} fill sizes="(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw" className="object-cover" priority={false} loading={index < 4 ? "eager" : "lazy"} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
