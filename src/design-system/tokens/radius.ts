/**
 * Border radius tokens, defined in `./theme.css`. Prefer Tailwind utilities
 * (`rounded-lg`, `rounded-full`) in components.
 */

export const radius = {
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  full: "var(--radius-full)",
} as const;
