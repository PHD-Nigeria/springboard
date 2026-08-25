import type { CalloutBlock as CalloutBlockData } from "@/content-types/blocks";

const STYLE_CLASSES: Record<CalloutBlockData["style"], string> = {
  info: "border-info/50 bg-info/10",
  warning: "border-warning/50 bg-warning/10",
  success: "border-success/50 bg-success/10",
};

export function CalloutBlock({ block }: { block: CalloutBlockData }) {
  return (
    <div
      role="note"
      data-style={block.style}
      className={`rounded-md border px-6 py-4 font-body text-base leading-relaxed text-foreground ${STYLE_CLASSES[block.style]}`}
    >
      <p>{block.text}</p>
    </div>
  );
}
