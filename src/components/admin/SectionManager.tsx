"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSectionAction, deleteSectionAction, getSectionUsageAction } from "@/lib/admin/taxonomy-actions";
import { AdminButton, AdminInput, AdminLabel, AdminSelect } from "@/components/admin/ui";
import { SafeDeleteButton } from "@/components/admin/SafeDeleteButton";

interface Section {
  id: string;
  title: string;
  slug: string;
  publication_id: string;
  display_order: number;
  contentCount: number;
}

export function SectionManager({
  initialSections,
  publications,
}: {
  initialSections: Section[];
  publications: { id: string; title: string }[];
}) {
  const [editing, setEditing] = useState<Section | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveSectionAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteSectionAction(id);
      if (result.error) window.alert(result.error);
      router.refresh();
    });
  }

  const publicationTitle = (id: string) => publications.find((p) => p.id === id)?.title ?? "—";

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <AdminButton type="button" onClick={() => setEditing("new")} disabled={publications.length === 0}>
          New section
        </AdminButton>
      </div>
      {publications.length === 0 && (
        <p className="mb-4 font-body text-sm text-foreground-muted">Create a publication first — sections belong to one.</p>
      )}

      {editing && (
        <form action={submit} className="mb-6 grid grid-cols-1 gap-4 border border-border bg-surface p-4 md:grid-cols-4">
          {editing !== "new" && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <AdminLabel htmlFor="title">Title</AdminLabel>
            <AdminInput id="title" name="title" defaultValue={editing !== "new" ? editing.title : ""} required />
          </div>
          <div>
            <AdminLabel htmlFor="slug">Slug</AdminLabel>
            <AdminInput id="slug" name="slug" defaultValue={editing !== "new" ? editing.slug : ""} required pattern="[a-z0-9\-]+" />
          </div>
          <div>
            <AdminLabel htmlFor="publication_id">Publication</AdminLabel>
            <AdminSelect id="publication_id" name="publication_id" defaultValue={editing !== "new" ? editing.publication_id : ""} required>
              <option value="" disabled>
                Choose…
              </option>
              {publications.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </AdminSelect>
          </div>
          <div>
            <AdminLabel htmlFor="display_order">Display order</AdminLabel>
            <AdminInput
              id="display_order"
              name="display_order"
              type="number"
              defaultValue={editing !== "new" ? editing.display_order : 0}
            />
          </div>
          {error && <p className="font-body text-sm text-danger md:col-span-4">{error}</p>}
          <div className="flex gap-2 md:col-span-4">
            <AdminButton type="submit" disabled={pending}>
              Save
            </AdminButton>
            <AdminButton type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </AdminButton>
          </div>
        </form>
      )}

      <div className="border border-border">
        {initialSections.map((section) => (
          <div
            key={section.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="truncate font-body text-sm text-foreground">{section.title}</p>
              <p className="truncate font-body text-xs text-foreground-muted">
                /{section.slug} · {publicationTitle(section.publication_id)} · order {section.display_order} ·{" "}
                {section.contentCount} {section.contentCount === 1 ? "item" : "items"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <AdminButton type="button" variant="secondary" onClick={() => setEditing(section)}>
                Edit
              </AdminButton>
              <SafeDeleteButton
                itemLabel="section"
                checkUsage={async () => {
                  const { count } = await getSectionUsageAction(section.id);
                  return count > 0 ? `${count} piece${count === 1 ? "" : "s"} of content` : null;
                }}
                onConfirmDelete={() => remove(section.id)}
              />
            </div>
          </div>
        ))}
        {initialSections.length === 0 && <p className="p-6 font-body text-sm text-foreground-muted">No sections yet.</p>}
      </div>
    </div>
  );
}
