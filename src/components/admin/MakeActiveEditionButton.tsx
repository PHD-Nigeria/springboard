"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSiteSettingsAction } from "@/lib/admin/taxonomy-actions";
import { AdminButton, AdminNotice } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

/**
 * Sets the edition that new stories are pre-assigned to (Site Settings > default publication, administrators only).
 * It never touches existing stories: nothing is reassigned when the active edition changes.
 */
export function MakeActiveEditionButton({ editionId, editionTitle }: { editionId: string; editionTitle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    const formData = new FormData();
    formData.set("default_publication_id", editionId);
    startTransition(async () => {
      const result = await saveSiteSettingsAction(formData);
      setOpen(false);
      if (result.error) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      setMessage({ tone: "success", text: `${editionTitle} is now the active edition.` });
      router.refresh();
    });
  }

  return (
    <div>
      <AdminButton type="button" variant="secondary" disabled={pending} onClick={() => setOpen(true)}>
        Make active edition
      </AdminButton>
      {message && (
        <AdminNotice tone={message.tone} className="mt-2">
          {message.text}
        </AdminNotice>
      )}
      <ConfirmDialog
        open={open}
        pending={pending}
        title="Make this the active edition?"
        description={`New stories will be pre-assigned to "${editionTitle}". Existing stories are not changed.`}
        confirmLabel="Make active"
        onCancel={() => setOpen(false)}
        onConfirm={confirm}
      />
    </div>
  );
}
