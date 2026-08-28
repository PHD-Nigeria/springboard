import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getAdminSession } from "@/lib/auth/session";

/**
 * Serves the guide's screenshots straight from docs/user-guide/images/ —
 * not copied into public/, which would create a second copy of assets the
 * committed guide already owns. Gated by the exact same admin session
 * check every other /admin route uses (see src/lib/auth/session.ts) —
 * a Route Handler doesn't inherit a parent layout's redirect, so this is
 * checked again here explicitly, same reasoning as any other
 * directly-hittable route under (protected).
 */
const IMAGES_DIR = path.join(process.cwd(), "docs", "user-guide", "images");

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export async function GET(_request: Request, context: RouteContext<"/admin/guide/images/[...path]">) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { path: segments } = await context.params;

  // Exactly one flat filename — every screenshot lives directly in
  // docs/user-guide/images/, no subdirectories — and each segment is
  // checked individually so a crafted `..` or empty segment is rejected
  // before it ever reaches the filesystem, not just caught by the
  // resolved-path check below (which stays as a second, independent guard).
  if (segments.length !== 1 || !/^[A-Za-z0-9_.-]+$/.test(segments[0]) || segments[0].includes("..")) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const extension = path.extname(segments[0]).toLowerCase();
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const resolved = path.join(IMAGES_DIR, segments[0]);
  if (!resolved.startsWith(IMAGES_DIR + path.sep)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const file = await readFile(resolved);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": contentType,
        // Private: these screenshots show the authenticated Admin UI, and
        // this endpoint requires a session — never suitable for a shared
        // (e.g. CDN) cache, only this one browser's own cache.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
