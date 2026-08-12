import type { Content } from "@/content-types/types";

/** Placeholder card for ARTICLE/EDITOR_NOTE/HEALTH_TIP-style content. */
export function ArticleCard({ content }: { content: Content }) {
  return (
    <div>
      <h3>{content.title}</h3>
      {content.summary ? <p>{content.summary}</p> : null}
    </div>
  );
}
