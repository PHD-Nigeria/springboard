import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { Content, Author } from "@/content-types/types";
import { safeParseBodyDocument, createEmptyBodyDocument } from "@/content-types/blocks";
import { getPublicUrl, getSignedPrivateUrl, PRIVATE_PREVIEW_URL_TTL_SECONDS } from "@/lib/storage/buckets";
import { getAdminSession } from "@/lib/auth/session";
import { cache } from "react";
import { isEditionPubliclyVisible, publicEditionOrFilter } from "@/lib/content/visibility";
import { isValidYouTubeId, parseYouTubeUrl } from "@/lib/video/youtube";

type ContentRow = Database["public"]["Tables"]["content"]["Row"];
type PublicationRow = Database["public"]["Tables"]["publications"]["Row"];
type SectionRow = Database["public"]["Tables"]["sections"]["Row"];
type StaffRow = Database["public"]["Tables"]["staff"]["Row"];
type AuthorRow = Database["public"]["Tables"]["authors"]["Row"];

/**
 * Ids of the editions a PUBLIC visitor may see (published, or scheduled and due) — decided here from each edition's
 * status, not from whether row-level security happened to return it, because signed-in staff can read every edition.
 * Memoised per request, so a page that runs many list queries pays for it once.
 */
const getPublicEditionIds = cache(async (): Promise<string[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("publications").select("id, status, publish_at");
  if (error) throw error;
  return (data ?? []).filter((edition) => isEditionPubliclyVisible(edition)).map((edition) => edition.id);
});

/**
 * Added to every PUBLIC content query: a story is discoverable only if it has no edition (evergreen) or its edition is
 * publicly visible. Without it, a story published inside a still-draft edition leaks through lists, search and the
 * homepage even though its own page 404s. Not applied to the staff preview, which is meant to see everything.
 */
export async function publicEditionFilter(): Promise<string> {
  return publicEditionOrFilter(await getPublicEditionIds());
}

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

const RICH_CONTENT_SELECT = `
  *,
  content_author:author_id ( name, slug ),
  content_category:category_id ( name, slug ),
  content_publication:publication_id ( slug ),
  content_cover_media:cover_media_id ( storage_path, bucket )
`;

interface RichContentRow extends ContentRow {
  content_author: { name: string; slug: string } | null;
  content_category: { name: string; slug: string } | null;
  content_publication: { slug: string } | null;
  content_cover_media: { storage_path: string; bucket: "public" | "private" } | null;
}

/**
 * Same as mapContentRow, plus the resolved relations Card/FeaturedStory
 * components render (category, author, cover image URL, href).
 *
 * `media.bucket` defaults to 'private' (see the media migration) — a real
 * editorial upload that was never explicitly moved to the public bucket
 * would otherwise resolve to a public URL that 404s, rendering as a broken
 * image with no fallback (MediaFallback only ever triggers on a *missing*
 * cover_media_id, not a present-but-unreachable one). Treating a private-
 * bucket cover the same as "no cover" is what keeps that promise: a real,
 * public image renders; anything else — missing OR unreachable — falls
 * back, never a broken `<img>`.
 */
function mapRichContentRow(supabase: SupabaseClient<Database>, row: RichContentRow): Content {
  return {
    ...mapContentRow(row),
    category: row.content_category,
    author: row.content_author,
    coverImageUrl:
      row.content_cover_media && row.content_cover_media.bucket === "public"
        ? getPublicUrl(supabase, row.content_cover_media.storage_path)
        : null,
    href: row.content_publication ? `/issues/${row.content_publication.slug}/${row.slug}` : undefined,
  };
}

interface RichAuthorRow extends AuthorRow {
  author_avatar: { storage_path: string; bucket: "public" | "private" } | null;
}

