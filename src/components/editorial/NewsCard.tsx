import Image from "next/image";
import Link from "next/link";
import type { Content } from "@/content-types/types";
import { getTaxonomyColorClass } from "@/design-system/tokens/colors";
import { formatContentDate } from "@/lib/content/format";
import { MediaFallback } from "@/components/editorial/MediaFallback";

/**
 * Lean list-row card for COMPANY_NEWS/EVENT/GALLERY — a small thumbnail and
 * type do the work, no excerpt. This is what the homepage's "Recent
 * Stories" rail renders, so it's deliberately terser than ArticleCard.
 */
export function NewsCard({ content }: { content: Content }) {
  return (
    <Link href={content.href ?? "#"} className="group flex items-start gap-5 py-5">
      <div className="relative aspect-square w-20 shrink-0 overflow-hidden bg-surface">
        {content.coverImageUrl ? (
          <Image
            src={content.coverImageUrl}
            alt={content.title}
            fill
            sizes="80px"
            className="object-cover transition-transform duration-base ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <MediaFallback seed={content.id} />
        )}
      </div>

      <div className="min-w-0">
        {content.category && (
          <p
            className={`mb-1.5 font-body text-xs font-medium tracking-wide uppercase ${getTaxonomyColorClass(content.category.slug)}`}
          >
            {content.category.name}
          </p>
        )}
        <h3 className="font-display text-base leading-snug font-medium text-foreground transition-colors duration-fast group-hover:text-secondary-400">
          {content.title}
        </h3>
        {content.publishedAt && (
          <p className="mt-1.5 font-body text-xs text-foreground-muted">
            {formatContentDate(content.publishedAt)}
          </p>
        )}
      </div>
    </Link>
  );
}
