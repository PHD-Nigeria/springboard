import Link from "next/link";
import type { ActiveEdition } from "@/lib/content/queries";
import type { Content } from "@/content-types/types";
import { NewsCard } from "@/components/editorial/NewsCard";

/** The active edition: its code, period, counts, a link in, and its newest stories. Everything comes from CMS data. */
export function EditionPanel({ edition, stories }: { edition: ActiveEdition; stories: Content[] }) {
  return (
    <section aria-labelledby="edition-title" className="border border-border border-t-[3px] border-t-primary-500 bg-surface-raised">
      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center justify-between">
          <p className="font-body text-xs font-medium tracking-wide text-foreground uppercase">Latest edition</p>
          {edition.code && <span className="bg-secondary-400 px-2 py-0.5 font-body text-xs font-bold text-primary-900">{edition.code}</span>}
        </div>
        <h2 id="edition-title" className="mt-2 font-display text-2xl leading-tight font-semibold text-foreground">
          {edition.title}
        </h2>
        <p className="mt-1 font-body text-sm text-foreground-muted">
          {edition.storyCount} {edition.storyCount === 1 ? "item" : "items"}
          {edition.galleryCount > 0 && ` · ${edition.galleryCount} ${edition.galleryCount === 1 ? "gallery" : "galleries"}`}
          {` · ${edition.videoCount} ${edition.videoCount === 1 ? "video" : "videos"}`}
        </p>
        <Link
          href={`/issues/${edition.slug}`}
          className="mt-3 inline-block bg-secondary-400 px-3 py-2 font-body text-sm font-bold text-primary-900 hover:bg-secondary-300"
        >
          Open this edition →
        </Link>
      </div>
      {stories.length > 0 && (
        <div className="divide-y divide-border border-t border-border bg-surface px-4">
          {stories.map((item) => (
            <NewsCard key={item.id} content={item} />
          ))}
        </div>
      )}
    </section>
  );
}
