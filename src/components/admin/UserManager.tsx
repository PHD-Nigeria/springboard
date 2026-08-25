"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUserRoleAction } from "@/lib/admin/user-actions";
import type { AdminUserRow } from "@/lib/admin/queries";
import { AdminButton, AdminSelect } from "@/components/admin/ui";
import type { Database } from "@/lib/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];

const ROLE_OPTIONS: UserRole[] = ["viewer", "contributor", "editor", "admin"];

export function UserManager({ initialUsers, currentUserId }: { initialUsers: AdminUserRow[]; currentUserId: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function saveRole(userId: string, role: UserRole) {
    setError(null);
    startTransition(async () => {
      const result = await updateUserRoleAction(userId, role);
      if (result.error) {
        setError(result.error);
        return;
      }
      setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, role } : user)));
      setEditingId(null);
      router.refresh();
    });
  }

  return (
    <div>
      {error && <p className="mb-4 font-body text-sm text-danger">{error}</p>}
      <div className="border border-border">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-border bg-surface px-4 py-2 font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">
          <span>User</span>
          <span>Role</span>
          <span>Created</span>
          <span>Actions</span>
        </div>
        {users.map((user) => (
          <div
            key={user.id}
            className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="truncate font-body text-sm text-foreground">{user.full_name || user.email || user.id}</p>
              <p className="truncate font-body text-xs text-foreground-muted">
                {user.email ?? "no email on record"}
                {user.id === currentUserId ? " · you" : ""}
              </p>
            </div>
            {editingId === user.id ? (
              <AdminSelect
                defaultValue={user.role}
                disabled={pending}
                onChange={(e) => saveRole(user.id, e.target.value as UserRole)}
                className="w-auto"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </AdminSelect>
            ) : (
              <span className="font-body text-sm text-foreground uppercase tracking-wide">{user.role}</span>
            )}
            <span className="font-body text-xs text-foreground-muted">
              {new Date(user.created_at).toLocaleDateString("en-GB")}
            </span>
            {editingId === user.id ? (
              <AdminButton type="button" variant="ghost" onClick={() => setEditingId(null)}>
                Cancel
              </AdminButton>
            ) : (
              <AdminButton type="button" variant="secondary" onClick={() => setEditingId(user.id)}>
                Edit role
              </AdminButton>
            )}
          </div>
        ))}
        {users.length === 0 && <p className="p-6 font-body text-sm text-foreground-muted">No users yet.</p>}
      </div>
    </div>
  );
}
