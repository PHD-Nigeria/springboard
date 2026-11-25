import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEditionPubliclyVisible } from "@/lib/content/visibility";
import { getEditionPdfSignedUrl } from "@/lib/storage/buckets";

/**
 * Open or download an edition's original PDF. The bucket is private, so the file is never reachable by a stored URL:
 * this route re-checks that the edition is publicly visible (same rule as the Archive, under the caller's own RLS),
 * then redirects to a 60-second signed link, which Storage itself only issues if the edition-pdfs read policy allows
 * it. A draft, archived, unknown or PDF-less edition is a plain 404. No service-role key is used.
 */
export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("publications")
    .select("slug, status, publish_at, pdf_path, pdf_filename")
    .eq("slug", slug)
    .maybeSingle();

  const notFound = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (error || !data || !data.pdf_path || !isEditionPubliclyVisible(data)) return notFound();

  const wantsDownload = new URL(request.url).searchParams.get("download") === "1";
  const signed = await getEditionPdfSignedUrl(supabase, data.pdf_path, { download: wantsDownload ? data.pdf_filename || `${data.slug}.pdf` : undefined });
  if (!signed) return notFound();

  return NextResponse.redirect(signed, { status: 302, headers: { "Cache-Control": "no-store" } });
}
