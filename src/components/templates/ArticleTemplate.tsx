import type { Content } from "@/content-types/types";

/**
 * Placeholder — renders EDITOR_NOTE, ARTICLE, HEALTH_TIP, and (as a generic
 * detail-view fallback) BIRTHDAY content. No visual design yet; this only
 * proves the content-type registry resolves to a real component.
 */
export function ArticleTemplate({ content }: { content: Content }) {
  return (
    <article>
      <h1>{content.title}</h1>
      {content.subtitle ? <p>{content.subtitle}</p> : null}
    </article>
  );
}
