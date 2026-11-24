import type { Metadata } from "next";
import "@/components/home/home-theme.css";
import { getGalleryGroups } from "@/lib/content/gallery-queries";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";

export const metadata: Metadata = { title: "Gallery", description: "Photographs from across PHD Nigeria, in one place." };

/** Every public photograph uploaded through the Media Library, automatically. Videos are kept separate and never appear here. */
export default async function GalleryPage() {
  const groups = await getGalleryGroups();
  return (
    <main className="home-theme bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-gutter py-section-md">
        <h1 className="mb-8 border-b border-border pb-4 font-display text-3xl font-semibold text-foreground">Gallery</h1>
        {groups.length === 0 ? (
          <p className="py-section-md text-center font-body text-sm text-foreground-muted">No photographs have been published yet.</p>
        ) : (
          <GalleryGrid groups={groups} />
        )}
      </div>
    </main>
  );
}
