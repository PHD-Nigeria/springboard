"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSiteSettingsAction } from "@/lib/admin/taxonomy-actions";
import { AdminButton, AdminCard, AdminLabel, AdminSelect } from "@/components/admin/ui";

export function SettingsForm({
  defaultPublicationId,
  publications,
  isAdmin,
}: {
  defaultPublicationId: string | null;
  publications: { id: string; title: string }[];
  isAdmin: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveSiteSettingsAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <AdminCard className="max-w-md">
      <p className="font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">Editorial defaults</p>
      <form action={submit} className="mt-3 space-y-4">
        <div>
          <AdminLabel htmlFor="default_publication_id">Default publication</AdminLabel>
          <AdminSelect id="default_publication_id" name="default_publication_id" defaultValue={defaultPublicationId ?? ""} disabled={!isAdmin}>
            <option value="">None</option>
            {publications.map((publication) => (
              <option key={publication.id} value={publication.id}>
                {publication.title}
              </option>
            ))}
          </AdminSelect>
          <p className="mt-1.5 font-body text-xs text-foreground-muted">
            Pre-selected when a contributor starts a new piece of content.
          </p>
        </div>
        {!isAdmin && <p className="font-body text-xs text-foreground-muted">Only admins can change this.</p>}
        {error && <p className="font-body text-sm text-danger">{error}</p>}
        {saved && !error && <p className="font-body text-sm text-secondary-400">Saved.</p>}
        {isAdmin && (
          <AdminButton type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </AdminButton>
        )}
      </form>
    </AdminCard>
  );
}
