"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeParseBodyDocument } from "@/content-types/blocks";
import { CONTENT_TYPES, type ContentType } from "@/content-types/types";
import { logAuditEvent } from "@/lib/admin/audit";
import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type ContentUpdate = Database["public"]["Tables"]["content"]["Update"];

export interface ContentFormState {
  error: string | null;
  contentId?: string;
}

export interface ContentPickerRow {
  id: string;
  title: string;
  slug: string;
}

/** Backs the related-content block's picker in BlockEditor — title/slug search over the same content table, nothing new. */
export async function searchContentForPickerAction(query?: string, excludeId?: string): Promise<ContentPickerRow[]> {
  const supabase = await createClient();
  let dbQuery = supabase.from("content").select("id, title, slug").order("updated_at", { ascending: false }).limit(20);

  if (query) dbQuery = dbQuery.ilike("title", `%${query}%`);
  if (excludeId) dbQuery = dbQuery.neq("id", excludeId);

  const { data, error } = await dbQuery;
  if (error) throw error;
  return data ?? [];
}

function nullableString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

/** ARTICLE/COMPANY_NEWS only (§11) — revisions aren't extended to every content type this phase. */
const REVISIONED_TYPES: readonly string[] = ["ARTICLE", "COMPANY_NEWS"];

/**
 * Snapshots the just-saved editable fields of a content row — called AFTER
 * a successful UPDATE (never on first create: there's nothing to compare
 * a brand-new row against yet, and the live row already stands in for
 * "revision zero"). Best-effort, like audit logging: a revision write
 * failure doesn't undo the content save that already succeeded.
 */
async function writeContentRevision(
  supabase: SupabaseClient<Database>,
  contentId: string,
  contentType: string,
  editorId: string,
  snapshot: Record<string, unknown>
): Promise<void> {
  if (!REVISIONED_TYPES.includes(contentType)) return;

  const { data: last } = await supabase
    .from("content_revisions")
    .select("revision_number")
    .eq("content_id", contentId)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextRevision = (last?.revision_number ?? 0) + 1;
  const { error } = await supabase.from("content_revisions").insert({
    content_id: contentId,
    revision_number: nextRevision,
    editor_id: editorId,
    snapshot: snapshot as unknown as Database["public"]["Tables"]["content_revisions"]["Insert"]["snapshot"],
  });
  if (error) console.error("revision write failed:", contentId, error.message);
}

/**
 * Handles create, update, and every status transition from one form —
 * which action ran is decided by the `intent` field, set by whichever
 * submit button was actually clicked (`<button name="intent" value="...">`,
 * standard HTML — no extra client JS needed for that part). All of this
 * still runs through the cookie-based (RLS-subject) server client: RLS is
 * what actually enforces who can create/edit/publish, not this function.
 */
