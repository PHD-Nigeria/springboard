"use client";

import { useEffect, useRef } from "react";
import { AdminButton } from "@/components/admin/ui";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  /** Destructive confirmations use the danger style and focus Cancel first. */
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Native <dialog>: focus is trapped and restored by the browser, Escape cancels,
 * and the backdrop is inert. Replaces window.confirm so the prompt can say what
 * will happen and is readable by assistive technology.
 */
export function ConfirmDialog({ open, title, description, confirmLabel, destructive, pending, onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] border border-border-strong bg-surface p-0 text-foreground backdrop:bg-[#1a0b3b]/60"
    >
      <div className="p-5">
        <h2 id="confirm-title" className="font-display text-lg font-medium">
          {title}
        </h2>
        <p id="confirm-desc" className="mt-2 font-body text-sm text-foreground-muted">
          {description}
        </p>
      </div>
      <div className="flex justify-end gap-3 border-t border-border bg-surface-raised px-5 py-3">
        <AdminButton type="button" variant="secondary" autoFocus={destructive} onClick={onCancel} disabled={pending}>
          Cancel
        </AdminButton>
        <AdminButton type="button" variant={destructive ? "danger" : "primary"} onClick={onConfirm} disabled={pending}>
          {pending ? "Working…" : confirmLabel}
        </AdminButton>
      </div>
    </dialog>
  );
}
