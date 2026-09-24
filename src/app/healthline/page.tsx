import type { Metadata } from "next";
import { CategoryLanding } from "@/components/editorial/CategoryLanding";

export const metadata: Metadata = {
  title: "Healthline",
  description: "Health, wellbeing, and employee wellness content.",
};

export default function HealthlinePage() {
  return (
    <CategoryLanding
      slug="healthline"
      eyebrow="People & Culture"
      fallbackDescription="Health, wellbeing, and employee wellness content."
    />
  );
}