export async function saveContentAction(_prevState: ContentFormState, formData: FormData): Promise<ContentFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — sign in again." };

  const id = nullableString(formData, "id");
  const intent = String(formData.get("intent") ?? "save-draft");

  const title = nullableString(formData, "title");
  const slug = nullableString(formData, "slug");
  const contentTypeRaw = nullableString(formData, "content_type");
  const contentType =
    contentTypeRaw && (CONTENT_TYPES as readonly string[]).includes(contentTypeRaw)
      ? (contentTypeRaw as ContentType)
      : null;

  if (!title) return { error: "Title is required." };
  if (!slug) return { error: "Slug is required." };
  if (!contentType) return { error: "Content type is required." };

  const bodyRaw = nullableString(formData, "body") ?? '{"version":1,"blocks":[]}';
  let body: unknown;
  try {
    body = JSON.parse(bodyRaw);
  } catch {
    return { error: "The block editor produced invalid data — try removing the last block you edited." };
  }
  const parsedBody = safeParseBodyDocument(body);
  if (!parsedBody.success) {
    return { error: "One or more blocks are incomplete — every block needs its required fields filled in." };
  }

  const publicationId = nullableString(formData, "publication_id");
  const sectionId = nullableString(formData, "section_id");
  const authorId = nullableString(formData, "author_id");
  const categoryId = nullableString(formData, "category_id");
  const coverMediaId = nullableString(formData, "cover_media_id");
  const subtitle = nullableString(formData, "subtitle");
  const summary = nullableString(formData, "summary");
  const publishAtRaw = nullableString(formData, "publish_at");

  // "Save changes" on content that's already live must hold it to the same
  // bar as publishing does — otherwise editing a published article's blocks
  // down to zero, or clearing its publication, would leave it labelled
  // PUBLISHED while actually broken/unreachable at its public URL, with no
  // warning at all (this path skips the intent==="publish" checks below
  // entirely, since unpublish/archive/save-draft aren't "publish").
  const currentStatus = nullableString(formData, "current_status");
  // Scheduled content holds the same bar as published: it becomes publicly
  // visible with no further human action once publish_at passes (RLS
  // already grants that — see docs/architecture.md §5/§Phase 4D), so an
  // edit that leaves it blockless or publication-less would go live broken
  // the moment the clock catches up, with nothing left to catch it.
  const mustStayPublishReady =
    intent === "publish" ||
    intent === "schedule" ||
    (intent === "save-draft" && (currentStatus === "published" || currentStatus === "scheduled"));
  if (mustStayPublishReady && parsedBody.data.blocks.length === 0) {
    return { error: "This content needs at least one block — it's published and must stay reader-ready." };
  }
  if (mustStayPublishReady && !publicationId) {
    return { error: "This content needs a publication — it's published and must stay reader-ready." };
  }

  // A schedule must be an explicit, deliberate choice with a real date
  // attached — never an accidental side effect of a date field simply
  // having a value left in it from a previous edit. (Block/publication
  // readiness for "schedule" is already covered by mustStayPublishReady
  // above — this only adds the date-specific check that's unique to it.)
  if (intent === "schedule" && (!publishAtRaw || Number.isNaN(Date.parse(publishAtRaw)))) {
    return { error: "Choose a publish date and time to schedule this." };
  }

  const record = {
    title,
    slug,
    content_type: contentType,
    body: parsedBody.data,
    subtitle,
    summary,
    publication_id: publicationId,
    section_id: sectionId,
    author_id: authorId,
    category_id: categoryId,
    cover_media_id: coverMediaId,
    publish_at: publishAtRaw,
  };

  let contentId = id;

  if (id) {
    // See applyStatusTransition's comment: RLS can filter an update out
    // silently (0 rows, no error) rather than throwing — e.g. a
    // contributor editing content that isn't theirs, or that's no longer
    // draft/review. `.select("id")` is what makes that detectable here too.
    const { data, error } = await supabase.from("content").update(record).eq("id", id).select("id");
    if (error) return { error: describeError(error.message) };
    if (!data || data.length === 0) {
      return { error: "You don't have permission to edit this — it may not be yours, or it's no longer a draft." };
    }

    await writeContentRevision(supabase, id, contentType, user.id, { ...record, status: currentStatus });

    // A transition intent (publish/schedule/archive/...) is the
    // semantically meaningful action the editor took — log that instead of
    // a redundant generic UPDATE alongside it. Plain field edits (intent
    // === "save-draft" with no transition) get their own UPDATE event.
    if (intent === "save-draft") {
      await logAuditEvent(supabase, {
        actorUserId: user.id,
        action: "UPDATE",
        entityType: "CONTENT",
        entityId: id,
        metadata: { title, status_before: currentStatus, status_after: currentStatus },
      });
    }
  } else {
    const { data, error } = await supabase
      .from("content")
      .insert({ ...record, status: "draft", created_by: user.id })
      .select("id")
      .single();
    if (error) return { error: describeError(error.message) };
    contentId = data.id;

    await logAuditEvent(supabase, {
      actorUserId: user.id,
      action: "CREATE",
      entityType: "CONTENT",
      entityId: contentId,
      metadata: { title, slug, content_type: contentType },
    });
  }

  if (!contentId) return { error: "Something went wrong saving this content." };

  if (intent !== "save-draft" || !id) {
    const statusUpdate = await applyStatusTransition(contentId, intent, user.id, title);
    if (statusUpdate?.error) return statusUpdate;
  }

  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/${contentId}`);
  revalidatePath("/");
  return { error: null, contentId };
}

const TRANSITION_AUDIT: Record<string, { status: Database["public"]["Enums"]["content_status"]; action: Database["public"]["Enums"]["audit_action"] }> = {
  publish: { status: "published", action: "PUBLISH" },
  unpublish: { status: "draft", action: "UNPUBLISH" },
  archive: { status: "archived", action: "ARCHIVE" },
  "back-to-draft": { status: "draft", action: "RESTORE" },
  schedule: { status: "scheduled", action: "SCHEDULE" },
  "cancel-schedule": { status: "draft", action: "CANCEL_SCHEDULE" },
  "submit-for-review": { status: "review", action: "UPDATE" },
};

async function applyStatusTransition(
  contentId: string,
  intent: string,
  actorUserId: string,
  title: string
): Promise<ContentFormState | void> {
  if (intent === "save-draft") return;

  const transition = TRANSITION_AUDIT[intent];
  if (!transition) return;

  const supabase = await createClient();
  const { data: before } = await supabase.from("content").select("status").eq("id", contentId).maybeSingle();
  const statusBefore = before?.status ?? null;

  const update: ContentUpdate = { status: transition.status };
  if (transition.status === "published") update.published_at = new Date().toISOString();
  // Cancelling a schedule clears publish_at — it no longer represents an
  // active schedule, and leaving a stale future date on a draft would read
  // as though one were still pending.
  if (intent === "cancel-schedule") update.publish_at = null;

  // A WITH CHECK failure on UPDATE doesn't always surface as a thrown
  // Postgres error through PostgREST — a policy that matches the row for
  // USING but rejects the new values for WITH CHECK (exactly the shape of
  // content_update_own_draft, which permits editing a contributor's own
  // draft but never a transition INTO 'published') can instead just filter
  // the row out of the update silently: no `error`, but no row is
  // returned either. `.select("id")` here is what makes that distinguishable
  // from an accepted update — this was a real gap (confirmed empirically: a
  // contributor's publish attempt left the row unchanged, but the UI showed
  // no error at all) before this check existed.
  const { data, error } = await supabase.from("content").update(update).eq("id", contentId).select("id");
  if (error) return { error: describeError(error.message) };
  if (!data || data.length === 0) {
    return { error: "You don't have permission to do that with your current role." };
  }

  await logAuditEvent(supabase, {
    actorUserId,
    action: transition.action,
    entityType: "CONTENT",
    entityId: contentId,
    metadata: { title, status_before: statusBefore, status_after: transition.status },
  });
}

/** Standalone status-only transition, used by the content list's row actions (no full form there). */
export async function setContentStatusAction(contentId: string, status: "published" | "draft" | "archived") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — sign in again." };

  const { data: before } = await supabase.from("content").select("title, status").eq("id", contentId).maybeSingle();
  const statusBefore = before?.status ?? null;

  const update: ContentUpdate = { status };
  if (status === "published") update.published_at = new Date().toISOString();
  // Cancelling a schedule this way (the content list's quick action) clears
  // publish_at for the same reason applyStatusTransition's cancel-schedule
  // path does — a stale future date left on a draft would read as though a
  // schedule were still pending.
  if (status === "draft" && statusBefore === "scheduled") update.publish_at = null;

  const { data, error } = await supabase.from("content").update(update).eq("id", contentId).select("id");
  if (error) return { error: describeError(error.message) };
  if (!data || data.length === 0) {
    return { error: "You don't have permission to do that with your current role." };
  }

  // "draft" is reached from three different prior states with three
  // different meanings (§32): UNPUBLISH (was published), RESTORE (was
  // archived), CANCEL_SCHEDULE (was scheduled) — ContentRowActions itself
  // only ever passes the target status, so the prior status fetched above
  // is what disambiguates the audit action.
  const action: Database["public"]["Enums"]["audit_action"] =
    status === "published"
      ? "PUBLISH"
      : status === "archived"
        ? "ARCHIVE"
        : statusBefore === "archived"
          ? "RESTORE"
          : statusBefore === "scheduled"
            ? "CANCEL_SCHEDULE"
            : "UNPUBLISH";

  await logAuditEvent(supabase, {
    actorUserId: user.id,
    action,
    entityType: "CONTENT",
    entityId: contentId,
    metadata: { title: before?.title, status_before: statusBefore, status_after: status },
  });

  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/${contentId}`);
  revalidatePath("/");
  return { error: null };
}

