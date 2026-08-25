/**
 * Branded placeholder for a missing image — a PHD-color gradient panel, not
 * a large random solid rectangle and not a recreation of the PHD logo (no
 * text/wordmark is drawn). The gradient pair is picked deterministically
 * from `seed` (same hash pattern as `getTaxonomyColorClass`), so a given
 * piece of content always renders the same fallback rather than flickering
 * between renders.
 *
 * Renders as an absolutely-positioned fill (`inset-0`), matching how
 * `next/image fill` is used everywhere this replaces — callers keep the
 * same fixed-aspect-ratio container in both the image and fallback case, so
 * there is no layout shift either way.
 */
const GRADIENT_PAIRS: [string, string][] = [
  ["var(--color-primary-500)", "var(--color-neutral-950)"],
  ["var(--color-coral)", "var(--color-primary-700)"],
  ["var(--color-secondary-400)", "var(--color-neutral-950)"],
  ["var(--color-lavender)", "var(--color-primary-700)"],
  ["var(--color-pink)", "var(--color-primary-700)"],
  ["var(--color-coral)", "var(--color-neutral-950)"],
  ["var(--color-lavender)", "var(--color-neutral-950)"],
  ["var(--color-pink)", "var(--color-neutral-950)"],
];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

interface MediaFallbackProps {
  seed: string;
  /** Large centered initials (e.g. contributor initials) — an identity mark, not a logo recreation. Omit for cards/covers. */
  initials?: string;
  className?: string;
}

export function MediaFallback({ seed, initials, className = "" }: MediaFallbackProps) {
  const [from, to] = GRADIENT_PAIRS[hashSeed(seed) % GRADIENT_PAIRS.length];

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 flex items-center justify-center ${className}`}
      style={{
        backgroundImage: `radial-gradient(130% 130% at 12% 12%, ${from} 0%, transparent 55%), linear-gradient(135deg, ${from}, ${to})`,
      }}
    >
      {initials && (
        <span className="font-display text-4xl font-medium tracking-wide text-foreground/40 select-none">
          {initials}
        </span>
      )}
    </div>
  );
}

/** First letter of up to the first two words — "Ada Nwosu" -> "AN". */
export function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
