import { createClient } from "@/lib/supabase/server";
import { getEditionPdfSignedUrl } from "@/lib/storage/buckets";

export interface EditionPdfAdminState {
  /** False when the PDF columns do not exist yet (migration not applied): the panel explains instead of failing. */
  available: boolean;
  current: { filename: string | null; sizeBytes: number | null; url: string } | null;
  periodLabel: string;
  periodStart: string;
}

export async function getEditionPdfAdminState(editionId: string): Promise<EditionPdfAdminState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("publications")
    .select("pdf_path, pdf_filename, pdf_size_bytes, period_label, period_start")
    .eq("id", editionId)
    .maybeSingle();
  if (error || !data) return { available: false, current: null, periodLabel: "", periodStart: "" };
  // Staff get a 10-minute signed link (the bucket is private); null if the file cannot be signed.
  const signed = data.pdf_path ? await getEditionPdfSignedUrl(supabase, data.pdf_path, { expiresInSeconds: 600 }) : null;
  return {
    available: true,
    current: data.pdf_path && signed ? { filename: data.pdf_filename, sizeBytes: data.pdf_size_bytes, url: signed } : null,
    periodLabel: data.period_label ?? "",
    periodStart: data.period_start ?? "",
  };
}
