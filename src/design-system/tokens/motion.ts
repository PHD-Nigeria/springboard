/**
 * Motion tokens for Framer Motion and other JS-driven animation.
 *
 * CSS transitions/animations should reference the `--duration-*`/`--ease-*`
 * custom properties in `./theme.css` directly. Framer Motion needs numeric
 * seconds and cubic-bezier arrays rather than CSS strings, so the values below
 * are hand-kept in sync with theme.css — if you change one, change the other.
 */

export const duration = {
  fast: 0.15,
  base: 0.3,
  slow: 0.5,
  page: 0.65,
  hero: 1.5,
  scrollReveal: 0.8,
  contributorReveal: 4.5,
} as const;

export const easing = {
  standard: [0.4, 0, 0.2, 1],
  emphasized: [0.2, 0, 0, 1],
  editorialIn: [0.16, 1, 0.3, 1],
} as const;

export const motion = { duration, easing } as const;
