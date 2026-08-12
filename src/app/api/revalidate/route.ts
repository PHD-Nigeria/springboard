import { NextResponse } from "next/server";

/**
 * Inert stub. Nothing calls this yet — this foundation phase deliberately
 * does not wire up pg_cron/pg_net/database-webhook automation (see
 * docs/architecture.md, "Publishing Workflow"). Once that automation is
 * added later, this route becomes the target that revalidates the affected
 * page's Next.js cache when a content/publication row transitions to
 * published.
 */
export async function POST() {
  return NextResponse.json(
    { message: "Not wired up yet — see docs/architecture.md, Publishing Workflow." },
    { status: 501 }
  );
}
