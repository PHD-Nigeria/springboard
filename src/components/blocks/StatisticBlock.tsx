import type { StatisticBlock as StatisticBlockData } from "@/content-types/blocks";

export function StatisticBlock({ block }: { block: StatisticBlockData }) {
  return (
    <div className="border-l-2 border-secondary-400 pl-6">
      <p className="font-display text-4xl font-medium text-foreground">{block.value}</p>
      <p className="mt-1 font-body text-sm font-medium tracking-wide text-foreground-muted uppercase">
        {block.label}
      </p>
      {block.description ? (
        <p className="mt-2 font-body text-sm leading-relaxed text-foreground-muted">{block.description}</p>
      ) : null}
    </div>
  );
}
