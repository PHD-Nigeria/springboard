import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/admin/audit";

/**
 * Executes the scheduled → published transition (§15 of the Phase 4D
 * brief). Not called by anything on a timer in this environment — see
 * docs/architecture.md's Phase 4D section for why (no deployed cron
 * infrastructure exists yet; `vercel.json` declares the intended trigger
 * for whenever this project is actually deployed to Vercel). Until then,
 * this is invoked manually (an admin, a test script, or any external
 * scheduler pointed at it with the right secret) — which is exactly how
 * the brief's own testing section describes verifying it.
 *
 * IMPORTANT: this is the one legitimate use of the service-role client
 * anywhere in this codebase's admin surface. Every other admin mutation
 * runs through the cookie-based, RLS-subject client because there's a
 * human session to be subject to; a cron trigger has no session at all —
 * exactly the case admin.ts's own doc comment reserves it for.
 *
 * Public visibility for scheduled content that's already past its
 * publish_at is already correct without this ever running (every public
 * RLS policy treats `scheduled AND publish_at <= now()` as visible — see
 * §5) — this job's job is administrative: flip the stored `status` column
 * so admin views stop showing stale "Scheduled" state, and write the
 * PUBLISH audit event. It is naturally idempotent: the query only matches
 * rows still literally in `status = 'scheduled'`, so a row this job just
 * published is never matched again by a second run — no duplicate
 * content, no duplicate audit events.
 *
 * Handles both GET and POST: Vercel Cron Jobs invoke via GET (and send
 * `Authorization: Bearer $CRON_SECRET` automatically when a `CRON_SECRET`
 * env var is set on the project) — POST is kept too for manual/scripted
 * invocation (curl, Playwright tests), which reads more naturally as a
 * trigger than a GET does.
 */
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
  const nowIso = new Date().toISOString();

  const { data: due, error: selectError } = await supabase
    .from("content")
    .select("id, title")
    .eq("status", "scheduled")
    .lte("publish_at", nowIso);

  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }
  if (!due || due.length === 0) {
    return NextResponse.json({ published: [], count: 0 });
  }

  const publishedIds: string[] = [];
  for (const row of due) {
    // One row at a time, re-checked by id + still-scheduled: if two
    // overlapping runs ever raced (they won't, in this single-instance
    // setup, but the check costs nothing), the second run's update would
    // simply match zero rows instead of double-publishing.
    const { data: updated, error: updateError } = await supabase
      .from("content")
      .update({ status: "published", published_at: nowIso })
      .eq("id", row.id)
      .eq("status", "scheduled")
      .select("id");
    if (updateError || !updated || updated.length === 0) continue;

    publishedIds.push(row.id);
    await logAuditEvent(supabase, {
      actorUserId: null,
      action: "PUBLISH",
      entityType: "CONTENT",
      entityId: row.id,
      metadata: { title: row.title, status_before: "scheduled", status_after: "published", trigger: "scheduled_publish_job" },
    });
  }

  return NextResponse.json({ published: publishedIds, count: publishedIds.length });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
