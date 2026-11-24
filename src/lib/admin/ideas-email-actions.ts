"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/admin/audit";
import { buildIdeasMailto } from "@/lib/ideas/mailto";

export interface IdeasEmailResult {
  error: string | null;
}

/** Admin-only (site_settings_write RLS is the real boundary). An empty value clears the address, which disables the header button. */
export async function saveIdeasEmailAction(formData: FormData): Promise<IdeasEmailResult> {
  const session = await getAdminSession();
  if (!session) return { error: "Your session has expired — sign in again." };
  if (session.role !== "admin") return { error: "Only an administrator can change this." };

  const raw = String(formData.get("ideas_email") ?? "").trim();
  if (raw && !buildIdeasMailto(raw)) return { error: "Enter a valid email address, or leave it empty to disable the button." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("site_settings").update({ ideas_email: raw || null }).eq("id", true).select("id");
  if (error || !data || data.length === 0) return { error: "The address could not be saved. The setting may not be available in this environment yet." };

  await logAuditEvent(supabase, { actorUserId: session.userId, action: "SETTINGS_UPDATE", entityType: "SETTINGS", metadata: { section: "ideas_email", configured: Boolean(raw) } });
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  return { error: null };
}

/** Current value for the admin form; null if unset or the column does not exist yet. */
export async function getIdeasEmailForAdmin(): Promise<{ available: boolean; value: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("site_settings").select("ideas_email").eq("id", true).maybeSingle();
  if (error) return { available: false, value: "" };
  return { available: true, value: data?.ideas_email ?? "" };
}
