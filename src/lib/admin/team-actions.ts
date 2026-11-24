"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/admin/audit";
import { validateTeamMember, reorderIds } from "@/lib/team/team";

export interface TeamActionResult {
  error: string | null;
}

const NO_PERMISSION = "Only an administrator can manage the team section.";

/**
 * Every action requires an admin session here (a usability check that gives a clear message) AND is enforced again
 * by team_members_write RLS (is_admin()), which is the real boundary. A non-admin's write matches zero rows, which
 * is detected below and reported instead of failing silently.
 */
async function requireAdmin() {
  const session = await getAdminSession();
  return session && session.role === "admin" ? session : null;
}

function refresh() {
  revalidatePath("/admin/team");
  revalidatePath("/");
}

export async function createTeamMemberAction(input: { name: string; role: string }): Promise<TeamActionResult> {
  const session = await requireAdmin();
  if (!session) return { error: NO_PERMISSION };
  const parsed = validateTeamMember(input);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data: last } = await supabase.from("team_members").select("display_order").order("display_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("team_members")
    .insert({ name: parsed.value.name, role: parsed.value.role, display_order: (last?.display_order ?? 0) + 1 })
    .select("id")
    .single();
  if (error) return { error: error.message.includes("row-level security") ? NO_PERMISSION : "The team member could not be added. Try again." };
  await logAuditEvent(supabase, { actorUserId: session.userId, action: "CREATE", entityType: "TEAM", entityId: data.id, metadata: { name: parsed.value.name } });
  refresh();
  return { error: null };
}

export async function updateTeamMemberAction(id: string, input: { name: string; role: string }): Promise<TeamActionResult> {
  const session = await requireAdmin();
  if (!session) return { error: NO_PERMISSION };
  const parsed = validateTeamMember(input);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("team_members").update({ name: parsed.value.name, role: parsed.value.role }).eq("id", id).select("id");
  if (error) return { error: "The change could not be saved. Try again." };
  if (!data || data.length === 0) return { error: NO_PERMISSION };
  await logAuditEvent(supabase, { actorUserId: session.userId, action: "UPDATE", entityType: "TEAM", entityId: id, metadata: { name: parsed.value.name } });
  refresh();
  return { error: null };
}

export async function setTeamMemberVisibilityAction(id: string, visible: boolean): Promise<TeamActionResult> {
  const session = await requireAdmin();
  if (!session) return { error: NO_PERMISSION };
  const supabase = await createClient();
  const { data, error } = await supabase.from("team_members").update({ is_visible: visible }).eq("id", id).select("id");
  if (error) return { error: "The change could not be saved. Try again." };
  if (!data || data.length === 0) return { error: NO_PERMISSION };
  await logAuditEvent(supabase, { actorUserId: session.userId, action: "UPDATE", entityType: "TEAM", entityId: id, metadata: { is_visible: visible } });
  refresh();
  return { error: null };
}

/** Moves one member up or down by swapping, then renumbers everyone 1..n so the order is always unambiguous. */
export async function moveTeamMemberAction(id: string, direction: "up" | "down"): Promise<TeamActionResult> {
  const session = await requireAdmin();
  if (!session) return { error: NO_PERMISSION };
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("team_members").select("id").order("display_order", { ascending: true }).order("created_at", { ascending: true });
  if (error || !rows) return { error: "The order could not be changed. Try again." };
  const ids = rows.map((row) => row.id);
  const next = reorderIds(ids, ids.indexOf(id), direction === "up" ? -1 : 1);
  if (!next) return { error: null }; // already at the end: nothing to do

  for (let i = 0; i < next.length; i++) {
    const { data, error: updateError } = await supabase.from("team_members").update({ display_order: i + 1 }).eq("id", next[i]).select("id");
    if (updateError || !data || data.length === 0) return { error: updateError ? "The order could not be changed. Try again." : NO_PERMISSION };
  }
  await logAuditEvent(supabase, { actorUserId: session.userId, action: "UPDATE", entityType: "TEAM", entityId: id, metadata: { moved: direction } });
  refresh();
  return { error: null };
}

export async function deleteTeamMemberAction(id: string): Promise<TeamActionResult> {
  const session = await requireAdmin();
  if (!session) return { error: NO_PERMISSION };
  const supabase = await createClient();
  const { data, error } = await supabase.from("team_members").delete().eq("id", id).select("id");
  if (error) return { error: "The team member could not be removed. Try again." };
  if (!data || data.length === 0) return { error: NO_PERMISSION };
  await logAuditEvent(supabase, { actorUserId: session.userId, action: "DELETE", entityType: "TEAM", entityId: id });
  refresh();
  return { error: null };
}
