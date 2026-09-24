import type { Content } from "@/content-types/types";
import { getSpotlightDetail } from "@/lib/content/queries";
import { Hero } from "@/components/editorial/Hero";

/**
 * Renders STAFF_SPOTLIGHT content, the person's photo/name/title as the
 * masthead (via Hero, same component ArticleTemplate uses, so a spotlight
 * reads as part of the same editorial system), then their Q&A as a simple
 * question/answer list. No BlockRenderer body here: a spotlight's real
 * content is the Q&A pairs (staff_spotlights/spotlight_questions), not a
 * written block document, see each table's migration comment.
 */
export async function SpotlightTemplate({ content }: { content: Content }) {
  const detail = await getSpotlightDetail(content.id);

  return (
    <article>
      <Hero
        title={detail?.staff.fullName ?? content.title}
        subtitle={content.title !== detail?.staff.fullName ? content.title : content.subtitle}
        category={content.category}
        imageUrl={detail?.staff.photoUrl ?? content.coverImageUrl}
        imageAlt={detail?.staff.fullName ?? content.title}
        fallbackSeed={content.id}
        meta={detail?.staff.title}
      />

      <div className="mx-auto max-w-2xl px-gutter pb-section-lg">
        {detail && detail.questions.length > 0 ? (
          <dl className="space-y-10">
            {detail.questions.map((qa) => (
              <div key={qa.id} className="border-t border-border pt-6">
                <dt className="font-display text-xl font-medium text-foreground">{qa.question}</dt>
                <dd className="mt-3 font-body text-lg leading-relaxed text-foreground-muted">{qa.answer}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="font-body text-sm text-foreground-muted">No questions added yet.</p>
        )}
      </div>
    </article>
  );
}
