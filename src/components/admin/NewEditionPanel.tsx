"use client";

import { useState } from "react";
import { AdminButton } from "@/components/admin/ui";
import { EditionForm } from "@/components/admin/EditionForm";

/** Creating an edition never moves or reassigns existing stories. */
export function NewEditionPanel() {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <AdminButton type="button" onClick={() => setOpen(true)}>
        New edition
      </AdminButton>
    );
  }
  return (
    <div className="w-full">
      <p className="mb-2 font-body text-xs text-foreground-muted">Creating an edition does not change any existing story.</p>
      <EditionForm onDone={() => setOpen(false)} submitLabel="Create edition" />
    </div>
  );
}
