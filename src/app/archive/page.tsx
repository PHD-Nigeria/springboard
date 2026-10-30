import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "@/components/home/home-theme.css";
import { getPublishedEditions } from "@/lib/content/queries";
import { MediaFallback } from "@/components/editorial/MediaFallback";

export const metadata: Metadata = { title: "Archive" };

/** Every published edition, newest first. Nothing here is typed in: titles, counts and covers all come from the CMS. */
export default async function ArchivePage() {
  const editions = await getPublishedEditions();

  return (
    <main className="home-theme bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-gutter py-section-md">
        <h1 className="mb-8 border-b border-border pb-4 font-display text-3xl font-semibold text-foreground">Archive</h1>
        {editions.length === 0 ? (
          <p className="py-section-md text-center font-body text-sm text-foreground-muted">No editions have been published yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {editions.map((edition) => (
              <li key={edition.id}>
                <Link href={`/issues/${edition.slug}`} className="group flex h-full flex-col border border-border border-t-[3px] border-t-primary-500 bg-surface">
                  <div className="relative aspect-[16/9] overflow-hidden bg-surface-raised">
                    {edition.coverImageUrl ? (
                      <Image src={edition.coverImageUrl} alt="" fill sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" className="object-cover" />
                    ) : (
                      <MediaFallback seed={edition.id} />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col px-4 pt-3 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">Edition</p>
                      {edition.code && <span className="bg-secondary-400 px-2 py-0.5 font-body text-xs font-bold text-primary-900">{edition.code}</span>}
                    </div>
                    <h2 className="mt-2 font-display text-xl leading-tight font-semibold text-foreground group-hover:underline">{edition.title}</h2>
                    {edition.subtitle && <p className="mt-1 font-body text-sm text-foreground-muted">{edition.subtitle}</p>}
                    <p className="mt-auto pt-3 font-body text-sm text-foreground-muted">
                      {edition.storyCount} {edition.storyCount === 1 ? "item" : "items"}
                      {edition.galleryCount > 0 && ` · ${edition.galleryCount} ${edition.galleryCount === 1 ? "gallery" : "galleries"}`}
                      {` · ${edition.videoCount} ${edition.videoCount === 1 ? "video" : "videos"}`}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
