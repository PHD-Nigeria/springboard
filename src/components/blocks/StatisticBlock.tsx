import type { StatisticBlock as StatisticBlockData } from "@/content-types/blocks";

export function StatisticBlock({ block }: { block: StatisticBlockData }) {
  return (
    <div>
      <strong>{block.value}</strong>
      <span>{block.label}</span>
      {block.description ? <p>{block.description}</p> : null}
    </div>
  );
}
