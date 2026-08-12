/**
 * JS/TS-side references to the typography tokens defined in `./theme.css`.
 * Prefer Tailwind utilities (`font-display`, `text-3xl`, `leading-relaxed`, ...)
 * in components; use these only where a plain string value is needed (e.g.
 * measuring text, or configuring a non-Tailwind renderer).
 */

export const typography = {
  fontFamily: {
    display: "var(--font-display)",
    body: "var(--font-body)",
    mono: "var(--font-mono)",
  },
  fontSize: {
    xs: "var(--text-xs)",
    sm: "var(--text-sm)",
    base: "var(--text-base)",
    lg: "var(--text-lg)",
    xl: "var(--text-xl)",
    "2xl": "var(--text-2xl)",
    "3xl": "var(--text-3xl)",
    "4xl": "var(--text-4xl)",
    "5xl": "var(--text-5xl)",
    "6xl": "var(--text-6xl)",
  },
  tracking: {
    tight: "var(--tracking-tight)",
    normal: "var(--tracking-normal)",
    wide: "var(--tracking-wide)",
  },
  leading: {
    tight: "var(--leading-tight)",
    snug: "var(--leading-snug)",
    normal: "var(--leading-normal)",
    relaxed: "var(--leading-relaxed)",
  },
} as const;
