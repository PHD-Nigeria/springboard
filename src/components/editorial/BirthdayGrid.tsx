import type { Content } from "@/content-types/types";
import { StaffProfile } from "./StaffProfile";

/** A section's worth of BIRTHDAY content as a grid, for a homepage/section context that wants several birthday cards together without the FeaturedStory/ArticleCard hero treatment CategoryLanding uses for /staff-news. */
export function BirthdayGrid({ items }: { items: Content[] }) {
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 md:grid-cols-4">
      {items.map((item) => (
        <StaffProfile key={item.id} content={item} />
      ))}
    </div>
  );
}
