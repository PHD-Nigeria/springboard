import { createClient } from "@/lib/supabase/server";
import { getPublicUrl } from "@/lib/storage/buckets";

export interface GalleryPhoto {
  id: string;
  url: string;
  alt: string;
  caption: string | null;
  description: string | null;
  width: number | null;
  height: number | null;
  takenOn: string | null;
  group: string;
}

export interface GalleryGroup {
  title: string;
  photos: GalleryPhoto[];
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function monthLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "Photographs" : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

type Row = {
  id: string;
  storage_path: string;
  alt_text: string | null;
  caption: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  description?: string | null;
  gallery_group?: string | null;
  taken_on?: string | null;
};

/**
 * The central Gallery: every image in the PUBLIC media bucket that has not been hidden from the Gallery. There is no second
 * upload and no copy; this reads the same Media Library rows the editors already use. Private-bucket images never appear
 * (existing media is hidden from the Gallery until an editor turns it on; new uploads are visible automatically), and videos are excluded by MIME type. RLS applies on top of these filters.
 * Photos are grouped by the admin-set group, else by month; newest first.
 */
export async function getGalleryGroups(): Promise<GalleryGroup[]> {
  const supabase = await createClient();
  const base = "id, storage_path, alt_text, caption, mime_type, width, height, created_at";
  const { data, error } = await supabase
    .from("media")
    .select(`${base}, description, gallery_group, taken_on`)
    .eq("bucket", "public")
    .eq("gallery_visible", true)
    .like("mime_type", "image/%")
    .order("created_at", { ascending: false })
    .returns<Row[]>();
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    // Gallery columns not applied yet: show nothing rather than exposing every existing public image.
    return [];
  }
  if (error) throw error;

  const photos: GalleryPhoto[] = (data ?? []).map((row) => {
    const when = row.taken_on ?? row.created_at;
    return {
      id: row.id,
      url: getPublicUrl(supabase, row.storage_path),
      alt: row.alt_text?.trim() || "",
      caption: row.caption?.trim() || null,
      description: row.description?.trim() || null,
      width: row.width,
      height: row.height,
      takenOn: row.taken_on ?? null,
      group: row.gallery_group?.trim() || monthLabel(when),
    };
  });

  const groups = new Map<string, GalleryPhoto[]>();
  for (const photo of photos) {
    const list = groups.get(photo.group) ?? [];
    list.push(photo);
    groups.set(photo.group, list);
  }
  return [...groups.entries()].map(([title, list]) => ({ title, photos: list }));
}
