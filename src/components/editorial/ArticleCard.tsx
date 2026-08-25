import Image from "next/image";
import Link from "next/link";
import type { Content } from "@/content-types/types";
import { getTaxonomyColorClass } from "@/design-system/tokens/colors";
import { formatContentDate } from "@/lib/content/format";
import { MediaFallback } from "@/components/editorial/MediaFallback";

interface ArticleCardProps {
  content: Content;
  /** "standard" is the 3-column grid size; "compact" is for dense lists (e.g. a contributor's other articles). */
  variant?: "standard" | "compact";
  /**
   * Override the next/image `sizes` hint when a caller's real rendered
   * column width doesn't match the variant's default assumption (e.g. the
   * search results grid is 2-column, not 3) — affects which srcset entry
   * downloads, not layout, so this is a data-loading correction, not a
   * visual one.
   */
  sizes?: string;
}

/** Editorial card for ARTICLE/EDITOR_NOTE/HEALTH_TIP-style content. No rounded-card/shadow chrome — an image, a rule, and type do the work. */
export function ArticleCard({ content, variant = "standard", sizes }: ArticleCardProps) {
  const isCompact = variant === "compact";
  const defaultSizes = isCompact ? "(min-width: 1024px) 320px, 100vw" : "(min-width: 1024px) 33vw, 100vw";

  return (
    <Link href={content.href ?? "#"} className="group block">
      <div className={`relative mb-5 overflow-hidden bg-surface ${isCompact ? "aspect-[16/10]" : "aspect-[4/3]"}`}>
        {content.coverImageUrl ? (
          <Image
            src={content.coverImageUrl}
            alt={content.title}
            fill
            sizes={sizes ?? defaultSizes}
            className="object-cover transition-transform duration-base ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <MediaFallback seed={content.id} />
        )}
      </div>

      {content.category && (
        <p
          className={`mb-2 font-body text-xs font-medium tracking-wide uppercase ${getTaxonomyColorClass(content.category.slug)}`}
        >
          {content.category.name}
        </p>
      )}

      <h3
        className={`font-display font-medium text-foreground transition-colors duration-fast group-hover:text-secondary-400 ${isCompact ? "text-lg" : "text-2xl"}`}
      >
        {content.title}
      </h3>

      {!isCompact && content.summary && (
        <p className="mt-2 line-clamp-2 font-body text-sm leading-relaxed text-foreground-muted">
          {content.summary}
        </p>
      )}

      {(content.author || content.publishedAt) && (
        <p className="mt-3 font-body text-xs text-foreground-muted">
          {content.author?.name}
          {content.author && content.publishedAt ? " · " : ""}
          {formatContentDate(content.publishedAt)}
        </p>
      )}
    </Link>
  );
}
