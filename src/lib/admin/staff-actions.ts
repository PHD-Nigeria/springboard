"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/admin/audit";

export interface StaffFormState {
  error: string | null;
  staffId?: string;
}

function nullableString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

/** Same shape as saveAuthorAction (src/lib/admin/author-actions.ts), `staff` has one extra field (department) and an is_active toggle authors doesn't. */
export async function saveStaffAction(_prevState: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired, sign in again." };

  const id = nullableString(formData, "id");
  const fullName = nullableString(formData, "full_name");
  const slug = nullableString(formData, "slug");

  if (!fullName) return { error: "Full name is required." };
  if (!slug) return { error: "Slug is required." };

  const record = {
    full_name: fullName,
    slug,
    title: nullableString(formData, "title"),
    department: nullableString(formData, "department"),
    bio: nullableString(formData, "bio"),
    photo_media_id: nullableString(formData, "photo_media_id"),
    is_active: formData.get("is_active") === "true",
  };

  if (id) {
    // staff_write requires editor/admin for both USING and WITH CHECK, a
    // contributor's update matches zero rows and returns no error rather
    // than throwing, so `.select("id")` is what makes that detectable.
    const { data, error } = await supabase.from("staff").update(record).eq("id", id).select("id");
    if (error) return { error: describeError(error.message) };
    if (!data || data.length === 0) {
      return { error: "You don't have permission to do that with your current role." };
    }
    await logAuditEvent(supabase, { actorUserId: user.id, action: "UPDATE", entityType: "STAFF", entityId: id, metadata: { full_name: fullName, slug } });
    revalidatePath("/admin/staff");
    revalidatePath(`/admin/staff/${id}`);
    revalidatePath(`/staff/${slug}`);
    return { error: null, staffId: id };
  }

  const { data, error } = await supabase.from("staff").insert(record).select("id").single();
  if (error) return { error: describeError(error.message) };

  await logAuditEvent(supabase, { actorUserId: user.id, action: "CREATE", entityType: "STAFF", entityId: data.id, metadata: { full_name: fullName, slug } });

  revalidatePath("/admin/staff");
  return { error: null, staffId: data.id };
}

/** Neither FK into staff is `on delete set null` (staff_spotlights is `on delete restrict`, content_staff is `on delete cascade`), deleting a staff member who's in either would either be blocked outright or silently remove a birthday/spotlight's staff link, so the same warn-before-delete pattern as everywhere else applies here too. */
export async function getStaffUsageAction(id: string): Promise<{ count: number }> {
  const supabase = await createClient();
  const [spotlights, mentions] = await Promise.all([
    supabase.from("staff_spotlights").select("id", { count: "exact", head: true }).eq("staff_id", id),
    supabase.from("content_staff").select("content_id", { count: "exact", head: true }).eq("staff_id", id),
  ]);
  return { count: (spotlights.count ?? 0) + (mentions.count ?? 0) };
}

export async function deleteStaffAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired, sign in again." };

  const { data, error } = await supabase.from("staff").delete().eq("id", id).select("id, full_name");
  if (error) return { error: describeError(error.message) };
  if (!data || data.length === 0) {
    return { error: "You don't have permission to do that with your current role." };
  }

  await logAuditEvent(supabase, { actorUserId: user.id, action: "DELETE", entityType: "STAFF", entityId: id, metadata: { full_name: data[0]?.full_name } });

  revalidatePath("/admin/staff");
  return { error: null };
}

function describeError(message: string): string {
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "You don't have permission to do that with your current role.";
  }
  if (message.includes("duplicate key") && message.includes("staff_slug")) {
    return "That slug is already used by another staff member.";
  }
  if (message.includes("foreign key") && message.includes("staff_spotlights_staff_id_fkey")) {
    return "This staff member still has a Staff Spotlight, remove that first.";
  }
  return message;
}
