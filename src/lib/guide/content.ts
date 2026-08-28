import "server-only";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";

/**
 * Reads the approved Springboard User Guide straight from
 * docs/user-guide/ — that directory is the single source of truth (see its
 * own README), so nothing here re-types chapter titles, order, or content:
 * order comes from each file's numeric filename prefix, and titles come
 * from each file's own "# Heading" line. Renaming a chapter in the
 * Markdown is the only thing needed to rename it in the app.
 */
const GUIDE_DIR = path.join(process.cwd(), "docs", "user-guide");
const CHAPTER_FILE_RE = /^(\d{2}-[a-z0-9-]+)\.md$/;

export interface GuideEntry {
  /** null for the guide's index/"Start Here" page (docs/user-guide/README.md). */
  slug: string | null;
  title: string;
  href: string;
}

export interface GuideChapter extends GuideEntry {
  markdown: string;
  prev: GuideEntry | null;
  next: GuideEntry | null;
}

function extractTitle(markdown: string, fallback: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

// Chapter list/titles are re-read per request in dev (so editing a .md file
// is reflected immediately) but the module-level cache keeps a production
// build — where the files never change after deploy — from re-reading the
// directory on every request once it's warm.
let cachedEntries: GuideEntry[] | null = null;

/**
 * The full, linear reading order: the guide's index page first, then every
 * numbered chapter — this is what both the sidebar and the Previous/Next
 * links are built from, so they can never disagree with each other.
 */
async function listGuideEntries(): Promise<GuideEntry[]> {
  if (cachedEntries && process.env.NODE_ENV === "production") return cachedEntries;

  const indexRaw = await readFile(path.join(GUIDE_DIR, "README.md"), "utf8");
  const entries: GuideEntry[] = [{ slug: null, title: extractTitle(indexRaw, "Springboard User Guide"), href: "/admin/guide" }];

  const files = (await readdir(GUIDE_DIR)).filter((file) => CHAPTER_FILE_RE.test(file)).sort();
  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const raw = await readFile(path.join(GUIDE_DIR, file), "utf8");
    entries.push({ slug, title: extractTitle(raw, slug), href: `/admin/guide/${slug}` });
  }

  cachedEntries = entries;
  return entries;
}

/** The sidebar's chapter list — every entry except the index page itself. */
export async function listGuideChapters(): Promise<GuideEntry[]> {
  const entries = await listGuideEntries();
  return entries.slice(1);
}

/** The exact set of valid chapter slugs, for generateStaticParams and slug validation alike. */
export async function listGuideChapterSlugs(): Promise<string[]> {
  const chapters = await listGuideChapters();
  return chapters
    .map((chapter) => chapter.slug)
    .filter((slug): slug is string => slug !== null);
}

export async function getGuideIndex(): Promise<GuideChapter> {
  const entries = await listGuideEntries();
  const markdown = await readFile(path.join(GUIDE_DIR, "README.md"), "utf8");
  return { ...entries[0], markdown, prev: null, next: entries[1] ?? null };
}

/**
 * A single chapter by slug, resolved only against the real directory
 * listing above — never by interpolating the URL param directly into a
 * file path — so a crafted `/admin/guide/../../whatever` route param can
 * never resolve outside docs/user-guide/.
 */
export async function getGuideChapter(slug: string): Promise<GuideChapter> {
  const entries = await listGuideEntries();
  const index = entries.findIndex((entry) => entry.slug === slug);
  if (index === -1) notFound();

  const markdown = await readFile(path.join(GUIDE_DIR, `${slug}.md`), "utf8");
  return {
    ...entries[index],
    markdown,
    prev: entries[index - 1] ?? null,
    next: entries[index + 1] ?? null,
  };
}
