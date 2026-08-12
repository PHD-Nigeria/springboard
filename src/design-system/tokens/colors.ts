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
  accent: scale("accent"),
  neutral: {
    ...scale("neutral"),
    0: "var(--color-neutral-0)",
    950: "var(--color-neutral-950)",
  },
  feedback: {
    info: "var(--color-info)",
    warning: "var(--color-warning)",
    success: "var(--color-success)",
    danger: "var(--color-danger)",
  },
} as const;
