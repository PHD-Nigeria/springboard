import type { HeadingBlock as HeadingBlockData } from "@/content-types/blocks";

export function HeadingBlock({ block }: { block: HeadingBlockData }) {
  const Tag = `h${block.level}` as "h2" | "h3" | "h4";
  return <Tag>{block.text}</Tag>;
}
