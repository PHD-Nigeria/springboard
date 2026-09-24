import type { Metadata } from "next";
import { CategoryLanding } from "@/components/editorial/CategoryLanding";

export const metadata: Metadata = {
  title: "Photos of the Quarter",
  description: "Photos and galleries from PHD Nigeria events.",
};

export default function PhotosOfTheQuarterPage() {
  return (
    <CategoryLanding
      slug="photos-of-the-quarter"
      eyebrow="Engagement & Community"
      fallbackDescription="Photos and galleries from PHD Nigeria events."
    />
  );
}
