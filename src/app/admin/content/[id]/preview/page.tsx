import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { getContentByIdForPreview } from "@/lib/content/queries";
import { getContentTypeConfig } from "@/content-types/registry";

/**
 * Deliberately outside the (protected) route group/layout: the whole point
 * of this route is to render exactly what the public page would (the real
 * ArticleTemplate/NewsTemplate, nothing else wrapping it) — nesting it
 * inside AdminNav's chrome would defeat that. Auth is still enforced here,
 * just directly rather than via the shared layout.
 */
export default async function ContentPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) redirect(`/admin/login`);

  const { id } = await params;
  const content = await getContentByIdForPreview(id);
  if (!content) notFound();

  const { Template } = getContentTypeConfig(content.contentType);

  return (
    <div>
      <div className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-secondary-400 bg-primary-900 px-6 py-3">
        <p className="font-body text-sm text-foreground">
          <span className="font-medium text-secondary-400">PREVIEW</span> — this content is{" "}
          <span className="font-medium">{content.status}</span>, not necessarily visible on the live site.
        </p>
        <Link href={`/admin/content/${content.id}`} className="font-body text-sm text-foreground-muted hover:text-secondary-400">
          Back to editor
        </Link>
      </div>
      <Template content={content} />
    </div>
  );
}
