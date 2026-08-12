import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { Content } from "@/content-types/types";
import { safeParseBodyDocument, createEmptyBodyDocument } from "@/content-types/blocks";

type ContentRow = Database["public"]["Tables"]["content"]["Row"];
type PublicationRow = Database["public"]["Tables"]["publications"]["Row"];
type SectionRow = Database["public"]["Tables"]["sections"]["Row"];
type StaffRow = Database["public"]["Tables"]["staff"]["Row"];

/**
 * Maps a raw `content` row to the app-facing Content shape. A row whose
 * `body` fails block-schema validation renders as an empty document rather
 * than throwing — one malformed row shouldn't take down a whole page.
 */
function mapContentRow(row: ContentRow): Content {
  const parsedBody = safeParseBodyDocument(row.body);
  if (!parsedBody.success) {
    console.error(`content ${row.id}: invalid body document`, parsedBody.error);
  }

  return {
    id: row.id,
    publicationId: row.publication_id,
    contentType: row.content_type,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    summary: row.summary,
    body: parsedBody.success ? parsedBody.data : createEmptyBodyDocument(),
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    status: row.status,
    sectionId: row.section_id,
    authorId: row.author_id,
    categoryId: row.category_id,
    coverMediaId: row.cover_media_id,
    displayOrder: row.display_order,
    publishAt: row.publish_at,
    publishedAt: row.published_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * All reads below rely on RLS to enforce visibility (public/anon only ever
 * sees published or time-eligible-scheduled rows) — no status filtering is
 * duplicated here in application code.
 */

export async function getPublicationBySlug(slug: string): Promise<PublicationRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("publications")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getSectionsForPublication(publicationId: string): Promise<SectionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sections")
    .select("*")
    .eq("publication_id", publicationId)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getContentForSection(sectionId: string): Promise<Content[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content")
    .select("*")
    .eq("section_id", sectionId)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapContentRow);
}

export async function getContentByPublicationAndSlug(
  publicationId: string,
  slug: string
): Promise<Content | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content")
    .select("*")
    .eq("publication_id", publicationId)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data ? mapContentRow(data) : null;
}

/** For evergreen content (publication_id is null) — see the partial unique index on content.slug. */
export async function getEvergreenContentBySlug(slug: string): Promise<Content | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content")
    .select("*")
    .is("publication_id", null)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data ? mapContentRow(data) : null;
}

export async function getStaffBySlug(slug: string): Promise<StaffRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data;
}