/** See mapRichContentRow's comment on the bucket check — same reasoning applies to contributor avatars. */
function mapAuthorRow(supabase: SupabaseClient<Database>, row: RichAuthorRow): Author {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    title: row.title,
    bio: row.bio,
    avatarUrl:
      row.author_avatar && row.author_avatar.bucket === "public"
        ? getPublicUrl(supabase, row.author_avatar.storage_path)
        : null,
  };
}

/**
 * All reads below rely on RLS to enforce visibility (public/anon only ever
 * sees published or time-eligible-scheduled rows) — no status filtering is
 * duplicated here in application code.
 */

interface RichPublicationRow extends PublicationRow {
  publication_cover_media: { storage_path: string; bucket: "public" | "private" } | null;
}

/**
 * Resolves `cover_media_id` into a public URL the same way content/author
 * covers do (see mapRichContentRow's comment) — this was previously a bare
 * `select("*")` that never joined the cover image at all, so a publication
 * with a real cover set in Supabase would still always show the Hero's
 * MediaFallback with no way to fix that from the CMS/DB side.
 */
export async function getPublicationBySlug(
  slug: string
): Promise<(PublicationRow & { coverImageUrl: string | null }) | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("publications")
    .select("*, publication_cover_media:cover_media_id ( storage_path, bucket )")
    .eq("slug", slug)
    .maybeSingle()
    .returns<RichPublicationRow | null>();

  if (error) throw error;
  if (!data) return null;

  const { publication_cover_media, ...publication } = data;
  return {
    ...publication,
    coverImageUrl:
      publication_cover_media && publication_cover_media.bucket === "public"
        ? getPublicUrl(supabase, publication_cover_media.storage_path)
        : null,
  };
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

/**
 * Editor-set `display_order` wins when set; `published_at desc` is the
 * tiebreak (and, in practice, the primary sort while every seeded row still
 * shares the same default display_order of 0) so a section's lead/featured
 * item is always its most recent, not whatever Postgres happens to return
 * for a bunch of equal-priority rows.
 */
export async function getContentForSection(sectionId: string): Promise<Content[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content")
    .select(RICH_CONTENT_SELECT)
    .or(await publicEditionFilter())
    .eq("section_id", sectionId)
    .order("display_order", { ascending: true })
    .order("published_at", { ascending: false, nullsFirst: false })
    .returns<RichContentRow[]>();

  if (error) throw error;
  return (data ?? []).map((row) => mapRichContentRow(supabase, row));
}

export async function getContentByPublicationAndSlug(
  publicationId: string,
  slug: string
): Promise<Content | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content")
    .select(RICH_CONTENT_SELECT)
    .eq("publication_id", publicationId)
    .eq("slug", slug)
    .maybeSingle()
    .returns<RichContentRow | null>();

  if (error) throw error;
  return data ? mapRichContentRow(supabase, data) : null;
}

/**
 * Fetches by id (any status) through the exact same mapping every public
 * page uses — the admin preview route's one and only reason to exist: feed
 * a draft's real data into the real ArticleTemplate/NewsTemplate rather
 * than a second preview renderer. RLS (content_select_own /
 * content_select_staff) is what allows a draft to be visible here at all;
 * an anonymous or unrelated-contributor request gets null, same as any
 * other row RLS hides.
 */
export async function getContentByIdForPreview(id: string): Promise<Content | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content")
    .select(RICH_CONTENT_SELECT)
    .eq("id", id)
    .maybeSingle()
    .returns<RichContentRow | null>();

  if (error) throw error;
  if (!data) return null;

  const content = mapRichContentRow(supabase, data);

  // Staff-only: show a PRIVATE cover through a short-lived signed URL, so a draft can be reviewed as it will look
  // without promoting its pictures. Requires a signed-in contributor-or-above (and Storage's own
  // media_private_read policy re-checks at signing time). Nothing is stored; the URL exists only in this response.
  const session = await getAdminSession();
  if (!session) return content;
  content.isStaffPreview = true;
  if (data.content_cover_media?.bucket === "private") {
    try {
      content.coverImageUrl = await getSignedPrivateUrl(
        supabase,
        data.content_cover_media.storage_path,
        PRIVATE_PREVIEW_URL_TTL_SECONDS
      );
    } catch (signError) {
      // Message only — never the path or URL.
      console.error("preview: could not sign the private cover image:", signError instanceof Error ? signError.message : "unknown error");
    }
  }
  return content;
}

