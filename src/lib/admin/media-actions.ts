"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth/session";
import { getPublicUrl, STORAGE_BUCKETS } from "@/lib/storage/buckets";
import { listMedia, type AdminMediaRow } from "@/lib/admin/queries";
import { logAuditEvent } from "@/lib/admin/audit";
import { MAX_FILE_SIZE_BYTES, isAllowedMimeType, MEDIA_UPLOAD_ERRORS } from "@/lib/admin/media-constants";

const MEDIA_ROW_SELECT = "id, bucket, storage_path, original_filename, alt_text, caption, mime_type, width, height, file_size_bytes, created_at";

export interface MediaActionResult {
  error: string | null;
  media?: AdminMediaRow;
}

/** Postgres/PostgREST errors are technical; RLS denials in particular should read as a permissions message. */
function describeError(message: string): string {
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "You don't have permission to do that with your current role.";
  }
  return message;
}

/**
 * Stricter than describeError above: used only by the two direct-upload
 * actions below, whose Storage-side errors are more likely to echo internal
 * details (bucket ids, storage paths, provider-specific wording) that
 * shouldn't reach an editor's screen even indirectly. The one recognizable,
 * safe-to-show case is a permissions denial; everything else collapses to
 * whichever MEDIA_UPLOAD_ERRORS message the caller passes as `fallback` —
 * specific to what step failed, never the raw error. The real text always
 * still goes to the server log the caller already writes via console.error
 * before calling this.
 */
function describeUploadError(message: string, fallback: string): string {
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return MEDIA_UPLOAD_ERRORS.PERMISSION_DENIED;
  }
  return fallback;
}

export interface CreateMediaUploadUrlInput {
  filename: string;
  mimeType: string;
  fileSize: number;
  bucket: "public" | "private";
}

export interface CreateMediaUploadUrlResult {
  error: string | null;
  signedUrl?: string;
  token?: string;
  path?: string;
  bucket?: "public" | "private";
}

/**
 * Step 1 of the direct-to-Storage upload flow (see docs/architecture.md-
 * adjacent design discussion): issues a short-lived, path-scoped Storage
 * upload authorization instead of accepting the file itself, so the actual
 * binary never has to pass through a Server Action (and therefore never
 * hits Vercel's ~4.5MB function payload limit, which is what made the old
 * single-request uploadMediaAction unable to reach this app's real 25MB
 * limit in production).
 *
 * `createSignedUploadUrl` requires exactly the `insert` permission on
 * `storage.objects` per the Supabase SDK's own documented contract — i.e.
 * this call is gated by the *existing* media_private_write/media_public_write
 * RLS policies (20260812011200_storage_buckets.sql), unchanged. A viewer or
 * signed-out caller is refused here and never receives a token.
 *
 * The size/MIME checks here are defense-in-depth against a client that
 * skipped its own pre-check or is lying — the real, unbypassable ceiling is
 * the bucket's own file_size_limit/allowed_mime_types
 * (20260812020100_harden_storage_buckets.sql), enforced by Storage itself
 * at upload time regardless of what this action believes.
 */
export async function createMediaUploadUrlAction(input: CreateMediaUploadUrlInput): Promise<CreateMediaUploadUrlResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: MEDIA_UPLOAD_ERRORS.SESSION_EXPIRED_BEFORE_UPLOAD };

  if (!input.filename || input.fileSize <= 0) {
    return { error: MEDIA_UPLOAD_ERRORS.NO_FILE };
  }
  if (!isAllowedMimeType(input.mimeType)) {
    return { error: MEDIA_UPLOAD_ERRORS.UNSUPPORTED_TYPE };
  }
  if (input.fileSize > MAX_FILE_SIZE_BYTES) {
    return { error: MEDIA_UPLOAD_ERRORS.FILE_TOO_LARGE };
  }

  const bucketId = input.bucket === "public" ? "media-public" : "media-private";
  const extension = input.filename.split(".").pop() || "bin";
  const storagePath = `uploads/${crypto.randomUUID()}.${extension}`;

  const { data, error } = await supabase.storage.from(bucketId).createSignedUploadUrl(storagePath);
  if (error) {
    console.error("createMediaUploadUrlAction: createSignedUploadUrl failed:", error.message);
    return { error: describeUploadError(error.message, MEDIA_UPLOAD_ERRORS.SIGNED_URL_FAILED) };
  }

  return { error: null, signedUrl: data.signedUrl, token: data.token, path: storagePath, bucket: input.bucket };
}

