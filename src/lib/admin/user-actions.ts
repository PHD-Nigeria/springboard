"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/admin/audit";
import type { Database } from "@/lib/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];

export interface UserActionResult {
  error: string | null;
}

/**
 * Role changes reuse the existing role architecture as-is (profiles.role +
 * the prevent_role_self_escalation trigger, which already restricts this
 * column to admin-only writers at the database level) — this action just
 * adds the one thing that architecture doesn't cover: refusing to demote
 * the last remaining admin, which would leave Springboard with no one able
 * to manage roles at all.
 */
export async function updateUserRoleAction(userId: string, role: UserRole): Promise<UserActionResult> {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    return { error: "Only admins can change user roles." };
  }

  const supabase = await createClient();

  const { data: target } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  const roleBefore = target?.role ?? null;

  if (role !== "admin" && roleBefore === "admin") {
    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return { error: "Can't remove the last administrator — promote someone else first." };
    }
  }

  const { data, error } = await supabase.from("profiles").update({ role }).eq("id", userId).select("id");
  if (error) {
    if (error.message.includes("Only an admin can change")) {
      return { error: "Only admins can change user roles." };
    }
    return { error: error.message };
  }
  if (!data || data.length === 0) {
    return { error: "You don't have permission to do that with your current role." };
  }

  await logAuditEvent(supabase, {
    actorUserId: session.userId,
    action: "ROLE_CHANGE",
    entityType: "USER",
    entityId: userId,
    metadata: { role_before: roleBefore, role_after: role },
  });

  revalidatePath("/admin/users");
  return { error: null };
}