/**
 * Looks up one content row by id for a *public* consumer (the homepage's
 * configurable featured-story pick, §12 Phase 4F) — same query shape as
 * getContentByIdForPreview immediately above, but named for what it's
 * actually for here. The safety is identical either way: this runs through
 * the same RLS-scoped client every public query uses, so an anonymous
 * visitor's session only ever gets this row back if content_select_public
 * already permits it (published, or scheduled past its publish_at) —
 * an admin having picked a since-unpublished or still-scheduled item as
 * "featured" fails closed here, not open.
 */
export async function getContentById(id: string): Promise<Content | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content")
    .select(RICH_CONTENT_SELECT)
    .or(await publicEditionFilter())
    .eq("id", id)
    .maybeSingle()
    .returns<RichContentRow | null>();

  if (error) throw error;
  return data ? mapRichContentRow(supabase, data) : null;
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

/**
 * The N most recently published items, richly joined for card/hero display.
 * The homepage slices this one list into featured/recent/grid rather than
 * issuing three separate near-identical queries.
 */
export async function getRecentContent(limit: number): Promise<Content[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content")
    .select(RICH_CONTENT_SELECT)
    .or(await publicEditionFilter())
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit)
    .returns<RichContentRow[]>();

  if (error) throw error;
  return (data ?? []).map((row) => mapRichContentRow(supabase, row));
}

/** The N most recently published COMPANY_NEWS items, for the homepage's News Bites rail and each news article's "More News" list. */
export async function getNewsBites(
  limit: number,
  options: { excludeContentId?: string } = {}
): Promise<Content[]> {
  const supabase = await createClient();
  let query = supabase
    .from("content")
    .select(RICH_CONTENT_SELECT)
    .or(await publicEditionFilter())
    .eq("content_type", "COMPANY_NEWS")
    .order("published_at", { ascending: false, nullsFirst: false });

  if (options.excludeContentId) {
    query = query.neq("id", options.excludeContentId);
  }

  const { data, error } = await query.limit(limit).returns<RichContentRow[]>();

  if (error) throw error;
  return (data ?? []).map((row) => mapRichContentRow(supabase, row));
}

/**
 * Full-text search across every content type, via the `search_vector`
 * column already generated (title + summary + block text) and indexed on
 * `content` in the original schema migration — no separate search index or
 * data-access path. `websearch` query syntax tolerates arbitrary user input
 * (quotes, punctuation, multiple words) without throwing, unlike the
 * stricter tsquery syntaxes.
 */
export async function searchContent(query: string, limit = 20): Promise<Content[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content")
    .select(RICH_CONTENT_SELECT)
    .or(await publicEditionFilter())
    .textSearch("search_vector", query, { type: "websearch", config: "english" })
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit)
    .returns<RichContentRow[]>();

  if (error) throw error;
  return (data ?? []).map((row) => mapRichContentRow(supabase, row));
}

export async function getAuthorBySlug(slug: string): Promise<Author | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("authors")
    .select("*, author_avatar:avatar_media_id ( storage_path, bucket )")
    .eq("slug", slug)
    .maybeSingle()
    .returns<RichAuthorRow | null>();

  if (error) throw error;
  return data ? mapAuthorRow(supabase, data) : null;
}

export interface SitemapEntries {
  publications: { slug: string; updatedAt: string }[];
  content: { publicationSlug: string; contentSlug: string; updatedAt: string }[];
  authors: { slug: string; updatedAt: string }[];
}

/**
 * Every URL sitemap.ts needs to list, through the same RLS-scoped client
 * every other public query uses — no manual status filtering here either:
 * content_select_public/publications_select already restrict the result to
 * exactly what's genuinely public (published, or scheduled past its
 * publish_at), so nothing draft/scheduled-in-the-future/archived can ever
 * reach the sitemap by construction, not by a second check in this function.
 */
