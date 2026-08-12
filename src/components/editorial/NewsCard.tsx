import type { Content } from "@/content-types/types";

/** Placeholder card for COMPANY_NEWS/EVENT/GALLERY-style content. */
export function NewsCard({ content }: { content: Content }) {
  return (
    <div>
      <h3>{content.title}</h3>
    </div>
  );
}
