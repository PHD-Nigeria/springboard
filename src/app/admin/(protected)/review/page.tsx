import Link from "next/link";
import { listContent } from "@/lib/admin/queries";
import { getAdminSession } from "@/lib/auth/session";
import { CONTENT_TYPE_LABELS } from "@/content-types/types";
import { AdminPageHeader, AdminEmptyState, AdminNotice } from "@/components/admin/ui";
import { ContentRowActions } from "@/components/admin/ContentRowActions";

const DAY_MS = 86_400_000;

function waiting(updatedAt: string): string {
  const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / DAY_MS);
  if (days <= 0) return "Today";
  return days === 1 ? "1 day" : `${days} days`;
}

/**
 * What must be true before Publish can succeed. Mirrors the server-side rule in
 * saveContentAction and setContentStatusAction (block content, except for staff
 * spotlights and birthdays; and an edition). The server remains the authority.
 */
function missingForPublish(row: { content_type: string; body: unknown; publication_id: string | null }): string[] {
  const missing: string[] = [];
  const blocks = (row.body as { blocks?: unknown } | null)?.blocks;
  const usesBlocks = row.content_type !== "STAFF_SPOTLIGHT" && row.content_type !== "BIRTHDAY";
  if (usesBlocks && (!Array.isArray(blocks) || blocks.length === 0)) missing.push("content");
  if (!row.publication_id) missing.push("an edition");
  return missing;
}

export default async function AdminReviewQueuePage() {
  const session = await getAdminSession();
  const isContributor = session?.role === "contributor";
  // RLS decides what is visible: editors and admins see every story in review, contributors only their own.
  const { rows, total } = await listContent({ status: "review", sort: "updated_asc", pageSize: 100 });

  return (
    <div>
      <AdminPageHeader
        title={isContributor ? "Submitted for review" : "Review queue"}
        description={
          isContributor
            ? "Your stories waiting for an editor. You can still edit them or return them to draft."
            : `${total} ${total === 1 ? "story is" : "stories are"} waiting. Oldest first.`
        }
      />
      <AdminNotice tone="info" className="mb-5">
        {isContributor
          ? "An editor will publish or schedule your story, or return it to you."
          : "To approve a story, publish it or schedule it from the editor. To ask for changes, return it to draft."}
      </AdminNotice>

      {rows.length === 0 ? (
        <AdminEmptyState title="Nothing is waiting for review">
          {isContributor ? "Stories you submit for review will appear here." : "Submitted stories will appear here."}
        </AdminEmptyState>
      ) : (
        <div className="border border-border bg-surface">
          <div className="hidden grid-cols-[minmax(0,1fr)_7rem_12rem_auto] gap-4 border-b border-border bg-surface-raised px-4 py-2 font-body text-xs font-semibold tracking-wide text-foreground-muted uppercase md:grid">
            <span>Story</span>
            <span>Waiting</span>
            <span>Ready to publish?</span>
            <span>Actions</span>
          </div>
          <ul>
            {rows.map((row) => {
              const missing = missingForPublish(row);
              const hasCover = Boolean(row.cover_media_id);
              return (
                <li key={row.id} className="grid grid-cols-1 items-start gap-x-4 gap-y-2 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_7rem_12rem_auto]">
                  <div className="min-w-0">
                    <Link href={`/admin/content/${row.id}`} className="block truncate font-body text-sm font-semibold text-foreground hover:text-primary-600 hover:underline">
                      {row.title}
                    </Link>
                    <p className="truncate font-body text-xs text-foreground-muted">
                      {CONTENT_TYPE_LABELS[row.content_type]} · {row.content_author?.name ?? "No author"} · {row.content_publication?.title ?? "No edition assigned"}
                    </p>
                  </div>
                  <span className="font-body text-sm text-foreground">
                    <span className="font-body text-xs text-foreground-muted md:hidden">Waiting </span>
                    {waiting(row.updated_at)}
                  </span>
                  <div className="font-body text-xs">
                    {missing.length === 0 ? (
                      <p className="font-semibold text-foreground">Ready</p>
                    ) : (
                      <p className="font-semibold text-foreground">Needs {missing.join(" and ")}</p>
                    )}
                    {!hasCover && <p className="text-foreground-muted">No cover image (optional)</p>}
                    {!row.summary && <p className="text-foreground-muted">No summary (optional)</p>}
                  </div>
                  <ContentRowActions
                    id={row.id}
                    status={row.status}
                    title={row.title}
                    compact
                    canPublish={!isContributor}
                    canDelete={false}
                    publishBlockedReason={missing.length > 0 ? `Open the story and add ${missing.join(" and ")} first.` : undefined}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