export async function getSitemapEntries(): Promise<SitemapEntries> {
  const supabase = await createClient();
  const [publicationsResult, contentResult, authorsResult] = await Promise.all([
    supabase.from("publications").select("slug, updated_at"),
    supabase.from("content").select("slug, updated_at, publications:publication_id ( slug )").not("publication_id", "is", null),
    supabase.from("authors").select("slug, updated_at"),
  ]);

  if (publicationsResult.error) throw publicationsResult.error;
  if (contentResult.error) throw contentResult.error;
  if (authorsResult.error) throw authorsResult.error;

  return {
    publications: (publicationsResult.data ?? []).map((row) => ({ slug: row.slug, updatedAt: row.updated_at })),
    content: (contentResult.data ?? [])
      .filter((row): row is typeof row & { publications: { slug: string } } => row.publications !== null)
      .map((row) => ({ publicationSlug: row.publications.slug, contentSlug: row.slug, updatedAt: row.updated_at })),
    authors: (authorsResult.data ?? []).map((row) => ({ slug: row.slug, updatedAt: row.updated_at })),
  };
}

export async function getFeaturedContributors(limit: number): Promise<Author[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("authors")
    .select("*, author_avatar:avatar_media_id ( storage_path, bucket )")
    .order("name", { ascending: true })
    .limit(limit)
    .returns<RichAuthorRow[]>();

  if (error) throw error;
  return (data ?? []).map((row) => mapAuthorRow(supabase, row));
}

/** Explicit homepage "People" picks (§12, Phase 4F) — resolved in the given order; an id that's since been deleted is silently dropped, matching this codebase's established "missing reference resolves to absent, never an error" rule. */
export async function getAuthorsByIds(ids: string[]): Promise<Author[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("authors")
    .select("*, author_avatar:avatar_media_id ( storage_path, bucket )")
    .in("id", ids)
    .returns<RichAuthorRow[]>();

  if (error) throw error;
  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  return ids.filter((id) => byId.has(id)).map((id) => mapAuthorRow(supabase, byId.get(id)!));
}

