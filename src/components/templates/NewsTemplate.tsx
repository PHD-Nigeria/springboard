import type { Content } from "@/content-types/types";

/**
 * Placeholder — renders COMPANY_NEWS and (until a dedicated EventTemplate is
 * designed) EVENT content. No visual design yet.
 */
export function NewsTemplate({ content }: { content: Content }) {
  return (
    <article>
      <h1>{content.title}</h1>
      {content.summary ? <p>{content.summary}</p> : null}
    </article>
  );
}
