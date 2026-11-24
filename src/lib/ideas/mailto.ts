/** Dependency-free so scripts/test-ideas.mjs can import it. */
export const IDEAS_SUBJECT = "Springboard – Suggestions & Ideas";

const EMAIL = /^[^\s@<>"',;:\\]+@[^\s@<>"',;:\\]+\.[^\s@<>"',;:\\]+$/;

/** A mailto: link for a validated address, or null if the address is missing or malformed (the button then stays disabled). */
export function buildIdeasMailto(email: string | null | undefined): string | null {
  const value = (email ?? "").trim();
  if (!value || value.length > 254 || !EMAIL.test(value)) return null;
  return `mailto:${value}?subject=${encodeURIComponent(IDEAS_SUBJECT)}`;
}