export interface CompleteMediaUploadInput {
  path: string;
  bucket: "public" | "private";
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  altText: string | null;
  caption: string | null;
}

/**
 * Step 3 (after the browser has PUT the file straight to Storage using the
 * signed URL from createMediaUploadUrlAction, step 2) — records the
 * public.media row, exactly the way uploadMediaAction used to after its own
 * (server-mediated) upload, and keeps the same rollback behavior: an insert
 * failure deletes the just-uploaded Storage object rather than leaving an
 * unreferenced file behind.
 *
 * Two checks exist here that the old single-request flow never needed,
 * because the file now arrives via a step this action didn't witness:
 *  - `list()` confirms an object genuinely exists at `path` before trusting
 *    it — closes "insert a row pointing at nothing."
 *  - a pre-existing `media` row for the same `path` is refused — closes a
 *    second/duplicate claim of the same upload.
 * See the design discussion's "arbitrary public.media record" section for
 * the reasoning and its accepted residual risk.
 */
export async function completeMediaUploadAction(input: CompleteMediaUploadInput): Promise<MediaActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: MEDIA_UPLOAD_ERRORS.SESSION_EXPIRED_BEFORE_SAVE };
  }

  if (!isAllowedMimeType(input.mimeType)) {
    return { error: MEDIA_UPLOAD_ERRORS.UNSUPPORTED_TYPE };
  }
  if (input.fileSize > MAX_FILE_SIZE_BYTES) {
    return { error: MEDIA_UPLOAD_ERRORS.FILE_TOO_LARGE };
  }
  // Storage paths are always this action's/createMediaUploadUrlAction's own
  // `uploads/<uuid>.<ext>` convention — anything else was never legitimately
  // issued by this app.
  if (!/^uploads\/[0-9a-fA-F-]{36}\.[A-Za-z0-9]+$/.test(input.path)) {
    return { error: MEDIA_UPLOAD_ERRORS.INVALID_REFERENCE };
  }

  const bucketId = input.bucket === "public" ? "media-public" : "media-private";
  const folder = input.path.includes("/") ? input.path.split("/").slice(0, -1).join("/") : undefined;
  const filenamePart = input.path.split("/").pop() ?? input.path;

  const { data: listing, error: listError } = await supabase.storage.from(bucketId).list(folder, { search: filenamePart });
  if (listError) {
    console.error("completeMediaUploadAction: list() failed:", listError.message);
    return { error: describeUploadError(listError.message, MEDIA_UPLOAD_ERRORS.VERIFY_FAILED) };
  }
  if (!listing.some((entry) => entry.name === filenamePart)) {
    return { error: MEDIA_UPLOAD_ERRORS.OBJECT_NOT_FOUND };
  }

  const { data: alreadyClaimed, error: claimCheckError } = await supabase
    .from("media")
    .select("id")
    .eq("storage_path", input.path)
    .maybeSingle();
  if (claimCheckError) {
    console.error("completeMediaUploadAction: duplicate-claim check failed:", claimCheckError.message);
    return { error: describeUploadError(claimCheckError.message, MEDIA_UPLOAD_ERRORS.VERIFY_FAILED) };
  }
  if (alreadyClaimed) {
    return { error: MEDIA_UPLOAD_ERRORS.ALREADY_SAVED };
  }

  const { data, error: insertError } = await supabase
    .from("media")
    .insert({
      bucket: input.bucket,
      storage_path: input.path,
      original_filename: input.originalFilename || null,
      mime_type: input.mimeType,
      file_size_bytes: input.fileSize,
      // width/height are left null — no image-decoding library in this server
      // runtime, and every consumer (next/image `fill` + a fixed aspect-ratio
      // container) doesn't depend on intrinsic dimensions to render correctly.
      alt_text: input.altText,
      caption: input.caption,
      uploaded_by: user.id,
    })
    .select(MEDIA_ROW_SELECT)
    .single();

  if (insertError) {
    // Roll back the orphaned upload rather than leaving an unreferenced file
    // — same behavior uploadMediaAction always had for this exact case. The
    // rollback happens regardless of which message describeUploadError
    // picks — SAVE_FAILED's wording ("the file was uploaded, but...") stays
    // accurate even though this line makes that true only briefly: it was
    // genuinely in Storage the moment this insert failed.
    await supabase.storage.from(bucketId).remove([input.path]);
    console.error("completeMediaUploadAction: insert failed:", insertError.message);
    return { error: describeUploadError(insertError.message, MEDIA_UPLOAD_ERRORS.SAVE_FAILED) };
  }

  await logAuditEvent(supabase, {
    actorUserId: user.id,
    action: "UPLOAD",
    entityType: "MEDIA",
    entityId: data.id,
    metadata: { filename: data.original_filename, bucket: data.bucket },
  });

  revalidatePath("/admin/media");

  return {
    error: null,
    media: { ...data, url: data.bucket === "public" ? getPublicUrl(supabase, data.storage_path) : null },
  };
}

