"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveNavItemAction, deleteNavItemAction, getNavItemUsageAction } from "@/lib/admin/taxonomy-actions";
import { AdminButton, AdminInput, AdminLabel } from "@/components/admin/ui";
import { SafeDeleteButton } from "@/components/admin/SafeDeleteButton";

interface NavItem {
  id: string;
  label: string;
  href: string;
  display_order: number;
  is_visible: boolean;
  is_external: boolean;
  open_in_new_tab: boolean;
}

export function NavigationManager({ initialItems }: { initialItems: NavItem[] }) {
  const [editing, setEditing] = useState<NavItem | "new" | null>(null);
  // Only tracked so the "opens in new tab" field can be shown/hidden as the
  // checkbox is toggled, before the form is even submitted.
  const [isExternal, setIsExternal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function startEditing(item: NavItem | "new") {
    setEditing(item);
    setIsExternal(item !== "new" ? item.is_external : false);
  }

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveNavItemAction(formData);
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
      const result = await deleteNavItemAction(id);
      if (result.error) window.alert(result.error);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <AdminButton type="button" onClick={() => startEditing("new")}>
          New navigation item
        </AdminButton>
      </div>

      {editing && (
        <form action={submit} className="mb-6 grid grid-cols-1 gap-4 border border-border bg-surface p-4 md:grid-cols-4">
          {editing !== "new" && <input type="hidden" name="id" value={editing.id} />}
          <div>
            <AdminLabel htmlFor="label">Label</AdminLabel>
            <AdminInput id="label" name="label" defaultValue={editing !== "new" ? editing.label : ""} required />
          </div>
          <div>
            <AdminLabel htmlFor="href">URL</AdminLabel>
            <AdminInput
              id="href"
              name="href"
              defaultValue={editing !== "new" ? editing.href : ""}
              placeholder={isExternal ? "https://…" : "/search or /#section"}
              required
            />
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
          <div className="flex flex-col justify-end gap-2 font-body text-sm text-foreground">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_external"
                value="true"
                checked={isExternal}
                onChange={(e) => setIsExternal(e.target.checked)}
              />
              External link
            </label>
            {isExternal && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="open_in_new_tab"
                  value="true"
                  defaultChecked={editing !== "new" ? editing.open_in_new_tab : true}
                />
                Open in new tab
              </label>
            )}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_visible"
                value="true"
                defaultChecked={editing !== "new" ? editing.is_visible : true}
              />
              Visible
            </label>
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
        {initialItems.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="truncate font-body text-sm text-foreground">
                {item.label}
                {!item.is_visible && <span className="ml-2 text-foreground-muted">(hidden)</span>}
              </p>
              <p className="truncate font-body text-xs text-foreground-muted">
                {item.href} · order {item.display_order} · {item.is_external ? "external" : "internal"}
                {item.is_external && item.open_in_new_tab ? " · new tab" : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <AdminButton type="button" variant="secondary" onClick={() => startEditing(item)}>
                Edit
              </AdminButton>
              <SafeDeleteButton
                itemLabel="navigation item"
                checkUsage={async () => {
                  await getNavItemUsageAction();
                  return null;
                }}
                onConfirmDelete={() => remove(item.id)}
              />
            </div>
          </div>
        ))}
        {initialItems.length === 0 && <p className="p-6 font-body text-sm text-foreground-muted">No navigation items yet.</p>}
      </div>
    </div>
  );
}
