import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { Content, Author } from "@/content-types/types";
import { safeParseBodyDocument, createEmptyBodyDocument } from "@/content-types/blocks";
import { getPublicUrl } from "@/lib/storage/buckets";

type ContentRow = Database["public"]["Tables"]["content"]["Row"];
type PublicationRow = Database["public"]["Tables"]["publications"]["Row"];
type SectionRow = Database["public"]["Tables"]["sections"]["Row"];
type StaffRow = Database["public"]["Tables"]["staff"]["Row"];
type AuthorRow = Database["public"]["Tables"]["authors"]["Row"];

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
  return data ? mapRichContentRow(supabase, data) : null;
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
    .eq("category_id", categoryId)
    .neq("id", excludeContentId)
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
}

/**
 * Public header navigation, ordered — nav_items_select's RLS (`using
 * (is_visible)`) is what actually excludes hidden rows for anonymous
 * visitors; this doesn't repeat that filter itself, matching this file's
 * existing rule of trusting RLS rather than a second application-level
 * filter that could drift out of sync (see sitemap.ts's own comment on the
 * same point).
 */
export async function getPublicNavItems(): Promise<PublicNavItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("nav_items")
    .select("id, label, href, is_external, open_in_new_tab")
    .order("display_order", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    href: row.href,
    isExternal: row.is_external,
    openInNewTab: row.open_in_new_tab,
  }));
}