/** Hard delete — RLS (content_delete_admin) restricts this to admin regardless of what the UI allows. */
export async function deleteContentAction(contentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — sign in again." };

  const { data, error } = await supabase.from("content").delete().eq("id", contentId).select("id, title");
  if (error) return { error: describeError(error.message) };
  if (!data || data.length === 0) {
    return { error: "You don't have permission to delete this — only admins can." };
  }

  await logAuditEvent(supabase, {
    actorUserId: user.id,
    action: "DELETE",
    entityType: "CONTENT",
    entityId: contentId,
    metadata: { title: data[0]?.title },
  });

  revalidatePath("/admin/content");
  return { error: null };
}

/**
 * Content revisions, scoped to the fields snapshotted by
 * writeContentRevision above — used by the revision panel in the content
 * editor (§9/§10 of the brief).
 */
export interface ContentRevisionRow {
  id: string;
  revision_number: number;
  editor_id: string | null;
  editor_name: string | null;
  created_at: string;
  snapshot: Record<string, unknown>;
}

export async function listContentRevisionsAction(contentId: string): Promise<ContentRevisionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_revisions")
    .select("id, revision_number, editor_id, created_at, snapshot, editor:editor_id ( full_name )")
    .eq("content_id", contentId)
    .order("revision_number", { ascending: false })
    .returns<
      {
        id: string;
        revision_number: number;
        editor_id: string | null;
        created_at: string;
        snapshot: Record<string, unknown>;
        editor: { full_name: string | null } | null;
      }[]
    >();

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    revision_number: row.revision_number,
    editor_id: row.editor_id,
    editor_name: row.editor?.full_name ?? null,
    created_at: row.created_at,
    snapshot: row.snapshot,
  }));
}

