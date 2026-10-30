"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setContentStatusAction, deleteContentAction } from "@/lib/admin/content-actions";
import { AdminButton } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

type StatusTarget = "published" | "draft" | "archived";

type Pending =
  | { kind: "status"; target: StatusTarget; title: string; description: string; confirmLabel: string; destructive: boolean }
  | { kind: "delete" };

/**
 * Action set is deliberately different per status, matching the lifecycle
 * diagram in docs/architecture.md (§9 Editorial Admin): a status is either
 * being drafted, in review, live, or put away — the actions offered should
 * only ever be the ones that make sense from wherever the item currently is.
 *
 * These buttons only ever call the same status-set/delete Server Actions
 * that already exist — RLS (content_update_staff / content_update_own_draft
 * / content_delete_admin) is what actually enforces who can do what. A
 * refused action shows its reason inline; success is only reported after the
 * server action returned without an error.
 *
 * `compact` renders only the primary next action plus Edit (used by the review queue).
 */
export function ContentRowActions({
  id,
  status,
  title,
  compact = false,
  canPublish = true,
  canDelete = true,
  publishBlockedReason,
}: {
  id: string;
  status: string;
  title: string;
  compact?: boolean;
  /** Contributors cannot publish (RLS); hiding the button is usability only, the server action and RLS still decide. */
  canPublish?: boolean;
  /** Only administrators can delete (content_delete_admin); hidden for other roles so a button never promises what RLS will refuse. */
  canDelete?: boolean;
  /** When set, Publish is disabled and this reason is shown instead of letting the click fail. */
  publishBlockedReason?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<Pending | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const router = useRouter();

  function runStatus(next: StatusTarget, successText: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await setContentStatusAction(id, next);
      setConfirm(null);
      if (result?.error) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      setMessage({ tone: "success", text: successText });
      router.refresh();
    });
  }

  function runDelete() {
    setMessage(null);
    startTransition(async () => {
      const result = await deleteContentAction(id);
      setConfirm(null);
      if (result?.error) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      router.refresh();
    });
  }

  function ask(target: StatusTarget, copy: { title: string; description: string; confirmLabel: string }, destructive = false) {
    setConfirm({ kind: "status", target, destructive, ...copy });
  }

  const linkClass =
    "font-body text-sm text-primary-600 underline-offset-2 hover:underline focus-visible:underline";
  const edit = (
    <Link href={`/admin/content/${id}`} className={linkClass}>
      Edit<span className="sr-only">: {title}</span>
    </Link>
  );
  const preview = (
    <Link href={`/admin/content/${id}/preview`} className={linkClass}>
      Preview<span className="sr-only">: {title}</span>
    </Link>
  );

  let buttons: React.ReactNode;

  if (status === "archived") {
    buttons = (
      <>
        {preview}
        <AdminButton variant="secondary" disabled={isPending} onClick={() => runStatus("draft", "Restored to draft.")}>
          Restore
        </AdminButton>
        {canDelete && (
          <AdminButton variant="danger" disabled={isPending} onClick={() => setConfirm({ kind: "delete" })}>
            Delete
          </AdminButton>
        )}
      </>
    );
  } else if (status === "published") {
    buttons = (
      <>
        {edit}
        {!compact && preview}
        <AdminButton
          variant="secondary"
          disabled={isPending}
          onClick={() =>
            ask("draft", {
              title: "Unpublish this story?",
              description: `"${title}" will disappear from the public site and return to draft. You can publish it again later.`,
              confirmLabel: "Unpublish",
            })
          }
        >
          Unpublish
        </AdminButton>
        {!compact && (
          <AdminButton
            variant="secondary"
            disabled={isPending}
            onClick={() =>
              ask("archived", {
                title: "Archive this story?",
                description: `"${title}" will be removed from the public site and kept in the archive.`,
                confirmLabel: "Archive",
              })
            }
          >
            Archive
          </AdminButton>
        )}
      </>
    );
  } else if (status === "scheduled") {
    // Scheduled gets its own explicit action set — never shown as if it were already
    // published, and never offered a direct "Publish now" shortcut here.
    buttons = (
      <>
        {edit}
        {!compact && preview}
        <AdminButton
          variant="secondary"
          disabled={isPending}
          onClick={() =>
            ask("draft", {
              title: "Cancel the schedule?",
              description: `"${title}" will not publish automatically and will go back to draft.`,
              confirmLabel: "Cancel schedule",
            })
          }
        >
          Cancel schedule
        </AdminButton>
      </>
    );
  } else {
    // draft or review
    buttons = (
      <>
        {edit}
        {!compact && preview}
        {canPublish && (
          <AdminButton
            disabled={isPending || Boolean(publishBlockedReason)}
            aria-describedby={publishBlockedReason ? `blocked-${id}` : undefined}
            onClick={() =>
              ask("published", {
                title: "Publish this story now?",
                description: `"${title}" goes live on the public site immediately and becomes visible to everyone.`,
                confirmLabel: "Publish now",
              })
            }
          >
            Publish<span className="sr-only">: {title}</span>
          </AdminButton>
        )}
        {status === "review" && (
          <AdminButton
            variant="secondary"
            disabled={isPending}
            onClick={() =>
              ask("draft", {
                title: "Return to draft?",
                description: `"${title}" will leave the review queue and go back to draft so it can be changed.`,
                confirmLabel: "Return to draft",
              })
            }
          >
            Return to draft
          </AdminButton>
        )}
        {!compact && canDelete && (
          <AdminButton variant="danger" disabled={isPending} onClick={() => setConfirm({ kind: "delete" })}>
            Delete
          </AdminButton>
        )}
      </>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">{buttons}</div>
      {publishBlockedReason && (
        <p id={`blocked-${id}`} className="mt-1 font-body text-xs text-foreground-muted">
          {publishBlockedReason}
        </p>
      )}
      <div aria-live="polite" className="min-h-0">
        {message && (
          <p className={`mt-1 font-body text-xs ${message.tone === "error" ? "text-danger" : "text-foreground-muted"}`} role={message.tone === "error" ? "alert" : undefined}>
            {message.text}
          </p>
        )}
      </div>
      <ConfirmDialog
        open={confirm !== null}
        pending={isPending}
        destructive={confirm?.kind === "delete" ? true : confirm?.destructive}
        title={confirm?.kind === "delete" ? "Delete permanently?" : (confirm?.title ?? "")}
        description={
          confirm?.kind === "delete"
            ? `"${title}" will be deleted for good. This cannot be undone. (Only administrators can delete.)`
            : (confirm?.description ?? "")
        }
        confirmLabel={confirm?.kind === "delete" ? "Delete" : (confirm?.confirmLabel ?? "Confirm")}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === "delete") runDelete();
          else runStatus(confirm.target, confirm.target === "published" ? "Published." : confirm.title.includes("Unpublish") ? "Unpublished." : confirm.target === "archived" ? "Archived." : "Moved to draft.");
        }}
      />
    </div>
  );
}
