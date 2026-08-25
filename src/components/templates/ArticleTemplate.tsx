import Link from "next/link";
import type { Content } from "@/content-types/types";
import { createClient } from "@/lib/supabase/server";
import { resolveBodyReferences } from "@/lib/content/resolve-body-references";
import { getContentByAuthor, getContentForSection, getRelatedContent } from "@/lib/content/queries";
import { formatContentDate } from "@/lib/content/format";
import { Hero } from "@/components/editorial/Hero";
import { ArticleCard } from "@/components/editorial/ArticleCard";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";

/**
 * Renders EDITOR_NOTE, ARTICLE, HEALTH_TIP, and (as a generic detail-view
 * fallback) BIRTHDAY content — see the registry's mapping notes. An async
 * Server Component: the content-type registry's `Template` contract is just
 * `{ content } -> JSX`, and this is the one Template with enough on the page
 * (body blocks, related stories, prev/next, the byline) to warrant its own
 * data fetching rather than the caller doing it all upfront.
 */
export async function ArticleTemplate({ content }: { content: Content }) {
  const supabase = await createClient();

  const [{ mediaMap, relatedContent }, sectionSiblings, related, moreByAuthor] = await Promise.all([
    resolveBodyReferences(supabase, content.body),
    content.sectionId ? getContentForSection(content.sectionId) : Promise.resolve([]),
    content.categoryId ? getRelatedContent(content.categoryId, content.id, 3) : Promise.resolve([]),
    content.authorId
      ? getContentByAuthor(content.authorId, { excludeContentId: content.id, limit: 3 })
      : Promise.resolve([]),
  ]);

  const siblingIndex = sectionSiblings.findIndex((item) => item.id === content.id);
  const previous = siblingIndex > 0 ? sectionSiblings[siblingIndex - 1] : null;
  const next =
    siblingIndex >= 0 && siblingIndex < sectionSiblings.length - 1 ? sectionSiblings[siblingIndex + 1] : null;

  return (
    <article>
      <Hero
        title={content.title}
        subtitle={content.subtitle}
        category={content.category}
        imageUrl={content.coverImageUrl}
        imageAlt={content.title}
        fallbackSeed={content.id}
        meta={
          <>
            {content.author && (
              <Link href={`/contributors/${content.author.slug}`} className="text-foreground hover:text-secondary-400">
                {content.author.name}
              </Link>
            )}
            {content.author && content.publishedAt ? " · " : null}
            {formatContentDate(content.publishedAt)}
          </>
        }
      />

      <div className="mx-auto max-w-2xl px-gutter pb-section-md">
        <div className="space-y-6 font-body text-lg leading-relaxed text-foreground [&_blockquote]:border-l-2 [&_blockquote]:border-primary-400 [&_blockquote]:pl-6 [&_blockquote]:italic [&_h2]:font-display [&_h2]:text-2xl [&_h3]:font-display [&_h3]:text-xl">
          <BlockRenderer blocks={content.body.blocks} mediaMap={mediaMap} relatedContent={relatedContent} />
        </div>

        {moreByAuthor.length > 0 && content.author && (
          <div className="mt-16 border-t border-border pt-8">
            <p className="mb-4 font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">
              More from {content.author.name}
            </p>
            <div className="space-y-1">
              {moreByAuthor.map((item) => (
                <ArticleCard
                  key={item.id}
                  content={item}
                  variant="compact"
                  sizes="(min-width: 1024px) 672px, 100vw"
                />
              ))}
            </div>
          </div>
        )}

        {(previous || next) && (
          <nav className="mt-16 flex items-start justify-between gap-8 border-t border-border pt-8 font-body text-sm">
            {previous ? (
              <Link href={previous.href ?? "#"} className="text-foreground-muted hover:text-foreground">
                ← {previous.title}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={next.href ?? "#"} className="text-right text-foreground-muted hover:text-foreground">
                {next.title} →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>

      {related.length > 0 && (
        <section className="mx-auto max-w-6xl px-gutter py-section-md">
          <h2 className="mb-10 border-b border-border pb-4 font-body text-sm font-medium tracking-wide text-foreground-muted uppercase">
            Related Stories
          </h2>
          <div className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-3">
            {related.map((item) => (
              <ArticleCard key={item.id} content={item} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
