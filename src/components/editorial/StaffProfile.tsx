import type { Content } from "@/content-types/types";

/**
 * Placeholder card for STAFF_SPOTLIGHT and BIRTHDAY content. A real
 * implementation resolves the linked `staff` row (via staff_spotlights or
 * content_staff) rather than just the content row shown here.
 */
export function StaffProfile({ content }: { content: Content }) {
  return (
    <div>
      <h3>{content.title}</h3>
    </div>
  );
}
