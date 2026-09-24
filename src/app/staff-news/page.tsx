import type { Metadata } from "next";
import { CategoryLanding } from "@/components/editorial/CategoryLanding";

export const metadata: Metadata = {
  title: "Staff News",
  description: "Staff birthdays, announcements, and internal people news.",
};

export default function StaffNewsPage() {
  return (
    <CategoryLanding
      slug="staff-news"
      eyebrow="People & Culture"
      fallbackDescription="Staff birthdays, announcements, and internal people news."
    />
  );
}
