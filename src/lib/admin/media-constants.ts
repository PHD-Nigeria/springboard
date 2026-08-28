/**
 * Single source of truth for media-upload limits, shared between server
 * code (createMediaUploadUrlAction/completeMediaUploadAction) and client
 * code (the upload orchestrator's pre-check, MediaLibrary/MediaPicker's
 * `accept` attributes) — previously these lived only inside
 * media-actions.ts, duplicated nowhere, but the direct-upload architecture
 * needs the exact same values on both sides of the network boundary, so
 * they're pulled out here rather than copied. No "use server"/"server-only"
 * here deliberately: this file must be importable from Client Components.
 */

export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

// Matches the media-public/media-private Storage buckets' own file_size_limit
// (see supabase/migrations/20260812020100_harden_storage_buckets.sql) — kept
// in sync manually since Storage bucket config isn't introspectable at build
// time; the bucket's own limit is still the real, unbypassable enforcement
// point (see completeMediaUploadAction's doc comment).
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Every user-facing message the direct upload flow can show, in one place —
 * used by both the client pre-check (media-upload-client.ts) and every
 * server-side check that mirrors it (media-actions.ts's
 * createMediaUploadUrlAction/completeMediaUploadAction), so the same failure
 * always reads the same way regardless of which side of the network
 * boundary caught it first.
 *
 * Each one is deliberately self-contained: what happened, whether the file
 * ended up in the Media Library, and what to do next — never a raw
 * Supabase/Postgres message, a stack trace, or anything else that belongs
 * only in a server log. Where the underlying cause is genuinely one this
 * app can't distinguish safely (a name collision with "unexpected" below),
 * UNEXPECTED is the deliberately generic fallback — never a raw error string.
 */
export const MEDIA_UPLOAD_ERRORS = {
  NO_FILE: "Choose a file to upload.",
  FILE_TOO_LARGE: "This file is too large. Springboard accepts files up to 25MB — please choose a smaller file.",
  UNSUPPORTED_TYPE: "This file type isn't supported. Springboard accepts JPEG, PNG, or WebP images — please choose one of those.",
  SESSION_EXPIRED_BEFORE_UPLOAD: "Your session has expired. Sign in again, then try uploading your file.",
  SESSION_EXPIRED_BEFORE_SAVE:
    "Your session expired before this upload could be saved. The file wasn't added to the Media Library — sign in again, then try uploading it once more.",
  PERMISSION_DENIED: "You don't have permission to upload media. Contact an Editor or Administrator if you believe you should have access.",
  SIGNED_URL_FAILED: "We couldn't prepare this upload. The file wasn't added to the Media Library — please try again. If the problem continues, contact the technical team.",
  STORAGE_NETWORK_FAILURE:
    "We couldn't upload this file because the connection was interrupted. The file wasn't added to the Media Library — check your connection and try again.",
  STORAGE_UPLOAD_FAILED:
    "We couldn't upload this file to storage. The file wasn't added to the Media Library — please try again. If the problem continues, contact the technical team.",
  VERIFY_FAILED:
    "We couldn't confirm this upload finished. The file wasn't added to the Media Library — please try again. If the problem continues, contact the technical team.",
  OBJECT_NOT_FOUND: "We couldn't find the uploaded file — it may not have finished uploading. Please try uploading it again.",
  ALREADY_SAVED: "This file has already been saved to the Media Library — no need to upload it again.",
  SAVE_FAILED:
    "The file was uploaded, but Springboard couldn't finish saving it to the Media Library. Please try again. If the problem continues, contact the technical team.",
  INVALID_REFERENCE: "That upload reference isn't valid. The file wasn't added to the Media Library — please try uploading it again.",
  UNEXPECTED: "Something went wrong while uploading this file. Please try again. If the problem continues, contact the technical team.",
} as const;

/** Every one of these is safe to retry — a fresh attempt always gets a brand-new Storage path, so retrying never risks a collision or a duplicate upload. */
export const RETRYABLE_MEDIA_UPLOAD_ERRORS: readonly string[] = [
  MEDIA_UPLOAD_ERRORS.FILE_TOO_LARGE,
  MEDIA_UPLOAD_ERRORS.UNSUPPORTED_TYPE,
  MEDIA_UPLOAD_ERRORS.SESSION_EXPIRED_BEFORE_UPLOAD,
  MEDIA_UPLOAD_ERRORS.SESSION_EXPIRED_BEFORE_SAVE,
  MEDIA_UPLOAD_ERRORS.PERMISSION_DENIED,
  MEDIA_UPLOAD_ERRORS.SIGNED_URL_FAILED,
  MEDIA_UPLOAD_ERRORS.STORAGE_NETWORK_FAILURE,
  MEDIA_UPLOAD_ERRORS.STORAGE_UPLOAD_FAILED,
  MEDIA_UPLOAD_ERRORS.VERIFY_FAILED,
  MEDIA_UPLOAD_ERRORS.OBJECT_NOT_FOUND,
  MEDIA_UPLOAD_ERRORS.SAVE_FAILED,
  MEDIA_UPLOAD_ERRORS.INVALID_REFERENCE,
  MEDIA_UPLOAD_ERRORS.UNEXPECTED,
];
