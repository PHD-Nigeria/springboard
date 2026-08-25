import Image from "next/image";
import Link from "next/link";
import type { Content } from "@/content-types/types";
import { getTaxonomyColorClass } from "@/design-system/tokens/colors";
import { formatContentDate } from "@/lib/content/format";
import { MediaFallback } from "@/components/editorial/MediaFallback";

interface FeaturedStoryProps {
  content: Content;
  /** Override when the caller doesn't render this inside the homepage's 2-column [1fr_360px] layout (e.g. EditorialSection renders it full-width). */
  sizes?: string;
  /**
   * Only the page's true above-the-fold lead image should eagerly load.
   * Defaults to true for the homepage's direct usage (always the actual
   * hero); a page rendering more than one FeaturedStory (e.g. the
   * publication page looping every section) must pass false for every
   * instance after the first, or every section's image competes for
   * bandwidth on load and works against, not for, real LCP.
   */
  priority?: boolean;
}

/**
 * The large lead treatment: an EditorialSection gives its first item this,
 * regardless of content_type — chosen by section layout, not by type, so it
 * takes a `content` prop rather than being part of the content-type
 * registry. Also used directly for the homepage's featured area.
 */
export function FeaturedStory({
  content,
  sizes = "(min-width: 1024px) 60vw, 100vw",
  priority = true,
}: FeaturedStoryProps) {
  return (
    <Link href={content.href ?? "#"} className="group block">
      <div className="relative mb-6 aspect-[16/10] overflow-hidden bg-surface">
        {content.coverImageUrl ? (
          <Image
            src={content.coverImageUrl}
            alt={content.title}
            fill
            priority={priority}
            sizes={sizes}
            className="object-cover transition-transform duration-slow ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <MediaFallback seed={content.id} />
        )}
      </div>

      {content.category && (
        <p
          className={`mb-3 font-body text-xs font-medium tracking-wide uppercase ${getTaxonomyColorClass(content.category.slug)}`}
        >
          {content.category.name}
        </p>
      )}

      <h2 className="max-w-3xl font-display text-5xl leading-tight font-medium text-foreground transition-colors duration-fast group-hover:text-secondary-400 md:text-6xl">
        {content.title}
      </h2>

      {content.summary && (
        <p className="mt-5 max-w-2xl font-body text-lg leading-relaxed text-foreground-muted">
          {content.summary}
        </p>
      )}

      {(content.author || content.publishedAt) && (
        <p className="mt-4 font-body text-sm text-foreground-muted">
          {content.author?.name}
          {content.author && content.publishedAt ? " · " : ""}
          {formatContentDate(content.publishedAt)}
        </p>
      )}
    </Link>
  );
}