/**
 * Restores a prior revision's editable fields onto the CURRENT row —
 * status is deliberately left untouched (restoring an old draft-era
 * revision must never silently unpublish/republish something), and the
 * restore itself goes through the same update path as any other edit, so
 * it produces its own new revision — history only ever grows.
 */
export async function restoreContentRevisionAction(contentId: string, revisionId: string): Promise<ContentFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — sign in again." };

  const { data: revision, error: revisionError } = await supabase
    .from("content_revisions")
    .select("snapshot")
    .eq("id", revisionId)
    .eq("content_id", contentId)
    .maybeSingle();
  if (revisionError) return { error: describeError(revisionError.message) };
  if (!revision) return { error: "That revision no longer exists." };

  const snapshot = revision.snapshot as Record<string, unknown>;
  const { status: _status, ...editableFields } = snapshot;
  void _status;

  const { data: contentRow, error: contentError } = await supabase
    .from("content")
    .select("content_type, title")
    .eq("id", contentId)
    .maybeSingle();
  if (contentError) return { error: describeError(contentError.message) };
  if (!contentRow) return { error: "That content no longer exists." };

  const { data, error } = await supabase
    .from("content")
    .update(editableFields as ContentUpdate)
    .eq("id", contentId)
    .select("id");
  if (error) return { error: describeError(error.message) };
  if (!data || data.length === 0) {
    return { error: "You don't have permission to restore this revision." };
  }

  await writeContentRevision(supabase, contentId, contentRow.content_type, user.id, editableFields);
  await logAuditEvent(supabase, {
    actorUserId: user.id,
    action: "RESTORE",
    entityType: "CONTENT",
    entityId: contentId,
    metadata: { title: contentRow.title, restored_from_revision: revisionId },
  });

  revalidatePath(`/admin/content/${contentId}`);
  return { error: null, contentId };
}

/** Postgres/PostgREST errors are technical; RLS denials in particular should read as a permissions message, not a raw 42501. */
function describeError(message: string): string {
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "You don't have permission to do that with your current role.";
  }
  if (message.includes("duplicate key") && message.includes("content_slug_unique")) {
    return "That slug is already used by another item in this publication.";
  }
  return message;
}
