"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { restoreContentRevisionAction, type ContentRevisionRow } from "@/lib/admin/content-actions";
import { AdminButton } from "@/components/admin/ui";

/**
 * Minimum useful revision UI (§10 of the brief): list of prior saved
 * snapshots with editor + timestamp, and a Restore action. Not a diff
 * viewer — "what changed" here means "here's the whole prior version,"
 * matching the brief's explicit "do not immediately build a full Git-like
 * diff system."
 */
export function RevisionPanel({ contentId, revisions }: { contentId: string; revisions: ContentRevisionRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function restore(revisionId: string) {
    if (!window.confirm("Restore this revision? The current title/body/blocks will be replaced — this itself creates a new revision, so nothing is lost.")) {
      return;
    }
    startTransition(async () => {
      const result = await restoreContentRevisionAction(contentId, revisionId);
      if (result.error) {
        window.alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (revisions.length === 0) {
    return <p className="font-body text-sm text-foreground-muted">No prior revisions yet — one is saved every time this is edited.</p>;
  }

  return (
    <div className="border border-border">
      {revisions.map((revision) => {
        const isExpanded = expandedId === revision.id;
        const snapshotTitle = typeof revision.snapshot.title === "string" ? revision.snapshot.title : "(untitled)";
        return (
          <div key={revision.id} className="border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : revision.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-background"
            >
              <div className="min-w-0">
                <p className="truncate font-body text-sm text-foreground">Revision {revision.revision_number}</p>
                <p className="truncate font-body text-xs text-foreground-muted">
                  {revision.editor_name ?? "Unknown"} ·{" "}
                  {new Date(revision.created_at).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </button>
            {isExpanded && (
              <div className="border-t border-border bg-background px-4 py-3">
                <p className="mb-3 font-body text-sm text-foreground">{snapshotTitle}</p>
                <AdminButton type="button" variant="secondary" disabled={pending} onClick={() => restore(revision.id)}>
                  {pending ? "Restoring…" : "Restore this version"}
                </AdminButton>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
