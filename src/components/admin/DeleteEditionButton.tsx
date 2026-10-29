"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePublicationAction, getPublicationUsageAction } from "@/lib/admin/taxonomy-actions";
import { AdminNotice } from "@/components/admin/ui";
import { SafeDeleteButton } from "@/components/admin/SafeDeleteButton";

/** Existing capability kept: delete with a usage warning. Stories in a deleted edition lose their edition (unassigned), so the warning says so. */
export function DeleteEditionButton({ editionId }: { editionId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <SafeDeleteButton
        itemLabel="edition"
        checkUsage={async () => {
          const { sectionCount, contentCount } = await getPublicationUsageAction(editionId);
          if (sectionCount === 0 && contentCount === 0) return null;
          const parts = [];
          if (sectionCount > 0) parts.push(`${sectionCount} section${sectionCount === 1 ? "" : "s"}`);
          if (contentCount > 0) parts.push(`${contentCount} stor${contentCount === 1 ? "y" : "ies"} (they would be left with no edition)`);
          return parts.join(" and ");
        }}
        onConfirmDelete={() => {
          setError(null);
          startTransition(async () => {
            const result = await deletePublicationAction(editionId);
            if (result.error) {
              setError(result.error);
              return;
            }
            router.push("/admin/publications");
          });
        }}
      />
      {error && <AdminNotice tone="error">{error}</AdminNotice>}
    </div>
  );
}