/** Published content by this author, richly joined, most recent first — excludes the article currently being viewed, if any. */
export async function getContentByAuthor(
  authorId: string,
  options: { excludeContentId?: string; limit?: number } = {}
): Promise<Content[]> {
  const supabase = await createClient();
  let query = supabase
    .from("content")
    .select(RICH_CONTENT_SELECT)
    .or(await publicEditionFilter())
    .eq("author_id", authorId)
    .order("published_at", { ascending: false, nullsFirst: false });

  if (options.excludeContentId) {
    query = query.neq("id", options.excludeContentId);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query.returns<RichContentRow[]>();

  if (error) throw error;
  return (data ?? []).map((row) => mapRichContentRow(supabase, row));
}

/** Other published content in the same category — the article page's "Related Stories". */
export async function getRelatedContent(
  categoryId: string,
  excludeContentId: string,
  limit: number
): Promise<Content[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content")
    .select(RICH_CONTENT_SELECT)
    .or(await publicEditionFilter())
    .eq("category_id", categoryId)
    .neq("id", excludeContentId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit)
    .returns<RichContentRow[]>();

  if (error) throw error;
  return (data ?? []).map((row) => mapRichContentRow(supabase, row));
}

export interface PublicStaff {
  id: string;
  slug: string;
  fullName: string;
  title: string | null;
  department: string | null;
  bio: string | null;
  photoUrl: string | null;
}

interface RichStaffRow {
  id: string;
  slug: string;
  full_name: string;
  title: string | null;
  department: string | null;
  bio: string | null;
  staff_photo: { storage_path: string; bucket: "public" | "private" } | null;
}

function mapStaffRow(supabase: SupabaseClient<Database>, row: RichStaffRow): PublicStaff {
  return {
    id: row.id,
    slug: row.slug,
    fullName: row.full_name,
    title: row.title,
    department: row.department,
    bio: row.bio,
    photoUrl: row.staff_photo && row.staff_photo.bucket === "public" ? getPublicUrl(supabase, row.staff_photo.storage_path) : null,
  };
}

export interface SpotlightQA {
  id: string;
  question: string;
  answer: string;
}

/**
 * The staff member + ordered Q&A behind one STAFF_SPOTLIGHT content row.
 * SpotlightTemplate/StaffProfile call this by content.id rather than
 * having every list query (getRecentContent, getContentByCategoryId, ...)
 * join staff_spotlights, matching the registry's stated design: adding a
 * content type's real data shouldn't change the generic list-fetching
 * queries, only that type's own Template/Card. Relies on RLS
 * (staff_spotlights_select/spotlight_questions_select, both scoped through
 * the parent content row's own visibility): a spotlight whose content row
 * an anonymous visitor can't see resolves to null here too.
 */
export async function getSpotlightDetail(contentId: string): Promise<{ staff: PublicStaff; questions: SpotlightQA[] } | null> {
  const supabase = await createClient();
  const { data: spotlight, error: spotlightError } = await supabase
    .from("staff_spotlights")
    .select("id, staff:staff_id ( id, slug, full_name, title, department, bio, staff_photo:photo_media_id ( storage_path, bucket ) )")
    .eq("content_id", contentId)
    .maybeSingle()
    .returns<{ id: string; staff: RichStaffRow | null } | null>();
  if (spotlightError) throw spotlightError;
  if (!spotlight || !spotlight.staff) return null;

  const { data: questions, error: questionsError } = await supabase
    .from("spotlight_questions")
    .select("id, question, answer")
    .eq("spotlight_id", spotlight.id)
    .order("display_order", { ascending: true });
  if (questionsError) throw questionsError;

  return { staff: mapStaffRow(supabase, spotlight.staff), questions: questions ?? [] };
}

/**
 * The staff member(s) linked to one BIRTHDAY (or any future staff-mention)
 * content row via content_staff, same "own query, not a joined list
 * fetch" reasoning as getSpotlightDetail above. Relies on RLS
 * (content_staff_select, scoped through the parent content row).
 */
export async function getContentStaff(contentId: string): Promise<PublicStaff[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_staff")
    .select("staff:staff_id ( id, slug, full_name, title, department, bio, staff_photo:photo_media_id ( storage_path, bucket ) )")
    .eq("content_id", contentId)
    .returns<{ staff: RichStaffRow | null }[]>();
  if (error) throw error;
  return (data ?? []).filter((row): row is { staff: RichStaffRow } => row.staff !== null).map((row) => mapStaffRow(supabase, row.staff));
}

/**
 * The same lookup as getContentStaff, batched across every content id a
 * caller already has in hand (e.g. every BIRTHDAY on one category landing
 * page), one query instead of one per row. Introduced after measuring
 * /staff-news specifically: 17 BIRTHDAY cards each independently calling
 * getContentStaff (via StaffProfile) meant 17 separate content_staff round
 * trips for a page that only ever needed one `.in()` query. A caller passes
 * the resolved PublicStaff back down (see StaffProfile's `resolvedStaff`
 * prop) instead of letting each card re-fetch its own.
 */
export async function getContentStaffBatch(contentIds: string[]): Promise<Map<string, PublicStaff>> {
  const map = new Map<string, PublicStaff>();
  if (contentIds.length === 0) return map;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_staff")
    .select("content_id, staff:staff_id ( id, slug, full_name, title, department, bio, staff_photo:photo_media_id ( storage_path, bucket ) )")
    .in("content_id", contentIds)
    .returns<{ content_id: string; staff: RichStaffRow | null }[]>();
  if (error) throw error;

  for (const row of data ?? []) {
    if (row.staff) map.set(row.content_id, mapStaffRow(supabase, row.staff));
  }
  return map;
}

export interface CategoryInfo {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export async function getCategoryBySlug(slug: string): Promise<CategoryInfo | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("id, slug, name, description").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Published content for one of the grouped-navigation landing pages
 * (Company News, Articles, HR Corner, ...), by category id — the same
 * "editorial area" relationship getRelatedContent already reads for the
 * article page's "Related Stories", just not scoped to excluding one item.
 * Takes an id rather than a slug (resolve the category first via
 * getCategoryBySlug) so a landing page can also render the category's own
 * name/description without a second round trip inside this function.
 * Relies on RLS (content_select_public) for visibility, same as every other
 * public query in this file.
 */
export async function getContentByCategoryId(categoryId: string, limit = 30): Promise<Content[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content")
    .select(RICH_CONTENT_SELECT)
    .or(await publicEditionFilter())
    .eq("category_id", categoryId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit)
    .returns<RichContentRow[]>();

  if (error) throw error;
  return (data ?? []).map((row) => mapRichContentRow(supabase, row));
}

export interface PublicSiteSettings {
  featuredContentId: string | null;
  featuredAuthorIds: string[];
  bannerTitle: string | null;
  bannerDescription: string | null;
  siteTitle: string | null;
  seoDefaultDescription: string | null;
  ogImageUrl: string | null;
  faviconUrl: string | null;
}

interface PublicSiteSettingsMediaJoin {
  storage_path: string;
  bucket: "public" | "private";
}

/**
 * The public-facing read of site_settings (Phase 4F, §12/§14) — deliberately
 * separate from lib/admin/queries.ts's getSiteSettings(), matching this
 * file's existing "admin needs a different shape" boundary, not a second
 * data-access architecture. site_settings_select is public-read (this
 * migration), so this works for anonymous visitors exactly like every
 * other query in this file. An asset's bucket must be 'public' to resolve
 * a URL here — the same bucket-awareness rule every other media reference
 * in this codebase follows; a private-bucket pick is treated as unset
 * rather than ever generating a broken/unreachable URL.
 */
export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select(
      `featured_content_id, featured_author_ids, banner_title, banner_description, site_title, seo_default_description,
       og_image:og_image_media_id ( storage_path, bucket ),
       favicon:favicon_media_id ( storage_path, bucket )`
    )
    .eq("id", true)
    .maybeSingle()
    .returns<{
      featured_content_id: string | null;
      featured_author_ids: string[] | null;
      banner_title: string | null;
      banner_description: string | null;
      site_title: string | null;
      seo_default_description: string | null;
      og_image: PublicSiteSettingsMediaJoin | null;
      favicon: PublicSiteSettingsMediaJoin | null;
    } | null>();

  if (error) throw error;

  const resolveUrl = (join: PublicSiteSettingsMediaJoin | null) =>
    join && join.bucket === "public" ? getPublicUrl(supabase, join.storage_path) : null;

  return {
    featuredContentId: data?.featured_content_id ?? null,
    featuredAuthorIds: data?.featured_author_ids ?? [],
    bannerTitle: data?.banner_title ?? null,
    bannerDescription: data?.banner_description ?? null,
    siteTitle: data?.site_title ?? null,
    seoDefaultDescription: data?.seo_default_description ?? null,
    ogImageUrl: resolveUrl(data?.og_image ?? null),
    faviconUrl: resolveUrl(data?.favicon ?? null),
  };
}

export interface PublicNavItem {
  id: string;
  label: string;
  href: string;
  isExternal: boolean;
  openInNewTab: boolean;
  /** Present (possibly empty) only on a top-level item; a child item never has children of its own — two levels is all this nav supports. */
  children?: PublicNavItem[];
}

/**
 * Public header navigation, built into a two-level tree from the flat
 * nav_items table (parent_id null = top-level; a group heading has one or
 * more children, a standalone item like Search has none). nav_items_select's
 * RLS (`using (is_visible)`) is what actually excludes hidden rows for
 * anonymous visitors; this doesn't repeat that filter itself, matching this
 * file's existing rule of trusting RLS rather than a second
 * application-level filter that could drift out of sync (see sitemap.ts's
 * own comment on the same point). A hidden parent still hides its visible
 * children here too, since a child with no reachable group heading has
 * nowhere to render.
 */
export async function getPublicNavItems(): Promise<PublicNavItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("nav_items")
    .select("id, parent_id, label, href, is_external, open_in_new_tab")
    .order("display_order", { ascending: true });
  if (error) throw error;

  const rows = data ?? [];
  const toItem = (row: (typeof rows)[number]): PublicNavItem => ({
    id: row.id,
    label: row.label,
    href: row.href,
    isExternal: row.is_external,
    openInNewTab: row.open_in_new_tab,
  });

  const topLevel = rows.filter((row) => row.parent_id === null);
  return topLevel.map((row) => {
    const children = rows.filter((child) => child.parent_id === row.id).map(toItem);
    return children.length > 0 ? { ...toItem(row), children } : toItem(row);
  });
}

