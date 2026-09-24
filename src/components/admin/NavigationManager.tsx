"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveNavItemAction, deleteNavItemAction, getNavItemUsageAction } from "@/lib/admin/taxonomy-actions";
import { AdminButton, AdminInput, AdminLabel, AdminSelect } from "@/components/admin/ui";
import { SafeDeleteButton } from "@/components/admin/SafeDeleteButton";

interface NavItem {
  id: string;
  parent_id: string | null;
  label: string;
  href: string;
  display_order: number;
  is_visible: boolean;
  is_external: boolean;
  open_in_new_tab: boolean;
}

/** A brand-new row's parent is chosen up front (via "New group" vs. "New item under a group"), since the form itself has no separate parent field — see the two buttons above the list. */
type EditingTarget = NavItem | { kind: "new"; parentId: string | null };

export function NavigationManager({ initialItems }: { initialItems: NavItem[] }) {
  const [editing, setEditing] = useState<EditingTarget | null>(null);
  // Only tracked so the "opens in new tab" field can be shown/hidden as the
  // checkbox is toggled, before the form is even submitted.
  const [isExternal, setIsExternal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const isNew = (target: EditingTarget): target is { kind: "new"; parentId: string | null } => "kind" in target;

  // A group heading is a top-level item with no href of its own (the
  // convention the nav-hierarchy migration establishes) — not "currently has
  // children," so a freshly created group still shows up as a valid parent
  // to pick before its first child exists.
  const groups = initialItems
    .filter((item) => item.parent_id === null && item.href === "")
    .sort((a, b) => a.display_order - b.display_order);
  const childrenOf = (parentId: string) =>
    initialItems.filter((item) => item.parent_id === parentId).sort((a, b) => a.display_order - b.display_order);
  const standalone = initialItems
    .filter((item) => item.parent_id === null && item.href !== "")
    .sort((a, b) => a.display_order - b.display_order);

  function startEditing(target: EditingTarget) {
    setEditing(target);
    setIsExternal(!isNew(target) ? target.is_external : false);
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

  function renderRow(item: NavItem, indent: boolean) {
    return (
      <div
        key={item.id}
        className={`flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0 ${indent ? "pl-10" : ""}`}
      >
        <div className="min-w-0">
          <p className="truncate font-body text-sm text-foreground">
            {item.label}
            {!item.is_visible && <span className="ml-2 text-foreground-muted">(hidden)</span>}
          </p>
          <p className="truncate font-body text-xs text-foreground-muted">
            {item.href ? item.href : "group heading, no link"} · order {item.display_order} ·{" "}
            {item.is_external ? "external" : "internal"}
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
              const { count } = await getNavItemUsageAction(item.id);
              return count > 0 ? `${count} sub-item${count === 1 ? "" : "s"} (they'll be deleted too)` : null;
            }}
            onConfirmDelete={() => remove(item.id)}
          />
        </div>
      </div>
    );
  }

  const editingIsNew = editing !== null && isNew(editing);
  const editingParentId = editing === null ? null : isNew(editing) ? editing.parentId : editing.parent_id;

  return (
    <div>
      <div className="mb-6 flex flex-wrap justify-end gap-2">
        <AdminButton type="button" variant="secondary" onClick={() => startEditing({ kind: "new", parentId: null })}>
          New top-level item
        </AdminButton>
        <AdminButton
          type="button"
          onClick={() => startEditing({ kind: "new", parentId: groups[0]?.id ?? null })}
          disabled={groups.length === 0}
        >
          New item in a group
        </AdminButton>
      </div>

      {editing && (
        <form action={submit} className="mb-6 grid grid-cols-1 gap-4 border border-border bg-surface p-4 md:grid-cols-4">
          {!editingIsNew && <input type="hidden" name="id" value={(editing as NavItem).id} />}
          <div>
            <AdminLabel htmlFor="parent_id">Group</AdminLabel>
            <AdminSelect id="parent_id" name="parent_id" defaultValue={editingParentId ?? ""}>
              <option value="">None (top-level link or a group heading itself)</option>
              {groups
                .filter((group) => editingIsNew || (editing as NavItem).id !== group.id)
                .map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.label}
                  </option>
                ))}
            </AdminSelect>
          </div>
          <div>
            <AdminLabel htmlFor="label">Label</AdminLabel>
            <AdminInput id="label" name="label" defaultValue={!editingIsNew ? (editing as NavItem).label : ""} required />
          </div>
          <div>
            <AdminLabel htmlFor="href">URL</AdminLabel>
            <AdminInput
              id="href"
              name="href"
              defaultValue={!editingIsNew ? (editing as NavItem).href : ""}
              placeholder={isExternal ? "https://…" : "/search, or leave blank for a group heading"}
            />
          </div>
          <div>
            <AdminLabel htmlFor="display_order">Display order</AdminLabel>
            <AdminInput
              id="display_order"
              name="display_order"
              type="number"
              defaultValue={!editingIsNew ? (editing as NavItem).display_order : 0}
            />
          </div>
          <div className="flex flex-col justify-end gap-2 font-body text-sm text-foreground md:col-span-4">
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
                  defaultChecked={!editingIsNew ? (editing as NavItem).open_in_new_tab : true}
                />
                Open in new tab
              </label>
            )}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_visible"
                value="true"
                defaultChecked={!editingIsNew ? (editing as NavItem).is_visible : true}
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
        {groups.map((group) => (
          <div key={group.id}>
            {renderRow(group, false)}
            {childrenOf(group.id).map((child) => renderRow(child, true))}
          </div>
        ))}
        {standalone.map((item) => renderRow(item, false))}
        {initialItems.length === 0 && <p className="p-6 font-body text-sm text-foreground-muted">No navigation items yet.</p>}
      </div>
    </div>
  );
}
