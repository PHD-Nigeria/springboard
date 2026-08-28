import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cleans up Storage objects left behind by an upload that reached Storage
 * (browser -> Supabase, direct) but never reached step 3 of
 * src/lib/admin/media-upload-client.ts's completeMediaUploadAction — the
 * one gap a two-phase browser-driven upload can't close synchronously
 * (e.g. the editor closes the tab between the two steps). See the
 * direct-upload design discussion's "Cleanup" section.
 *
 * Same shape as publish-scheduled/route.ts: CRON_SECRET-gated, GET (Vercel
 * Cron) and POST (manual/scripted) both supported, service-role client
 * because this has to see every object across every uploader, not just the
 * caller's own — the one legitimate use for it, per admin.ts's own
 * doc comment.
 *
 * GRACE_PERIOD_MS keeps this from ever racing a legitimate, still-in-flight
 * upload: an object has to be untouched for a full day, comfortably past
 * both the few seconds a normal upload takes and the 2-hour lifetime of the
 * signed upload URL that created it, before it's considered abandoned
 * rather than just recent.
 */
const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;
const BUCKETS = ["media-public", "media-private"] as const;
const LIST_PAGE_SIZE = 1000;

interface CleanupSummary {
  bucket: string;
  scanned: number;
  deleted: number;
  deletedPaths: string[];
}

async function listAllObjects(
  supabase: ReturnType<typeof createAdminClient>,
  bucket: string
): Promise<{ name: string; created_at: string | null }[]> {
  const all: { name: string; created_at: string | null }[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list("uploads", {
      limit: LIST_PAGE_SIZE,
      offset,
      sortBy: { column: "created_at", order: "asc" },
    });
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const entry of data) {
      // Folders have id === null; every real upload is a flat file directly
      // under uploads/, matching the uploads/<uuid>.<ext> convention both
      // the old and new upload paths always used.
      if (entry.id !== null) all.push({ name: `uploads/${entry.name}`, created_at: entry.created_at });
    }

    if (data.length < LIST_PAGE_SIZE) break;
    offset += LIST_PAGE_SIZE;
  }

  return all;
}

async function cleanupBucket(supabase: ReturnType<typeof createAdminClient>, bucket: string): Promise<CleanupSummary> {
  const objects = await listAllObjects(supabase, bucket);
  const cutoff = Date.now() - GRACE_PERIOD_MS;

  const candidates = objects.filter((obj) => {
    if (!obj.created_at) return false; // never old enough to trust deleting without a timestamp
    return new Date(obj.created_at).getTime() < cutoff;
  });

  if (candidates.length === 0) {
    return { bucket, scanned: objects.length, deleted: 0, deletedPaths: [] };
  }

  const { data: referenced, error: mediaError } = await supabase
    .from("media")
    .select("storage_path")
    .eq("bucket", bucket === "media-public" ? "public" : "private")
    .in(
      "storage_path",
      candidates.map((c) => c.name)
    );
  if (mediaError) throw mediaError;

  const referencedPaths = new Set((referenced ?? []).map((row) => row.storage_path));
  const orphaned = candidates.filter((c) => !referencedPaths.has(c.name)).map((c) => c.name);

  if (orphaned.length === 0) {
    return { bucket, scanned: objects.length, deleted: 0, deletedPaths: [] };
  }

  const { error: removeError } = await supabase.storage.from(bucket).remove(orphaned);
  if (removeError) throw removeError;

  return { bucket, scanned: objects.length, deleted: orphaned.length, deletedPaths: orphaned };
}

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const results: CleanupSummary[] = [];

  for (const bucket of BUCKETS) {
    try {
      results.push(await cleanupBucket(supabase, bucket));
    } catch (err) {
      console.error("cleanup-orphaned-media: failed for bucket", bucket, err instanceof Error ? err.message : err);
      return NextResponse.json({ error: `Cleanup failed for bucket ${bucket}.`, results }, { status: 500 });
    }
  }

  return NextResponse.json({
    totalDeleted: results.reduce((sum, r) => sum + r.deleted, 0),
    results,
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
