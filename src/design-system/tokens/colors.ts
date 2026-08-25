/**
 * JS/TS-side references to the color tokens defined in `./theme.css`.
 *
 * Components should reach for Tailwind utility classes (e.g. `bg-primary-500`)
 * generated from `@theme` first. Use these `var(...)` references only where a
 * plain CSS color string is required outside of className context — inline
 * styles, SVG `fill`/`stroke`, canvas, or values handed to a charting library.
 *
 * Values live in theme.css; this file must never hardcode a hex/oklch value.
 */

const scale = (name: string) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((step) => [
      step,
      `var(--color-${name}-${step})`,
    ])
  ) as Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>;

export const colors = {
  primary: scale("primary"),
  secondary: scale("secondary"),
  /** Single canonical values, not scales — see theme.css for why. */
  coral: "var(--color-coral)",
  lavender: "var(--color-lavender)",
  pink: "var(--color-pink)",
  neutral: {
    ...scale("neutral"),
    0: "var(--color-neutral-0)",
    950: "var(--color-neutral-950)",
  },
  surface: {
    background: "var(--color-background)",
    surface: "var(--color-surface)",
    surfaceRaised: "var(--color-surface-raised)",
    foreground: "var(--color-foreground)",
    foregroundMuted: "var(--color-foreground-muted)",
    border: "var(--color-border)",
    borderStrong: "var(--color-border-strong)",
  },
  feedback: {
    info: "var(--color-info)",
    warning: "var(--color-warning)",
    success: "var(--color-success)",
    danger: "var(--color-danger)",
  },
} as const;

/**
 * The 5 PHD brand colors (defined in theme.css as --color-taxonomy-1..5),
 * assigned deterministically by category slug so the same category always
 * renders the same color without a lookup table to maintain — categories
 * are open `categories` table rows, not a fixed enum, so there's no fixed
 * mapping to hardcode. Returns a Tailwind class pair (text + border) rather
 * than a raw color, since that's how taxonomy labels are actually rendered.
 */
const TAXONOMY_SWATCH_COUNT = 5;

const TAXONOMY_CLASSES = [
  "text-taxonomy-1 border-taxonomy-1",
  "text-taxonomy-2 border-taxonomy-2",
  "text-taxonomy-3 border-taxonomy-3",
  "text-taxonomy-4 border-taxonomy-4",
  "text-taxonomy-5 border-taxonomy-5",
] as const;

export function getTaxonomyColorClass(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return TAXONOMY_CLASSES[hash % TAXONOMY_SWATCH_COUNT];
}
