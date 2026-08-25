"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setContentStatusAction, deleteContentAction } from "@/lib/admin/content-actions";
import { AdminButton } from "@/components/admin/ui";

/**
 * Action set is deliberately different per status, matching the lifecycle
 * diagram in docs/architecture.md (§9 Editorial Admin): a status is either
 * being drafted, live, or put away — the actions offered should only ever
 * be the ones that make sense from wherever the item currently is.
 *
 * These buttons only ever call the same status-set/delete Server Actions
 * that already exist — RLS (content_update_staff / content_update_own_draft
 * / content_delete_admin) is what actually enforces who can do what; a
 * contributor seeing a button here that RLS will reject still gets a clear
 * error, not a silent no-op (see setContentStatusAction's permission check).
 */
export function ContentRowActions({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function runStatus(next: "published" | "draft" | "archived") {
    startTransition(async () => {
      const result = await setContentStatusAction(id, next);
      if (result?.error) window.alert(result.error);
      router.refresh();
    });
  }

  function runDelete() {
    if (!window.confirm("Delete this content permanently? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await deleteContentAction(id);
      if (result?.error) window.alert(result.error);
      router.refresh();
    });
  }

  const linkClass = "font-body text-sm text-foreground-muted transition-colors duration-fast hover:text-secondary-400";

  if (status === "archived") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/admin/content/${id}/preview`} className={linkClass}>
          Preview
        </Link>
        <AdminButton variant="secondary" disabled={pending} onClick={() => runStatus("draft")}>
          Restore
        </AdminButton>
        <AdminButton variant="danger" disabled={pending} onClick={runDelete}>
          Delete
        </AdminButton>
      </div>
    );
  }

  if (status === "published") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/admin/content/${id}`} className={linkClass}>
          Edit
        </Link>
        <Link href={`/admin/content/${id}/preview`} className={linkClass}>
          Preview
        </Link>
        <AdminButton variant="secondary" disabled={pending} onClick={() => runStatus("draft")}>
          Unpublish
        </AdminButton>
        <AdminButton variant="secondary" disabled={pending} onClick={() => runStatus("archived")}>
          Archive
        </AdminButton>
      </div>
    );
  }

  // Scheduled gets its own explicit action set (§14 of the Phase 4D brief:
  // Edit / Preview / Cancel Schedule) — never shown as if it were already
  // published, and never offered a direct "Publish now" shortcut here.
  if (status === "scheduled") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/admin/content/${id}`} className={linkClass}>
          Edit
        </Link>
        <Link href={`/admin/content/${id}/preview`} className={linkClass}>
          Preview
        </Link>
        <AdminButton variant="secondary" disabled={pending} onClick={() => runStatus("draft")}>
          Cancel schedule
        </AdminButton>
      </div>
    );
  }

  // draft or review — treated as the same "not live yet" action set.
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href={`/admin/content/${id}`} className={linkClass}>
        Edit
      </Link>
      <Link href={`/admin/content/${id}/preview`} className={linkClass}>
        Preview
      </Link>
      <AdminButton variant="secondary" disabled={pending} onClick={() => runStatus("published")}>
        Publish
      </AdminButton>
      <AdminButton variant="danger" disabled={pending} onClick={runDelete}>
        Delete
      </AdminButton>
    </div>
  );
}
