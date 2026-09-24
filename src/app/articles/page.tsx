import type { Metadata } from "next";
import { CategoryLanding } from "@/components/editorial/CategoryLanding";

export const metadata: Metadata = {
  title: "Articles",
  description: "Thought leadership and industry analysis from PHD Nigeria's team.",
};

export default function ArticlesPage() {
  return (
    <CategoryLanding
      slug="articles"
      eyebrow="Company & Business"
      fallbackDescription="Thought leadership and industry analysis from PHD Nigeria's team."
    />
  );
}
