"use client";

import { createClient } from "@/lib/supabase/client";
import { createMediaUploadUrlAction, completeMediaUploadAction, type MediaActionResult } from "@/lib/admin/media-actions";
import { MAX_FILE_SIZE_BYTES, isAllowedMimeType, MEDIA_UPLOAD_ERRORS, RETRYABLE_MEDIA_UPLOAD_ERRORS } from "@/lib/admin/media-constants";

/**
 * The one place that runs the direct-to-Storage upload sequence — both
 * MediaLibrary.tsx (the Media Library's own upload form) and
 * MediaPicker.tsx (every "choose an image" spot elsewhere in the admin)
 * call this instead of duplicating the three-step flow each. Not marked
 * "use server": this deliberately runs in the browser so step 2 can reach
 * Supabase Storage directly, never through a Vercel Function — that's the
 * entire point (see the design discussion this implements).
 *
 *   1. createMediaUploadUrlAction — Server Action, JSON only, issues a
 *      signed upload URL (RLS-gated exactly like today's upload was).
 *   2. supabase.storage.uploadToSignedUrl — browser straight to Storage.
 *   3. completeMediaUploadAction — Server Action, JSON only, records the
 *      public.media row and rolls back the Storage object if that fails.
 *
 * Every failure exit below returns a message from MEDIA_UPLOAD_ERRORS —
 * never a raw Supabase/Postgres error, a stack trace, or anything else an
 * editor shouldn't see — and every one of them leaves the caller free to
 * call this again immediately: a fresh attempt always mints a brand-new
 * Storage path in step 1, so there's never a stale, half-finished upload
 * left blocking a retry.
 */

export type MediaUploadStage = "preparing" | "uploading" | "saving";

export interface MediaUploadOptions {
  altText?: string;
  caption?: string;
  /** Matches the existing convention: every upload defaults to private until an explicit Promote step. */
  bucket?: "public" | "private";
  onStageChange?: (stage: MediaUploadStage) => void;
}

/** Whether a message this module (or completeMediaUploadAction/createMediaUploadUrlAction) returned is safe to offer a "Try again" for — everything except "already saved", where retrying would just create a second copy rather than fix anything. */
export function isRetryableMediaUploadError(message: string): boolean {
  return RETRYABLE_MEDIA_UPLOAD_ERRORS.includes(message);
}

export async function uploadMediaDirect(file: File | null | undefined, options: MediaUploadOptions = {}): Promise<MediaActionResult> {
  const { altText = "", caption = "", bucket = "private", onStageChange } = options;

  // Instant, no-network-call pre-check — the same rules the server
  // re-validates in createMediaUploadUrlAction/completeMediaUploadAction,
  // whose checks (and ultimately the Storage bucket's own file_size_limit/
  // allowed_mime_types) are the checks that actually can't be bypassed.
  if (!file || file.size === 0) {
    return { error: MEDIA_UPLOAD_ERRORS.NO_FILE };
  }
  if (!isAllowedMimeType(file.type)) {
    return { error: MEDIA_UPLOAD_ERRORS.UNSUPPORTED_TYPE };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: MEDIA_UPLOAD_ERRORS.FILE_TOO_LARGE };
  }

  // --- Step 1: ask the server to prepare a signed upload URL. ---
  let prepared;
  try {
    onStageChange?.("preparing");
    prepared = await createMediaUploadUrlAction({
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      bucket,
    });
  } catch (err) {
    // The Server Action call itself never reached the server (offline,
    // request dropped, etc.) — createMediaUploadUrlAction's own try/catch
    // only covers failures *inside* that function; this is the boundary
    // failing before it ever ran, so nothing was uploaded and nothing needs
    // rolling back.
    console.error("media upload: createMediaUploadUrlAction call failed", err instanceof Error ? err.message : err);
    return { error: MEDIA_UPLOAD_ERRORS.SIGNED_URL_FAILED };
  }
  if (prepared.error || !prepared.signedUrl || !prepared.token || !prepared.path) {
    return { error: prepared.error ?? MEDIA_UPLOAD_ERRORS.SIGNED_URL_FAILED };
  }

  // --- Step 2: the browser uploads straight to Storage. ---
  onStageChange?.("uploading");
  const supabase = createClient();
  const bucketId = prepared.bucket === "public" ? "media-public" : "media-private";
  let storageError: { message: string } | null;
  try {
    // Never log the raw error/response here — a failed-upload error object
    // can carry the request URL, which embeds the one-time signed token as
    // a query parameter (see createSignedUploadUrl's own response shape).
    // Logging only a fixed string is what keeps that token out of any log.
    ({ error: storageError } = await supabase.storage
      .from(bucketId)
      .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type }));
  } catch {
    // The PUT itself never completed — a real connectivity failure (offline,
    // dropped connection, DNS, timeout), distinct from Storage responding
    // with an actual rejection (handled just below).
    console.error("media upload: the direct Storage upload could not be reached");
    return { error: MEDIA_UPLOAD_ERRORS.STORAGE_NETWORK_FAILURE };
  }
  if (storageError) {
    console.error("media upload: Storage rejected the upload");
    return { error: MEDIA_UPLOAD_ERRORS.STORAGE_UPLOAD_FAILED };
  }

  // --- Step 3: ask the server to verify and record it. ---
  onStageChange?.("saving");
  try {
    return await completeMediaUploadAction({
      path: prepared.path,
      bucket, // the bucket this whole call was made for — same value createMediaUploadUrlAction echoed back in prepared.bucket
      originalFilename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      altText: altText.trim() || null,
      caption: caption.trim() || null,
    });
  } catch (err) {
    // Same boundary case as step 1's catch: the file is genuinely sitting in
    // Storage at this point (step 2 already succeeded), just not yet
    // confirmed saved to the Media Library — SAVE_FAILED is accurate either
    // way, whether completeMediaUploadAction ran and failed internally (it
    // already returns SAVE_FAILED itself for that) or never got a response
    // at all (this catch).
    console.error("media upload: completeMediaUploadAction call failed", err instanceof Error ? err.message : err);
    return { error: MEDIA_UPLOAD_ERRORS.SAVE_FAILED };
  }
}
