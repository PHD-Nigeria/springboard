"use client";

import { useState, useTransition } from "react";
import { AdminButton } from "@/components/admin/ui";

interface SafeDeleteButtonProps {
  /** Returns a human-readable usage summary (e.g. "8 pieces of content"), or null if nothing references this item. */
  checkUsage: () => Promise<string | null>;
  onConfirmDelete: () => void;
  itemLabel: string;
}

/**
 * The delete-with-usage-check pattern established for media in Phase 4B
 * (getMediaUsageAction + "used by N items" warning before "Delete anyway"),
 * generalized here for categories/sections/authors/publications — every
 * FK into these tables is `on delete set null`, so the database itself
 * never blocks a delete; this is what stands in for that.
 */
export function SafeDeleteButton({ checkUsage, onConfirmDelete, itemLabel }: SafeDeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [checking, setChecking] = useState(false);
  const [usage, setUsage] = useState<string | null | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  function requestDelete() {
    setConfirming(true);
    setChecking(true);
    setUsage(undefined);
    checkUsage()
      .then(setUsage)
      .finally(() => setChecking(false));
  }

  function confirmDelete() {
    startTransition(() => onConfirmDelete());
  }

  if (!confirming) {
    return (
      <AdminButton type="button" variant="danger" onClick={requestDelete}>
        Delete
      </AdminButton>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {checking ? (
        <span className="font-body text-xs text-foreground-muted">Checking usage…</span>
      ) : usage ? (
        <span className="font-body text-xs text-danger">
          Used by {usage} — deleting will remove this {itemLabel} from it.
        </span>
      ) : (
        <span className="font-body text-xs text-foreground-muted">Not currently used.</span>
      )}
      <AdminButton type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
        Cancel
      </AdminButton>
      <AdminButton type="button" variant="danger" onClick={confirmDelete} disabled={checking || pending}>
        {pending ? "Deleting…" : "Delete anyway"}
      </AdminButton>
    </div>
  );
}
