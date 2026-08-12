import type { Content } from "@/content-types/types";

/**
 * Placeholder — the large lead treatment an EditorialSection gives its first
 * item, regardless of content_type. Not part of the content-type registry;
 * chosen by section layout, not by type.
 */
export function FeaturedStory({ content }: { content: Content }) {
  return (
    <div>
      <h2>{content.title}</h2>
      {content.summary ? <p>{content.summary}</p> : null}
    </div>
  );
}
