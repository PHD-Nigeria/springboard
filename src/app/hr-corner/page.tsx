import type { Metadata } from "next";
import { CategoryLanding } from "@/components/editorial/CategoryLanding";

export const metadata: Metadata = {
  title: "HR Corner",
  description: "HR communication and information for PHD Nigeria staff.",
};

export default function HrCornerPage() {
  return (
    <CategoryLanding
      slug="hr-corner"
      eyebrow="People & Culture"
      fallbackDescription="HR communication and information for PHD Nigeria staff."
    />
  );
}
