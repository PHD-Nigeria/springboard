import Image from "next/image";
import Link from "next/link";
import type { Content } from "@/content-types/types";
import type { ActiveEdition } from "@/lib/content/queries";
import { getTaxonomyColorClass } from "@/design-system/tokens/colors";
import { formatContentDate } from "@/lib/content/format";
import { MediaFallback } from "@/components/editorial/MediaFallback";

function Card({ content, lead, priority }: { content: Content; lead: boolean; priority: boolean }) {
  return (
    <Link href={content.href ?? "#"} className={`group flex flex-col border border-border bg-surface ${lead ? "md:col-span-2" : ""}`}>
      <div className={`relative overflow-hidden bg-surface-raised ${lead ? "aspect-[16/9]" : "aspect-[4/3]"}`}>
        {content.coverImageUrl ? (
          <Image
            src={content.coverImageUrl}
            alt=""
            fill
            priority={priority}
            sizes={lead ? "(min-width: 768px) 66vw, 100vw" : "(min-width: 768px) 33vw, 100vw"}
            className="object-cover object-[50%_25%] transition-transform duration-base ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <MediaFallback seed={content.id} />
        )}
      </div>
      <div className="flex flex-1 flex-col px-4 pt-3 pb-4">
        {content.category && (
          <p className={`mb-1.5 font-body text-xs font-medium tracking-wide uppercase ${getTaxonomyColorClass(content.category.slug)}`}>
            {content.category.name}
          </p>
        )}
        <h3 className={`font-display leading-snug font-semibold text-foreground group-hover:underline ${lead ? "text-2xl" : "text-lg"}`}>{content.title}</h3>
        {content.summary && <p className="mt-2 font-body text-sm leading-relaxed text-foreground-muted">{content.summary}</p>}
        <p className="mt-auto pt-3 font-body text-xs text-foreground-muted">
          {[content.author?.name, content.publishedAt ? formatContentDate(content.publishedAt) : null].filter(Boolean).join(" · ")}
        </p>
      </div>
    </Link>
  );
}

/** "From the 2026 Q3 edition": the active edition's real stories with their real covers. The first is the lead. */
export function EditionGrid({ edition, stories }: { edition: ActiveEdition; stories: Content[] }) {
  if (stories.length === 0) return null;
  return (
    <section aria-labelledby="edition-grid-title" className="mx-auto max-w-6xl px-gutter py-section-md">
      <div className="mb-6 flex items-baseline justify-between gap-4 border-b border-border pb-3">
        <h2 id="edition-grid-title" className="font-display text-lg font-semibold tracking-wide text-foreground uppercase">
          <span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 bg-primary-700 align-middle" />
          From the {edition.code ? `${edition.code} edition` : edition.title}
        </h2>
        <Link href={`/issues/${edition.slug}`} className="shrink-0 font-body text-sm font-medium text-primary-700 underline-offset-2 hover:underline">
          All {edition.code ?? edition.title} stories
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {stories.map((story, index) => (
          <Card key={story.id} content={story} lead={index === 0} priority={index === 0} />
        ))}
      </div>
    </section>
  );
}
