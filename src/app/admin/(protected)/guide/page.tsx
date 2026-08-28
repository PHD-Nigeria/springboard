import type { Metadata } from "next";
import { getGuideIndex } from "@/lib/guide/content";
import { renderGuideMarkdown } from "@/lib/guide/markdown";
import { GuideArticle } from "@/components/guide/GuideArticle";
import { GuideChapterNav } from "@/components/guide/GuideChapterNav";

export const metadata: Metadata = { title: "User Guide" };

/** /admin/guide — the guide's "Start Here" page, rendered from docs/user-guide/README.md. */
export default async function GuideIndexPage() {
  const index = await getGuideIndex();
  const html = renderGuideMarkdown(index.markdown);

  return (
    <>
      <GuideArticle html={html} />
      <GuideChapterNav prev={index.prev} next={index.next} />
    </>
  );
}
