import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getGuideIndex, listGuideChapters, type GuideEntry } from "@/lib/guide/content";

const GUIDE_DIR = path.join(process.cwd(), "docs", "user-guide");

export interface GuideSearchDocument {
  href: string;
  title: string;
  /** Stripped-of-Markdown plain text, for a simple client-side substring search — see GuideSearch.tsx. */
  text: string;
}

/**
 * Rough Markdown-to-plain-text stripping — good enough for matching search
 * terms and building a short snippet, not meant to be a faithful render
 * (the actual page already renders the real thing via renderGuideMarkdown).
 */
function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function toSearchDocument(entry: GuideEntry): Promise<GuideSearchDocument> {
  const raw = await readFile(path.join(GUIDE_DIR, `${entry.slug ?? "README"}.md`), "utf8");
  return { href: entry.href, title: entry.title, text: toPlainText(raw) };
}

/**
 * The guide's entire (small — eleven documents) corpus as plain text, for
 * the sidebar's client-side search. No database, no external service:
 * built once per request from the same Markdown files the pages
 * themselves render, then filtered client-side in GuideSearch.tsx.
 */
export async function buildGuideSearchIndex(): Promise<GuideSearchDocument[]> {
  const [index, chapters] = await Promise.all([getGuideIndex(), listGuideChapters()]);
  return Promise.all([toSearchDocument(index), ...chapters.map((chapter) => toSearchDocument(chapter))]);
}
