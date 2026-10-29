import Link from "next/link";
import type { GuideEntry } from "@/lib/guide/content";

/** Previous/Next across the guide's linear reading order — Start Here, then every chapter in file order. Pure links; no client JS needed. */
export function GuideChapterNav({ prev, next }: { prev: GuideEntry | null; next: GuideEntry | null }) {
  if (!prev && !next) return null;

  return (
    <nav aria-label="Guide chapter navigation" className="mt-12 flex items-stretch justify-between gap-4 border-t border-border pt-6">
      {prev ? (
        <Link
          href={prev.href}
          className="group flex-1 border border-border p-4 text-left hover:border-primary-500"
        >
          <span className="font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">← Previous</span>
          <span className="mt-1 block font-body text-sm text-foreground group-hover:text-primary-600">{prev.title}</span>
        </Link>
      ) : (
        <span className="flex-1" />
      )}
      {next ? (
        <Link
          href={next.href}
          className="group flex-1 border border-border p-4 text-right hover:border-primary-500"
        >
          <span className="font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">Next →</span>
          <span className="mt-1 block font-body text-sm text-foreground group-hover:text-primary-600">{next.title}</span>
        </Link>
      ) : (
        <span className="flex-1" />
      )}
    </nav>
  );
}
