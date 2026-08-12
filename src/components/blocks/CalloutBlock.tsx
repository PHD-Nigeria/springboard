import type { CalloutBlock as CalloutBlockData } from "@/content-types/blocks";

export function CalloutBlock({ block }: { block: CalloutBlockData }) {
  return (
    <div role="note" data-style={block.style}>
      <p>{block.text}</p>
    </div>
  );
}
