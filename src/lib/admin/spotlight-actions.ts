"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/admin/audit";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface SpotlightFormState {
  error: string | null;
  contentId?: string;
}

function nullableString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Creates or updates a STAFF_SPOTLIGHT content row together with its
 * staff_spotlights link and spotlight_questions rows, the three tables the
 * existing schema splits this content type across (see each table's own
 * migration comment in 20260812010900_spotlights.sql). One form, one
 * submit, three writes, same "handles create and update from one action"
 * shape as saveContentAction, just without the full publish-lifecycle
 * intent handling that form supports (a spotlight only ever needs
 * draft/published here, see ContentForm's own note on why
 * STAFF_SPOTLIGHT isn't in CREATABLE_TYPES: this dedicated form is what
 * replaces the generic one for this type).
 */
export async function saveSpotlightAction(_prevState: SpotlightFormState, formData: FormData): Promise<SpotlightFormState> {
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
  const intent = String(formData.get("intent") ?? "save-draft");

  if (!title) return { error: "Title is required." };
  if (!slug) return { error: "Slug is required." };
  if (!staffId) return { error: "Choose who this spotlight is about." };

  const questions = formData.getAll("question").map((v) => String(v).trim());
  const answers = formData.getAll("answer").map((v) => String(v).trim());
  const qaPairs = questions
    .map((question, i) => ({ question, answer: answers[i] ?? "" }))
    .filter((pair) => pair.question.length > 0 && pair.answer.length > 0);

  if (intent === "publish" && qaPairs.length === 0) {
    return { error: "Add at least one question and answer before publishing." };
  }

  const contentRecord = {
    title,
    slug,
    content_type: "STAFF_SPOTLIGHT" as const,
    category_id: categoryId,
    cover_media_id: coverMediaId,
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
      metadata: { title, slug, content_type: "STAFF_SPOTLIGHT" },
    });
  }
  if (!contentId) return { error: "Something went wrong saving this spotlight." };

  const linkResult = await upsertSpotlightLink(supabase, contentId, staffId, qaPairs);
  if (linkResult.error) return linkResult;

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
  revalidatePath("/staff-spotlight");
  return { error: null, contentId };
}

/** Replaces the spotlight's questions wholesale on every save, simpler and safe here since there's no revision history to preserve per-question (unlike content_revisions, which snapshots the parent content row, not this table), and the form always submits the complete current list, never a partial one. */
async function upsertSpotlightLink(
  supabase: SupabaseClient<Database>,
  contentId: string,
  staffId: string,
  qaPairs: { question: string; answer: string }[]
): Promise<{ error: string | null }> {
  const { data: existing, error: existingError } = await supabase
    .from("staff_spotlights")
    .select("id")
    .eq("content_id", contentId)
    .maybeSingle();
  if (existingError) return { error: describeError(existingError.message) };

  let spotlightId = existing?.id;
  if (spotlightId) {
    const { error } = await supabase.from("staff_spotlights").update({ staff_id: staffId }).eq("id", spotlightId);
    if (error) return { error: describeError(error.message) };
  } else {
    const { data, error } = await supabase
      .from("staff_spotlights")
      .insert({ content_id: contentId, staff_id: staffId })
      .select("id")
      .single();
    if (error) return { error: describeError(error.message) };
    spotlightId = data.id;
  }

  const { error: deleteError } = await supabase.from("spotlight_questions").delete().eq("spotlight_id", spotlightId);
  if (deleteError) return { error: describeError(deleteError.message) };

  if (qaPairs.length > 0) {
    const { error: insertError } = await supabase.from("spotlight_questions").insert(
      qaPairs.map((pair, index) => ({
        spotlight_id: spotlightId,
        question: pair.question,
        answer: pair.answer,
        display_order: index,
      }))
    );
    if (insertError) return { error: describeError(insertError.message) };
  }

  return { error: null };
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
