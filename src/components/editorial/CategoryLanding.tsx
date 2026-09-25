import { notFound } from "next/navigation";
import type { Content } from "@/content-types/types";
import { getCategoryBySlug, getContentByCategoryId, getContentStaffBatch } from "@/lib/content/queries";
import { ArticleCard } from "@/components/editorial/ArticleCard";
import { FeaturedStory } from "@/components/editorial/FeaturedStory";
import { StaffProfile } from "@/components/editorial/StaffProfile";
import { getContentTypeConfig } from "@/content-types/registry";

/** STAFF_SPOTLIGHT/BIRTHDAY have no natural "lead story", a giant hero card for one person's birthday reads oddly next to a dozen peers. Those render as a uniform grid of their own registry Card (StaffProfile) instead of the FeaturedStory+ArticleCard treatment built for article-shaped content. */
const PEOPLE_GRID_TYPES = new Set(["STAFF_SPOTLIGHT", "BIRTHDAY"]);

/**
 * Shared landing page for every grouped-navigation destination (Company
 * News, Articles, HR Corner, Staff Spotlight, Staff News, Healthline,
 * Photos of the Quarter, Games), one category, one page. Each route under
 * src/app/ is a thin wrapper passing its own category slug + copy; this is
 * where the actual query and layout live, so the eight pages stay in sync
 * instead of drifting into eight slightly different implementations.
 *
 * Mirrors EditorialSection's lead-story-plus-grid shape (used by the
 * publication page) rather than reusing that component directly, this
 * page needs its own hero/eyebrow header (matching search/page.tsx's
 * pattern) above the content, which EditorialSection doesn't provide.
 */
/**
 * The grid for STAFF_SPOTLIGHT/BIRTHDAY category pages. Measured directly
 * against /staff-news in production before this existed: 17 BIRTHDAY cards,
 * each a StaffProfile independently calling getContentStaff, meant 17
 * separate content_staff round trips for one page load. Batches all of
 * them into the one getContentStaffBatch query above and hands each card
 * its already-resolved staff record, StaffProfile falls back to its own
 * per-item fetch (unchanged) for anything not in the map, which in
 * practice only ever means STAFF_SPOTLIGHT here, a type this app has never
 * shown more than one of on a single page, so batching it wouldn't have
 * measured a difference worth the extra code.
 */
async function PeopleGrid({ items }: { items: Content[] }) {
  const birthdayIds = items.filter((item) => item.contentType === "BIRTHDAY").map((item) => item.id);
  const staffByContentId = await getContentStaffBatch(birthdayIds);

  return (
    <div className="border-t border-border pt-10">
      <div className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => {
          if (item.contentType === "BIRTHDAY") {
            return <StaffProfile key={item.id} content={item} resolvedStaff={staffByContentId.get(item.id) ?? null} />;
          }
          const { Card } = getContentTypeConfig(item.contentType);
          return <Card key={item.id} content={item} />;
        })}
      </div>
    </div>
  );
}

export async function CategoryLanding({
  slug,
  eyebrow,
  fallbackDescription,
}: {
  /** Must match a categories.slug row seeded by the nav-hierarchy migration, a missing category is a configuration error, not a valid "empty" state, hence notFound() rather than an empty-state message. */
  slug: string;
  eyebrow: string;
  /** Shown only if the category has no description set in the CMS. */
  fallbackDescription: string;
}) {
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const items = await getContentByCategoryId(category.id, 30);
  const usesPeopleGrid = items.length > 0 && PEOPLE_GRID_TYPES.has(items[0].contentType);
  const [lead, ...rest] = usesPeopleGrid ? [] : items;

  return (
    <main>
      <section className="mx-auto max-w-6xl px-gutter pt-14 pb-section-md md:pt-20">
        <p className="mb-4 font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">{eyebrow}</p>
        <h1 className="max-w-3xl font-display text-5xl leading-[1.05] font-medium text-foreground md:text-7xl">
          {category.name}
        </h1>
        <p className="mt-6 max-w-xl font-body text-lg leading-relaxed text-foreground-muted">
          {category.description ?? fallbackDescription}
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-gutter pb-section-lg">
        {items.length === 0 && (
          <div className="max-w-xl border-t border-border pt-10">
            <p className="font-body text-sm text-foreground-muted">
              Nothing published here yet, this page is fully data-driven and will populate automatically once
              content tagged &ldquo;{category.name}&rdquo; is published.
            </p>
          </div>
        )}

        {usesPeopleGrid && items.length > 0 && (
          <PeopleGrid items={items} />
        )}

        {!usesPeopleGrid && lead && (
          <>
            <div className="border-t border-border pt-10">
              <FeaturedStory content={lead} sizes="(min-width: 1024px) 1152px, 100vw" priority />
            </div>

            {rest.length > 0 && (
              <div className="mt-16">
                <h2 className="mb-10 border-b border-border pb-4 font-body text-sm font-medium tracking-wide text-foreground-muted uppercase">
                  More
                </h2>
                <div className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-3">
                  {rest.map((item) => (
                    <ArticleCard key={item.id} content={item} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
