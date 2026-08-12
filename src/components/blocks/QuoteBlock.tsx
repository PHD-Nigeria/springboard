import type { QuoteBlock as QuoteBlockData } from "@/content-types/blocks";

export function QuoteBlock({ block }: { block: QuoteBlockData }) {
  return (
    <blockquote>
      <p>{block.text}</p>
      {block.attribution ? <cite>{block.attribution}</cite> : null}
    </blockquote>
  );
}