// ---------------------------------------------------------------------------
// Homepage: active edition and featured videos
// ---------------------------------------------------------------------------

export interface ActiveEdition {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  /** "2026 Q3" when the slug follows the YYYY-qN convention, else null. Until the quarter columns are approved, the slug is the only structured hint. */
  code: string | null;
  storyCount: number;
  videoCount: number;
}

export function editionCodeFromSlug(slug: string): string | null {
  const match = /^(\d{4})-q([1-4])$/i.exec(slug);
  return match ? `${match[1]} Q${match[2]}` : null;
}

/**
 * The edition the CMS has made active (site_settings.default_publication_id),
 * resolved through the same public RLS as every read here, so an unpublished
 * or deleted pick returns null and the homepage falls back to "most recent".
 */
export async function getActiveEdition(): Promise<ActiveEdition | null> {
  const supabase = await createClient();
  const { data: settings, error: settingsError } = await supabase
    .from("site_settings")
    .select("default_publication_id")
    .eq("id", true)
    .maybeSingle()
    .returns<{ default_publication_id: string | null } | null>();
  if (settingsError) throw settingsError;

  let query = supabase.from("publications").select("id, slug, title, subtitle, status, publish_at");
  query = settings?.default_publication_id
    ? query.eq("id", settings.default_publication_id)
    : query.order("published_at", { ascending: false, nullsFirst: false }).limit(1);
  const { data, error } = await query.returns<{ id: string; slug: string; title: string; subtitle: string | null; status: string; publish_at: string | null }[]>();
  if (error) throw error;
  const publication = data?.[0];
  // A draft (or not-yet-due) edition is never the public "active edition", whoever is looking.
  if (!publication || !isEditionPubliclyVisible(publication)) return null;

  const { count, error: countError } = await supabase
    .from("content")
    .select("id", { count: "exact", head: true })
    .eq("publication_id", publication.id);
  if (countError) throw countError;

  const videos = await getHomeVideos();
  return {
    id: publication.id,
    slug: publication.slug,
    title: publication.title,
    subtitle: publication.subtitle,
    code: editionCodeFromSlug(publication.slug),
    storyCount: count ?? 0,
    videoCount: videos.filter((v) => v.editionSlug === publication.slug).length,
  };
}

