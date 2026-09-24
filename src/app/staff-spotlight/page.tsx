import type { Metadata } from "next";
import { CategoryLanding } from "@/components/editorial/CategoryLanding";

export const metadata: Metadata = {
  title: "Staff Spotlight",
  description: "Employee profiles and interviews from across PHD Nigeria.",
};

export default function StaffSpotlightPage() {
  return (
    <CategoryLanding
      slug="staff-spotlight"
      eyebrow="People & Culture"
      fallbackDescription="Employee profiles and interviews from across PHD Nigeria."
    />
  );
}
