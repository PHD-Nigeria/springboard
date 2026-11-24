"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/admin/audit";
import { EDITION_PDF_BUCKET } from "@/lib/storage/buckets";

export const MAX_EDITION_PDF_BYTES = 50 * 1024 * 1024;

export interface EditionPdfResult {
  error: string | null;
}
export interface EditionPdfUploadUrlResult extends EditionPdfResult {
  token?: string;
  path?: string;
}

const NO_PERMISSION = "Only an editor or administrator can attach an edition PDF.";

async function requireEditorOrAdmin() {
  const session = await getAdminSession();
  return session && (session.role === "editor" || session.role === "admin") ? session : null;
}

/**
 * Step 1: a signed upload token for one new object under editions/<uuid>.pdf. Gated by the edition-pdfs storage insert
 * policy (editor/admin), and the bucket itself only accepts application/pdf up to 50 MiB regardless of what the client says.
 */
export async function createEditionPdfUploadUrlAction(input: { fileSize: number; mimeType: string }): Promise<EditionPdfUploadUrlResult> {
  if (!(await requireEditorOrAdmin())) return { error: NO_PERMISSION };
  if (input.mimeType !== "application/pdf") return { error: "Only PDF files can be attached to an edition." };
  if (!(input.fileSize > 0)) return { error: "Choose a PDF file first." };
  if (input.fileSize > MAX_EDITION_PDF_BYTES) return { error: "That PDF is larger than 50 MB." };

  const supabase = await createClient();
  const path = `editions/${crypto.randomUUID()}.pdf`;
  const { data, error } = await supabase.storage.from(EDITION_PDF_BUCKET).createSignedUploadUrl(path);
  if (error) {
    console.error("createEditionPdfUploadUrlAction:", error.message);
    return { error: "The upload could not be prepared. The PDF storage may not be set up in this environment yet." };
  }
  return { error: null, token: data.token, path };
}

const completeSchema = z.object({
  editionId: z.string().uuid(),
  path: z.string().regex(/^editions\/[0-9a-fA-F-]{36}\.pdf$/),
  filename: z.string().trim().min(1).max(200),
  periodLabel: z.string().trim().max(80).optional().or(z.literal("")),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

/** Step 3: confirm the object really exists in Storage, then record it on the edition. Replacing a PDF only re-points the edition; the earlier file is left in Storage. */
export async function completeEditionPdfUploadAction(input: z.input<typeof completeSchema>): Promise<EditionPdfResult> {
  const session = await requireEditorOrAdmin();
  if (!session) return { error: NO_PERMISSION };
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return { error: "Those PDF details are not valid." };
  const v = parsed.data;

  const supabase = await createClient();
  const name = v.path.split("/")[1];
  const { data: found, error: listError } = await supabase.storage.from(EDITION_PDF_BUCKET).list("editions", { search: name, limit: 1 });
  const object = found?.find((f) => f.name === name);
  if (listError || !object) return { error: "The file did not finish uploading. Please try again." };
  const size = Number((object.metadata as { size?: number } | null)?.size ?? 0) || null;

  const { data, error } = await supabase
    .from("publications")
    .update({
      pdf_path: v.path,
      pdf_filename: v.filename.replace(/[^\w.\- ]+/g, "_"),
      pdf_size_bytes: size,
      period_label: v.periodLabel || null,
      period_start: v.periodStart || null,
    })
    .eq("id", v.editionId)
    .select("id");
  if (error || !data || data.length === 0) {
    console.error("completeEditionPdfUploadAction:", error?.message);
    return { error: "The PDF was uploaded but could not be attached to this edition (check your permissions)." };
  }
  await logAuditEvent(supabase, { actorUserId: session.userId, action: "UPDATE", entityType: "PUBLICATION", entityId: v.editionId, metadata: { change: "edition PDF attached" } });
  revalidatePath("/archive");
  revalidatePath(`/admin/publications/${v.editionId}`);
  return { error: null };
}

/** Detaches the PDF from the edition (the edition and its stories are untouched; the file stays in Storage). */
export async function detachEditionPdfAction(editionId: string): Promise<EditionPdfResult> {
  if (!(await requireEditorOrAdmin())) return { error: NO_PERMISSION };
  if (!z.string().uuid().safeParse(editionId).success) return { error: "Unknown edition." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("publications")
    .update({ pdf_path: null, pdf_filename: null, pdf_size_bytes: null })
    .eq("id", editionId)
    .select("id");
  if (error || !data || data.length === 0) return { error: "The PDF could not be detached." };
  revalidatePath("/archive");
  revalidatePath(`/admin/publications/${editionId}`);
  return { error: null };
}
