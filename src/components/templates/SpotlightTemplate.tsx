import type { Content } from "@/content-types/types";

/**
 * Placeholder — renders STAFF_SPOTLIGHT content. The real staff/Q&A data
 * comes from the staff_spotlights/spotlight_questions tables via
 * lib/content/queries.ts, not shown here yet. No visual design yet.
 */
export function SpotlightTemplate({ content }: { content: Content }) {
  return (
    <article>
      <h1>{content.title}</h1>
    </article>
  );
}
