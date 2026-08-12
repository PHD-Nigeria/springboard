/**
 * Semantic spacing aliases layered on top of Tailwind's default spacing scale.
 * Defined in `./theme.css`; use Tailwind utilities (`p-gutter`, `py-section-md`)
 * in components rather than these raw references where possible.
 */

export const spacing = {
  gutter: "var(--spacing-gutter)",
  section: {
    sm: "var(--spacing-section-sm)",
    md: "var(--spacing-section-md)",
    lg: "var(--spacing-section-lg)",
  },
} as const;