export interface HomeVideo {
  videoId: string;
  title: string;
  caption: string | null;
  orientation: "landscape" | "portrait";
  /** The story that contains this video block. Its edition is the video's edition. */
  contentId: string;
  contentTitle: string;
  contentHref: string | null;
  editionSlug: string | null;
  editionTitle: string | null;
  editionCode: string | null;
  /**
   * A PUBLIC Media Library image the editor chose as this video's thumbnail, or null (the page then shows a neutral branded
   * fallback). Never a YouTube image: nothing may be fetched from YouTube/Google before a visitor chooses to play.
   */
  thumbnailUrl: string | null;
}

/**
 * Every playable video in published stories, newest first. Videos are Video
 * blocks inside story bodies (there is no video table), so a video's quarter
 * is its story's edition, and older editions keep their videos when a new
 * quarter becomes active: nothing here reads or writes the active-edition
 * setting. Ids are re-validated, and a legacy `externalUrl` is only honoured
 * if it parses as a supported YouTube link; anything else is skipped.
 */
/**
 * Memoised per request with React's cache(): the homepage needs this list twice (the video panel, and the active edition's
 * video count), and every other caller in the same render reuses one result instead of re-querying and re-processing the
 * rows. (Next.js already de-duplicates the identical GET at the network layer; this makes the saving explicit and independent
 * of that framework behaviour.)
 */
