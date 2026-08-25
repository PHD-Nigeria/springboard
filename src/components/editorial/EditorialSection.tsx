import type { Content } from "@/content-types/types";
import { FeaturedStory } from "./FeaturedStory";
import { ArticleCard } from "./ArticleCard";

/**
 * Renders one publication section: its lead item gets the FeaturedStory
 * treatment, the rest render as ArticleCard in an editorial grid. Used by
 * the publication landing page (src/app/issues/[publicationSlug]/page.tsx),
 * once per section, so the section title carries real editorial weight
 * (font-display, not a small nav-style label) rather than reading as an
 * archive-page category header.
 *
 * Deliberately uses ArticleCard for every item here rather than dispatching
 * through the content-type registry's per-type Card (which would give a
 * mixed COMPANY_NEWS section NewsCard's flat list-row treatment) — NewsCard
 * is built to stretch full-width in a list, not sit inside a fixed-width
 * grid column, and doing so left large dead space beside every card. Same
 * fix already applied to the search results grid for the same reason.
 * ArticleCard doesn't read `content.contentType` at all, so this is safe
 * for any content type a section might contain.
 */
export function EditorialSection({
  title,
  items,
  priority = false,
}: {
  title: string;
  items: Content[];
  /** Pass true only for the page's first EditorialSection — see FeaturedStory's priority prop. */
  priority?: boolean;
}) {
  const [lead, ...rest] = items;
  if (!lead) return null;

  return (
    <section className="mx-auto max-w-6xl px-gutter py-section-md">
      <h2 className="mb-10 font-display text-3xl font-medium text-foreground md:text-4xl">{title}</h2>

      <FeaturedStory content={lead} sizes="(min-width: 1024px) 1152px, 100vw" priority={priority} />

      {rest.length > 0 && (
        <div className="mt-16">
          <h3 className="mb-10 border-b border-border pb-4 font-body text-sm font-medium tracking-wide text-foreground-muted uppercase">
            Recent Stories
          </h3>
          <div className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-3">
            {rest.map((item) => (
              <ArticleCard key={item.id} content={item} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