export async function searchMediaAction(query?: string, bucket?: "public" | "private"): Promise<AdminMediaRow[]> {
  return listMedia(query, bucket);
}

export async function updateMediaAction(
  id: string,
  fields: { alt_text?: string | null; caption?: string | null }
): Promise<MediaActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — sign in again." };

  // media_write requires contributor+ for both USING and WITH CHECK — a
  // rejected update filters the row out silently (0 rows, no thrown error)
  // rather than throwing, same as every other admin mutation. `.select("id")`
  // is what makes that detectable — see content-actions.ts's applyStatusTransition
  // for the fuller explanation of why this matters.
  const { data, error } = await supabase.from("media").update(fields).eq("id", id).select("id");
  if (error) return { error: describeError(error.message) };
  if (!data || data.length === 0) {
    return { error: "You don't have permission to do that with your current role." };
  }

  await logAuditEvent(supabase, { actorUserId: user.id, action: "UPDATE", entityType: "MEDIA", entityId: id, metadata: fields });

  revalidatePath("/admin/media");
  return { error: null };
}

export interface MediaUsageRow {
  type: "cover image" | "contributor portrait" | "publication cover" | "inline image";
  title: string;
  href: string;
}

/**
 * Determines what currently references a media row before a delete is
 * allowed to proceed, so the UI can warn instead of silently breaking a
 * live reference. Cover/avatar/publication-cover references are simple
 * foreign-key columns; inline image/gallery blocks live inside content's
 * JSON body, which PostgREST can't filter on directly, so those rows are
 * scanned in application code — acceptable at this CMS's scale, and far
 * simpler than a fragile jsonb-containment query.
 */
export async function getMediaUsageAction(id: string): Promise<MediaUsageRow[]> {
  const supabase = await createClient();
  const usage: MediaUsageRow[] = [];

  const [coverResult, avatarResult, pubCoverResult, bodyResult] = await Promise.all([
    supabase.from("content").select("id, title, slug").eq("cover_media_id", id),
    supabase.from("authors").select("id, name, slug").eq("avatar_media_id", id),
    supabase.from("publications").select("id, title, slug").eq("cover_media_id", id),
    supabase.from("content").select("id, title, slug, body"),
  ]);

  for (const row of coverResult.data ?? []) {
    usage.push({ type: "cover image", title: row.title, href: `/admin/content/${row.id}` });
  }
  for (const row of avatarResult.data ?? []) {
    usage.push({ type: "contributor portrait", title: row.name, href: `/admin/contributors/${row.id}` });
  }
  for (const row of pubCoverResult.data ?? []) {
    usage.push({ type: "publication cover", title: row.title, href: `/admin/publications` });
  }
  for (const row of bodyResult.data ?? []) {
    const body = row.body as { blocks?: Array<{ type: string; mediaId?: string; mediaIds?: string[] }> } | null;
    const referenced = (body?.blocks ?? []).some(
      (block) => block.mediaId === id || (Array.isArray(block.mediaIds) && block.mediaIds.includes(id))
    );
    if (referenced) usage.push({ type: "inline image", title: row.title, href: `/admin/content/${row.id}` });
  }

  return usage;
}

