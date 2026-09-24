"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/admin/audit";

export interface BirthdayFormState {
  error: string | null;
  contentId?: string;
}

function nullableString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Creates or updates one BIRTHDAY content row together with its
 * content_staff link (role='birthday'), the join table 20260812011000's
 * own migration comment says was added specifically so a BIRTHDAY (or any
 * future staff-mention) can reference a real staff_id with referential
 * integrity, rather than a JSONB array of ids. One BIRTHDAY row per person
 * mirrors the source material (the Q2 deck gives each person their own
 * photo+name card) and matches how content_type's Card renders them:
 * StaffProfile takes one content row and resolves it to one person.
 */
export async function saveBirthdayAction(_prevState: BirthdayFormState, formData: FormData): Promise<BirthdayFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired, sign in again." };

  const id = nullableString(formData, "id");
  const title = nullableString(formData, "title");
  const slug = nullableString(formData, "slug");
  const staffId = nullableString(formData, "staff_id");
  const categoryId = nullableString(formData, "category_id");
  const coverMediaId = nullableString(formData, "cover_media_id");
  const summary = nullableString(formData, "summary");
  const intent = String(formData.get("intent") ?? "save-draft");

  if (!title) return { error: "Title is required." };
  if (!slug) return { error: "Slug is required." };
  if (!staffId) return { error: "Choose who this birthday is for." };

  const contentRecord = {
    title,
    slug,
    content_type: "BIRTHDAY" as const,
    category_id: categoryId,
    cover_media_id: coverMediaId,
    summary,
    body: { version: 1, blocks: [] },
  };

  let contentId = id;

  if (id) {
    const { data, error } = await supabase.from("content").update(contentRecord).eq("id", id).select("id");
    if (error) return { error: describeError(error.message) };
    if (!data || data.length === 0) return { error: "You don't have permission to edit this." };
  } else {
    const { data, error } = await supabase
      .from("content")
      .insert({ ...contentRecord, status: "draft", created_by: user.id })
      .select("id")
      .single();
    if (error) return { error: describeError(error.message) };
    contentId = data.id;
    await logAuditEvent(supabase, {
      actorUserId: user.id,
      action: "CREATE",
      entityType: "CONTENT",
      entityId: contentId,
      metadata: { title, slug, content_type: "BIRTHDAY" },
    });
  }
  if (!contentId) return { error: "Something went wrong saving this." };

  // Replace this row's content_staff link wholesale, same reasoning as
  // spotlight-actions.ts's upsertSpotlightLink: the form always submits the
  // complete current state, so delete-then-reinsert is simpler than a diff
  // and there's no history to preserve here either.
  const { error: deleteError } = await supabase.from("content_staff").delete().eq("content_id", contentId);
  if (deleteError) return { error: describeError(deleteError.message) };
  const { error: linkError } = await supabase.from("content_staff").insert({ content_id: contentId, staff_id: staffId, role: "birthday" });
  if (linkError) return { error: describeError(linkError.message) };

  if (intent === "publish") {
    const { error } = await supabase
      .from("content")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", contentId);
    if (error) return { error: describeError(error.message) };
    await logAuditEvent(supabase, { actorUserId: user.id, action: "PUBLISH", entityType: "CONTENT", entityId: contentId, metadata: { title } });
  } else if (id) {
    await logAuditEvent(supabase, { actorUserId: user.id, action: "UPDATE", entityType: "CONTENT", entityId: contentId, metadata: { title } });
  }

  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/${contentId}`);
  revalidatePath("/staff-news");
  return { error: null, contentId };
}

function describeError(message: string): string {
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "You don't have permission to do that with your current role.";
  }
  if (message.includes("duplicate key") && message.includes("content_slug_unique")) {
    return "That slug is already in use.";
  }
  return message;
}
