import type { Content } from "@/content-types/types";
import { getContentTypeConfig } from "@/content-types/registry";
import { FeaturedStory } from "./FeaturedStory";

/**
 * Renders one publication section: its lead item gets the FeaturedStory
 * treatment, the rest render through the content-type registry's Card for
 * their type — a section can freely mix content types.
 */
export function EditorialSection({
  title,
  items,
}: {
  title: string;
  items: Content[];
}) {
  const [lead, ...rest] = items;

  return (
    <section>
      <h2>{title}</h2>
      {lead ? <FeaturedStory content={lead} /> : null}
      {rest.map((item) => {
        const { Card } = getContentTypeConfig(item.contentType);
        return <Card key={item.id} content={item} />;
      })}
    </section>
  );
}