/**
 * Deletes the DB row before the Storage object (not after) — if the row
 * delete fails, nothing changes; if the Storage delete then fails, the
 * result is an orphaned file with no reference anywhere, which is inert
 * rather than a broken image reference still pointing at a missing file.
 * Callers are expected to have already surfaced getMediaUsageAction's
 * results and gotten explicit confirmation — this action itself doesn't
 * re-check usage, matching the brief's "Delete anyway" override.
 *
 * Admin-only, matching the brief's security section verbatim ("only admins
 * delete media") — checked here at the application layer, and also the
 * real boundary via media_delete (20260814010000_media_admin_only_delete_and_promote.sql),
 * which replaced the previous contributor+ media_write policy's DELETE grant.
 */
export async function deleteMediaAction(id: string, bucket: "public" | "private", storagePath: string) {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    return { error: "Only admins can delete media." };
  }

  const supabase = await createClient();

  const { data, error: deleteRowError } = await supabase.from("media").delete().eq("id", id).select("id, original_filename");
  if (deleteRowError) return { error: describeError(deleteRowError.message) };
  if (!data || data.length === 0) {
    return { error: "You don't have permission to delete this — only admins can." };
  }

  const bucketId = bucket === "public" ? "media-public" : "media-private";
  await supabase.storage.from(bucketId).remove([storagePath]);

  await logAuditEvent(supabase, {
    actorUserId: session.userId,
    action: "DELETE",
    entityType: "MEDIA",
    entityId: id,
    metadata: { filename: data[0]?.original_filename, bucket },
  });

  revalidatePath("/admin/media");
  return { error: null };
}

/**
 * The Private -> Public promotion contract: download the private object,
 * upload it into the public bucket, confirm that succeeded, THEN flip the
 * media row's bucket — never the other way around, so a failure partway
 * through never leaves the database pointing at an object that doesn't
 * actually exist in the bucket it claims. The row's id and storage_path
 * stay the same (only `bucket` changes), so every existing reference
 * (cover_media_id, avatar_media_id, block mediaId) keeps working with no
 * further changes needed anywhere else. Deleting the old private copy is
 * attempted last and its failure is tolerated — a leftover private object
 * is an inert orphan, not a correctness problem.
 *
 * Explicitly admin-only at the application layer, matching the brief's
 * security section verbatim ("only admins promote private media") — this
 * is also enforced at the real boundary by prevent_media_bucket_change
 * (20260814010000_media_admin_only_delete_and_promote.sql), a trigger that
 * blocks any non-admin from changing `bucket` on public.media directly, so
 * this action is the only path that can ever move something into 'public'.
 */
