import type { Content } from "@/content-types/types";

/**
 * A story for the homepage's story lists: not a gallery (which has its own band) and not an item that exists only to hold
 * videos (the featured-video panel plays those). Everything else published stays a story.
 */
export function isEditorialStory(content: Pick<Content, "contentType" | "body">): boolean {
  if (content.contentType === "GALLERY") return false;
  const blocks = content.body.blocks;
  if (blocks.length > 0 && blocks.every((block) => block.type === "video")) return false;
  return true;
}

const QUARTER_MONTHS: Record<string, string> = { "1": "Jan–Mar", "2": "Apr–Jun", "3": "Jul–Sep", "4": "Oct–Dec" };

/** "2026 Q3" → "Jul–Sep"; anything else → null (the label is simply left out). */
export function quarterMonths(code: string | null | undefined): string | null {
  const match = /^\d{4} Q([1-4])$/.exec(code ?? "");
  return match ? QUARTER_MONTHS[match[1]] : null;
}

/** "2026-10-29T09:00:00Z" → "29 Oct" (Lagos time), for the news ticker. */
export function formatTickerDate(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });
}

/** "Thursday 29 October 2026" (Lagos time), for the utility bar. */
export function formatLongDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).replace(",", "");
}
