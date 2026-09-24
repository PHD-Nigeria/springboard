import type { Metadata } from "next";
import { CategoryLanding } from "@/components/editorial/CategoryLanding";

export const metadata: Metadata = {
  title: "Games",
  description: "Puzzles and interactive employee engagement content.",
};

export default function GamesPage() {
  return (
    <CategoryLanding
      slug="games"
      eyebrow="Engagement & Community"
      fallbackDescription="Puzzles and interactive employee engagement content."
    />
  );
}
