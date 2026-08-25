"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCategoryAction, deleteCategoryAction, getCategoryUsageAction } from "@/lib/admin/taxonomy-actions";
import { AdminButton, AdminInput, AdminLabel } from "@/components/admin/ui";
import { SafeDeleteButton } from "@/components/admin/SafeDeleteButton";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  contentCount: number;
}

export function CategoryManager({ initialCategories }: { initialCategories: Category[] }) {
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveCategoryAction(formData);
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
      const result = await deleteCategoryAction(id);
      if (result.error) window.alert(result.error);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <AdminButton type="button" onClick={() => setEditing("new")}>
          New category
        </AdminButton>
      </div>

      {editing && (
        <form action={submit} className="mb-6 grid grid-cols-1 gap-4 border border-border bg-surface p-4 md:grid-cols-4">
          {editing !== "new" && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <AdminLabel htmlFor="name">Name</AdminLabel>
            <AdminInput id="name" name="name" defaultValue={editing !== "new" ? editing.name : ""} required />
          </div>
          <div>
            <AdminLabel htmlFor="slug">Slug</AdminLabel>
            <AdminInput id="slug" name="slug" defaultValue={editing !== "new" ? editing.slug : ""} required pattern="[a-z0-9\-]+" />
          </div>
          <div className="md:col-span-2">
            <AdminLabel htmlFor="description">Description</AdminLabel>
            <AdminInput
              id="description"
              name="description"
              defaultValue={editing !== "new" ? (editing.description ?? "") : ""}
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
        {initialCategories.map((category) => (
          <div
            key={category.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="truncate font-body text-sm text-foreground">{category.name}</p>
              <p className="truncate font-body text-xs text-foreground-muted">
                /{category.slug} · {category.contentCount} {category.contentCount === 1 ? "item" : "items"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <AdminButton type="button" variant="secondary" onClick={() => setEditing(category)}>
                Edit
              </AdminButton>
              <SafeDeleteButton
                itemLabel="category"
                checkUsage={async () => {
                  const { count } = await getCategoryUsageAction(category.id);
                  return count > 0 ? `${count} piece${count === 1 ? "" : "s"} of content` : null;
                }}
                onConfirmDelete={() => remove(category.id)}
              />
            </div>
          </div>
        ))}
        {initialCategories.length === 0 && <p className="p-6 font-body text-sm text-foreground-muted">No categories yet.</p>}
      </div>
    </div>
  );
}
