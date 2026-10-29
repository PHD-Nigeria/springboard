import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { getContentByIdForPreview } from "@/lib/content/queries";
import { collectMediaIds } from "@/lib/content/resolve-body-references";
import { createClient } from "@/lib/supabase/server";
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

  // Which images this draft uses are still PRIVATE? Those are shown here through short-lived signed links for
  // signed-in staff only, and will not appear on the public site until an administrator promotes them.
  const supabase = await createClient();
  const usedMediaIds = [...new Set([...(content.coverMediaId ? [content.coverMediaId] : []), ...collectMediaIds(content.body.blocks)])];
  const { data: privateMedia } = usedMediaIds.length
    ? await supabase.from("media").select("id, original_filename").eq("bucket", "private").in("id", usedMediaIds)
    : { data: [] };

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
      {privateMedia && privateMedia.length > 0 && (
        <div role="note" className="border-b border-coral bg-coral/10 px-6 py-3 font-body text-sm text-foreground">
          <p className="font-medium">
            {privateMedia.length === 1 ? "1 image in this draft is private" : `${privateMedia.length} images in this draft are private`} — visible
            only to signed-in staff.
          </p>
          <p className="mt-1 text-foreground-muted">
            They are shown here through short-lived links and will <strong>not</strong> appear on the public site until an administrator
            promotes them in the Media Library.{" "}
            {privateMedia.map((media) => (media.id === content.coverMediaId ? "Cover: " : "") + (media.original_filename ?? "untitled")).join(" · ")}
          </p>
        </div>
      )}
      <Template content={content} />
    </div>
  );
}
