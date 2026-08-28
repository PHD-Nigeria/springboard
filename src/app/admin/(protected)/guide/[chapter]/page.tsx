import type { Metadata } from "next";
import { getGuideChapter, listGuideChapterSlugs } from "@/lib/guide/content";
import { renderGuideMarkdown } from "@/lib/guide/markdown";
import { GuideArticle } from "@/components/guide/GuideArticle";
import { GuideChapterNav } from "@/components/guide/GuideChapterNav";

type ChapterPageParams = { chapter: string };

// The parent (protected) layout reads cookies on every request (to check
// the signed-in session), which makes this whole route render dynamically
// regardless — so this isn't a static-HTML optimization. What it does buy:
// dynamicParams: false makes an unrecognized /admin/guide/<slug> 404 at the
// routing layer itself, without ever calling getGuideChapter, and the
// param list stays a single source of truth (docs/user-guide/'s own
// contents) rather than a hardcoded slug enum.
export async function generateStaticParams(): Promise<ChapterPageParams[]> {
  const slugs = await listGuideChapterSlugs();
  return slugs.map((chapter) => ({ chapter }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<ChapterPageParams> }): Promise<Metadata> {
  const { chapter } = await params;
  const { title } = await getGuideChapter(chapter);
  return { title };
}

/** /admin/guide/[chapter] — one rendered chapter from docs/user-guide/. */
export default async function GuideChapterPage({ params }: { params: Promise<ChapterPageParams> }) {
  const { chapter } = await params;
  const { markdown, prev, next } = await getGuideChapter(chapter);
  const html = renderGuideMarkdown(markdown);

  return (
    <>
      <GuideArticle html={html} />
      <GuideChapterNav prev={prev} next={next} />
    </>
  );
}