export async function promoteMediaAction(id: string): Promise<MediaActionResult> {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    return { error: "Only admins can promote media to public." };
  }

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("media")
    .select(MEDIA_ROW_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return { error: describeError(fetchError.message) };
  if (!existing) return { error: "That media item no longer exists." };
  if (existing.bucket === "public") return { error: "This item is already public." };

  const { data: fileData, error: downloadError } = await supabase.storage
    .from(STORAGE_BUCKETS.private)
    .download(existing.storage_path);
  if (downloadError || !fileData) {
    return { error: `Couldn't read the private file to promote it: ${downloadError?.message ?? "unknown error"}` };
  }

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.public)
    .upload(existing.storage_path, fileData, {
      contentType: existing.mime_type ?? undefined,
      upsert: false,
    });
  if (uploadError) {
    return { error: `Couldn't write the public copy: ${uploadError.message}` };
  }

  // Confirm the public object is actually readable before touching the
  // database — this is the step that keeps a failed promotion from ever
  // leaving the row claiming 'public' for an object that isn't really there.
  const { data: verifyData, error: verifyError } = await supabase.storage
    .from(STORAGE_BUCKETS.public)
    .list(existing.storage_path.split("/").slice(0, -1).join("/") || undefined, {
      search: existing.storage_path.split("/").pop(),
    });
  if (verifyError || !verifyData || verifyData.length === 0) {
    await supabase.storage.from(STORAGE_BUCKETS.public).remove([existing.storage_path]);
    return { error: "Promotion failed verification — the public copy could not be confirmed. Nothing was changed." };
  }

  const { data: updated, error: updateError } = await supabase
    .from("media")
    .update({ bucket: "public" })
    .eq("id", id)
    .select(MEDIA_ROW_SELECT)
    .single();
  if (updateError || !updated) {
    // Roll back the public copy so we don't leave an orphaned public object
    // for a row that's still marked private.
    await supabase.storage.from(STORAGE_BUCKETS.public).remove([existing.storage_path]);
    return { error: "Couldn't update the media record after promoting the file. Nothing is public yet." };
  }

  // Best-effort cleanup of the now-superseded private copy — a leftover
  // private object is harmless, so its failure isn't reported as an error.
  await supabase.storage.from(STORAGE_BUCKETS.private).remove([existing.storage_path]);

  await logAuditEvent(supabase, {
    actorUserId: session.userId,
    action: "PROMOTE",
    entityType: "MEDIA",
    entityId: id,
    metadata: { filename: existing.original_filename, bucket_before: "private", bucket_after: "public" },
  });

  revalidatePath("/admin/media");
  return { error: null, media: { ...updated, url: getPublicUrl(supabase, updated.storage_path) } };
}

/**
 * Replaces the underlying file for an existing media row while preserving
 * its id — every existing reference (cover_media_id, avatar_media_id, block
 * mediaId) keeps pointing at the same row, so nothing else needs updating.
 * The new file is uploaded to a fresh path in the row's CURRENT bucket
 * first (so a failed upload never touches the working object), the row is
 * then repointed at the new path, and only then is the old object removed.
 * Replacement never changes public/private status — a public item replaced
 * stays public, a private item replaced stays private; promotion is a
 * separate, explicit step.
 */
export async function replaceMediaAction(id: string, formData: FormData): Promise<MediaActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — sign in again." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a replacement file." };
  if (!isAllowedMimeType(file.type)) return { error: "Only JPEG, PNG, or WebP images are supported here." };
  if (file.size > MAX_FILE_SIZE_BYTES) return { error: "That file is larger than the 25MB limit." };

  const { data: existing, error: fetchError } = await supabase
    .from("media")
    .select(MEDIA_ROW_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return { error: describeError(fetchError.message) };
  if (!existing) return { error: "That media item no longer exists." };

  const bucketId = existing.bucket === "public" ? STORAGE_BUCKETS.public : STORAGE_BUCKETS.private;
  const extension = file.name.split(".").pop() || "bin";
  const newStoragePath = `uploads/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(bucketId).upload(newStoragePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  const { data: updated, error: updateError } = await supabase
    .from("media")
    .update({
      storage_path: newStoragePath,
      original_filename: file.name || null,
      mime_type: file.type,
      file_size_bytes: file.size,
      width: null,
      height: null,
    })
    .eq("id", id)
    .select(MEDIA_ROW_SELECT)
    .single();
  if (updateError || !updated) {
    await supabase.storage.from(bucketId).remove([newStoragePath]);
    return { error: "You don't have permission to replace this — it may not be editable in your role." };
  }

  // Best-effort: the new object is already live and referenced, so a failure
  // here just leaves a harmless orphaned copy of the old file.
  await supabase.storage.from(bucketId).remove([existing.storage_path]);

  await logAuditEvent(supabase, {
    actorUserId: user.id,
    action: "REPLACE",
    entityType: "MEDIA",
    entityId: id,
    metadata: { filename_before: existing.original_filename, filename_after: file.name },
  });

  revalidatePath("/admin/media");
  return {
    error: null,
    media: { ...updated, url: updated.bucket === "public" ? getPublicUrl(supabase, updated.storage_path) : null },
  };
}
