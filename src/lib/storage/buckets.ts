import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The two Storage buckets created in
 * supabase/migrations/20260812011200_storage_buckets.sql. Media rows record
 * which bucket they currently live in via `media.bucket`.
 */
export const STORAGE_BUCKETS = {
  public: "media-public",
  private: "media-private",
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/**
 * Signed URL for previewing a private-bucket file (draft/review media).
 * Only ever call this with a server client belonging to an authenticated
 * contributor/editor/admin session — the private bucket's storage policy
 * enforces that independently, but callers shouldn't rely on that alone.
 */
export async function getSignedPrivateUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds = 60 * 10
) {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.private)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}

/** Lifetime of the signed URLs the admin content preview uses to show private images to signed-in staff. */
export const PRIVATE_PREVIEW_URL_TTL_SECONDS = 300;

/**
 * True for a Supabase Storage *signed* URL. next/image must not run these through its optimizer: they aren't
 * covered by images.remotePatterns, and the optimizer would also keep a cached copy of a private image that
 * outlives the token — so images with a signed URL are loaded by the browser straight from Storage instead.
 */
export function isSignedStorageUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && url.includes("/storage/v1/object/sign/");
}

/**
 * Public URL for a published media file. No signing needed — the bucket
 * itself is public.
 */
export function getPublicUrl(supabase: SupabaseClient, storagePath: string) {
  const { data } = supabase.storage.from(STORAGE_BUCKETS.public).getPublicUrl(storagePath);
  return data.publicUrl;
}
