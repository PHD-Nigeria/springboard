import type { Metadata } from "next";
import { CategoryLanding } from "@/components/editorial/CategoryLanding";

export const metadata: Metadata = {
  title: "Company News",
  description: "Company achievements, awards, and business announcements from PHD Nigeria.",
};

export default function CompanyNewsPage() {
  return (
    <CategoryLanding
      slug="company-news"
      eyebrow="Company & Business"
      fallbackDescription="Company achievements, awards, and business announcements from PHD Nigeria."
    />
  );
}
