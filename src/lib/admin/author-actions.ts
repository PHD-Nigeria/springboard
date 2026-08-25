"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/admin/audit";

export interface AuthorFormState {
  error: string | null;
  authorId?: string;
}

function nullableString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

/** authors has no visibility/status column (see supabase/migrations/20260812010400_directory_tables.sql) — every contributor is always visible, matching the schema exactly. */
export async function saveAuthorAction(_prevState: AuthorFormState, formData: FormData): Promise<AuthorFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — sign in again." };

  const id = nullableString(formData, "id");
  const name = nullableString(formData, "name");
  const slug = nullableString(formData, "slug");

  if (!name) return { error: "Name is required." };
  if (!slug) return { error: "Slug is required." };

  const record = {
    name,
    slug,
    title: nullableString(formData, "title"),
    bio: nullableString(formData, "bio"),
    avatar_media_id: nullableString(formData, "avatar_media_id"),
  };

  if (id) {
    // authors_write requires editor/admin for both USING and WITH CHECK —
    // a contributor's update matches zero rows and returns no error rather
    // than throwing, so `.select("id")` is what makes that detectable.
    const { data, error } = await supabase.from("authors").update(record).eq("id", id).select("id");
    if (error) return { error: describeError(error.message) };
    if (!data || data.length === 0) {
      return { error: "You don't have permission to do that with your current role." };
    }
    await logAuditEvent(supabase, { actorUserId: user.id, action: "UPDATE", entityType: "AUTHOR", entityId: id, metadata: { name, slug } });
    revalidatePath("/admin/contributors");
    revalidatePath(`/admin/contributors/${id}`);
    revalidatePath(`/contributors/${slug}`);
    return { error: null, authorId: id };
  }

  const { data, error } = await supabase.from("authors").insert(record).select("id").single();
  if (error) return { error: describeError(error.message) };

  await logAuditEvent(supabase, { actorUserId: user.id, action: "CREATE", entityType: "AUTHOR", entityId: data.id, metadata: { name, slug } });

  revalidatePath("/admin/contributors");
  revalidatePath(`/contributors/${slug}`);
  return { error: null, authorId: data.id };
}

/** content.author_id is `on delete set null` (20260812010700_content.sql) — the DB won't block a delete, so this is what lets the UI warn first. */
export async function getAuthorUsageAction(id: string): Promise<{ count: number }> {
  const supabase = await createClient();
  const { count } = await supabase.from("content").select("id", { count: "exact", head: true }).eq("author_id", id);
  return { count: count ?? 0 };
}

export async function deleteAuthorAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — sign in again." };

  const { data, error } = await supabase.from("authors").delete().eq("id", id).select("id, name");
  if (error) return { error: describeError(error.message) };
  if (!data || data.length === 0) {
    return { error: "You don't have permission to do that with your current role." };
  }

  await logAuditEvent(supabase, { actorUserId: user.id, action: "DELETE", entityType: "AUTHOR", entityId: id, metadata: { name: data[0]?.name } });

  revalidatePath("/admin/contributors");
  return { error: null };
}

function describeError(message: string): string {
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "You don't have permission to do that with your current role.";
  }
  if (message.includes("duplicate key") && message.includes("authors_slug")) {
    return "That slug is already used by another contributor.";
  }
  if (message.includes("foreign key") && message.includes("content_author_id_fkey")) {
    return "This contributor still has content assigned to them — reassign or remove that content first.";
  }
  return message;
}
