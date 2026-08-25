import type { Content } from "@/content-types/types";
import { resolveBodyReferences } from "@/lib/content/resolve-body-references";
import { getNewsBites } from "@/lib/content/queries";
import { createClient } from "@/lib/supabase/server";
import { formatContentDate } from "@/lib/content/format";
import { Hero } from "@/components/editorial/Hero";
import { NewsCard } from "@/components/editorial/NewsCard";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";

/**
 * Renders COMPANY_NEWS content (and, until a dedicated EventTemplate is
 * designed, EVENT). Deliberately terser than ArticleTemplate — no
 * related-by-category rail or prev/next — but shares the same Hero/
 * BlockRenderer building blocks, so a News Bite reads as a real editorial
 * page rather than a bare title-and-summary stub.
 */
export async function NewsTemplate({ content }: { content: Content }) {
  const supabase = await createClient();

  const [{ mediaMap, relatedContent }, moreNews] = await Promise.all([
    resolveBodyReferences(supabase, content.body),
    getNewsBites(3, { excludeContentId: content.id }),
  ]);

  return (
    <article>
      <Hero
        title={content.title}
        subtitle={content.subtitle}
        category={content.category}
        imageUrl={content.coverImageUrl}
        imageAlt={content.title}
        fallbackSeed={content.id}
        meta={<>{formatContentDate(content.publishedAt)}</>}
      />

      <div className="mx-auto max-w-2xl px-gutter pb-section-md">
        <div className="space-y-6 font-body text-lg leading-relaxed text-foreground [&_blockquote]:border-l-2 [&_blockquote]:border-primary-400 [&_blockquote]:pl-6 [&_blockquote]:italic [&_h2]:font-display [&_h2]:text-2xl [&_h3]:font-display [&_h3]:text-xl">
          <BlockRenderer blocks={content.body.blocks} mediaMap={mediaMap} relatedContent={relatedContent} />
        </div>
      </div>

      {moreNews.length > 0 && (
        <section className="mx-auto max-w-3xl px-gutter py-section-md">
          <h2 className="mb-2 border-b border-border pb-4 font-body text-sm font-medium tracking-wide text-foreground-muted uppercase">
            More News
          </h2>
          <div className="divide-y divide-border">
            {moreNews.map((item) => (
              <NewsCard key={item.id} content={item} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
