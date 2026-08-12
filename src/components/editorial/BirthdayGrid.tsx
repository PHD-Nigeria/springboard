import type { Content } from "@/content-types/types";
import { StaffProfile } from "./StaffProfile";

/** Placeholder — renders a section's worth of BIRTHDAY content as a grid. */
export function BirthdayGrid({ items }: { items: Content[] }) {
  return (
    <div>
      {items.map((item) => (
        <StaffProfile key={item.id} content={item} />
      ))}
    </div>
  );
}
