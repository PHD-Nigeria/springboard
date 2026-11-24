"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/admin/audit";

export interface GalleryMeta {
  description: string;
  group: string;
  takenOn: string;
  visible: boolean;
}
export interface GalleryMetaResult {
  error: string | null;
  meta?: GalleryMeta;
  /** False when the gallery columns are not in this database yet. */
  available?: boolean;
}

const schema = z.object({
  description: z.string().trim().max(1000),
  group: z.string().trim().max(120),
  takenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  visible: z.boolean(),
});

export async function getGalleryMetaAction(id: string): Promise<GalleryMetaResult> {
  if (!z.string().uuid().safeParse(id).success) return { error: "Unknown image." };
  const session = await getAdminSession();
  if (!session) return { error: "Your session has expired — sign in again." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("media").select("description, gallery_group, taken_on, gallery_visible").eq("id", id).maybeSingle();
  if (error) return { error: null, available: false };
  if (!data) return { error: "Image not found." };
  return { error: null, available: true, meta: { description: data.description ?? "", group: data.gallery_group ?? "", takenOn: data.taken_on ?? "", visible: data.gallery_visible } };
}

/** Editors and admins curate the Gallery. A DB trigger enforces the same rule, so a contributor cannot bypass this check. */
export async function updateGalleryMetaAction(id: string, input: GalleryMeta): Promise<GalleryMetaResult> {
  const session = await getAdminSession();
  if (!session) return { error: "Your session has expired — sign in again." };
  if (session.role !== "editor" && session.role !== "admin") return { error: "Only an editor or administrator can change Gallery details." };
  const parsed = schema.safeParse(input);
  if (!parsed.success || !z.string().uuid().safeParse(id).success) return { error: "Those Gallery details are not valid." };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media")
    .update({ description: v.description || null, gallery_group: v.group || null, taken_on: v.takenOn || null, gallery_visible: v.visible })
    .eq("id", id)
    .select("id");
  if (error || !data || data.length === 0) return { error: "The Gallery details could not be saved." };
  await logAuditEvent(supabase, { actorUserId: session.userId, action: "UPDATE", entityType: "MEDIA", entityId: id, metadata: { gallery_visible: v.visible, gallery_group: v.group || null } });
  revalidatePath("/gallery");
  revalidatePath("/admin/media");
  return { error: null, meta: v };
}
