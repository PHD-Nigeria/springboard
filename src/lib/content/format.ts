/** Formats a content row's publishedAt (or null) for editorial display, e.g. "12 Aug 2026". */
export function formatContentDate(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