export const getHomeVideos = cache(async (limit = 24): Promise<HomeVideo[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content")
    .select(`${RICH_CONTENT_SELECT.replace("content_publication:publication_id ( slug )", "content_publication:publication_id ( slug, title )")}`)
    .contains("body", { blocks: [{ type: "video" }] })
    .or(await publicEditionFilter())
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit)
    .returns<(RichContentRow & { content_publication: { slug: string; title: string } | null })[]>();
  if (error) throw error;

  const seen = new Set<string>();
  const videos: HomeVideo[] = [];
  const thumbnailIds = new Map<string, string>(); // video id -> chosen thumbnail media id
  for (const row of data ?? []) {
    const content = mapRichContentRow(supabase, row);
    const publication = row.content_publication;
    for (const block of content.body.blocks) {
      if (block.type !== "video") continue;
      const fromUrl = !block.videoId && block.externalUrl ? parseYouTubeUrl(block.externalUrl) : null;
      const videoId = isValidYouTubeId(block.videoId) ? block.videoId : (fromUrl?.videoId ?? null);
      if (!videoId || seen.has(videoId)) continue;
      seen.add(videoId);
      if (block.thumbnailMediaId) thumbnailIds.set(videoId, block.thumbnailMediaId);
      videos.push({
        videoId,
        title: block.title?.trim() || content.title,
        caption: block.caption?.trim() || null,
        orientation: block.orientation ?? (fromUrl?.isShort ? "portrait" : "landscape"),
        contentId: content.id,
        contentTitle: content.title,
        contentHref: content.href ?? null,
        editionSlug: publication?.slug ?? null,
        editionTitle: publication?.title ?? null,
        editionCode: publication ? editionCodeFromSlug(publication.slug) : null,
        thumbnailUrl: null,
      });
    }
  }

  // Resolve the editors' chosen thumbnails in one query. Only PUBLIC media can be shown: a private (or missing) image
  // simply leaves thumbnailUrl null and the page uses the neutral branded fallback.
  const mediaIds = [...new Set(thumbnailIds.values())];
  if (mediaIds.length > 0) {
    const { data: media, error: mediaError } = await supabase.from("media").select("id, bucket, storage_path").in("id", mediaIds);
    if (mediaError) throw mediaError;
    const urlById = new Map((media ?? []).filter((m) => m.bucket === "public").map((m) => [m.id, getPublicUrl(supabase, m.storage_path)]));
    for (const video of videos) video.thumbnailUrl = urlById.get(thumbnailIds.get(video.videoId) ?? "") ?? null;
  }
  return videos;
});

/**
 * Which video leads. A preferred id (the admin's pick, once the featured-video
 * setting is approved and stored) wins only if it is still in the published
 * list; otherwise the newest video in the active edition, then the newest overall.
 */
export function pickFeaturedVideo(videos: HomeVideo[], activeEditionSlug: string | null, preferredId?: string | null): HomeVideo | null {
  if (preferredId) {
    const preferred = videos.find((v) => v.videoId === preferredId);
    if (preferred) return preferred;
  }
  return videos.find((v) => activeEditionSlug && v.editionSlug === activeEditionSlug) ?? videos[0] ?? null;
}
