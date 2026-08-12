import type { ParagraphBlock as ParagraphBlockData } from "@/content-types/blocks";

export function ParagraphBlock({ block }: { block: ParagraphBlockData }) {
  return <p>{block.text}</p>;
}
