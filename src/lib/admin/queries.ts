import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { getPublicUrl } from "@/lib/storage/buckets";
import { NO_EDITION_TOKEN } from "@/lib/admin/media-constants";

/**
 * Admin-scoped reads. These deliberately live apart from
 * src/lib/content/queries.ts (the public-facing read surface) because the
 * shapes differ in a real way — admin needs draft/review/archived rows,
 * raw ids for form defaults, and the raw `body`/`metadata` JSON to edit —
 * not because this is a second data-access architecture. Same tables, same
 * RLS, same Supabase client pattern (the cookie-based server client, so
 * every read here is still subject to RLS: content_select_staff requires
 * editor/admin, content_select_own covers a contributor's own drafts).
 */

type ContentRow = Database["public"]["Tables"]["content"]["Row"];
type ContentStatus = Database["public"]["Enums"]["content_status"];
type ContentType = Database["public"]["Enums"]["content_type"];

const ADMIN_CONTENT_SELECT = `
  *,
  content_author:author_id ( id, name, slug ),
  content_category:category_id ( id, name, slug ),
  content_section:section_id ( id, title, publication_id ),
  content_publication:publication_id ( id, slug, title ),
  content_cover_media:cover_media_id ( id, storage_path, bucket, alt_text )
`;

export interface AdminContentRow extends ContentRow {
  content_author: { id: string; name: string; slug: string } | null;
  content_category: { id: string; name: string; slug: string } | null;
  content_section: { id: string; title: string; publication_id: string } | null;
  content_publication: { id: string; slug: string; title: string } | null;
  content_cover_media: { id: string; storage_path: string; bucket: "public" | "private"; alt_text: string | null } | null;
}

export interface ContentListFilters {
  status?: ContentStatus;
  contentType?: ContentType;
  categoryId?: string;
  sectionId?: string;
  authorId?: string;
  publicationId?: string;
  /** Restrict to rows created by this user ("My work"). RLS still decides what is visible. */
  createdBy?: string;
  /** Only rows with no publication, i.e. not linked to any quarterly edition. */
  noPublication?: boolean;
  search?: string;
  sort?: ContentListSort;
  page?: number;
  pageSize?: number;
}

export type ContentListSort = "updated_desc" | "updated_asc" | "title_asc" | "status";

export const CONTENT_LIST_SORTS: { value: ContentListSort; label: string }[] = [
  { value: "updated_desc", label: "Recently updated" },
  { value: "updated_asc", label: "Waiting longest" },
  { value: "title_asc", label: "Title A to Z" },
  { value: "status", label: "Status" },
];

export async function listContent(filters: ContentListFilters = {}) {
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("content").select(ADMIN_CONTENT_SELECT, { count: "exact" });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.contentType) query = query.eq("content_type", filters.contentType);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.sectionId) query = query.eq("section_id", filters.sectionId);
  if (filters.authorId) query = query.eq("author_id", filters.authorId);
  if (filters.publicationId) query = query.eq("publication_id", filters.publicationId);
  if (filters.noPublication) query = query.is("publication_id", null);
  if (filters.createdBy) query = query.eq("created_by", filters.createdBy);
  if (filters.search) {
    // Strip characters that have meaning inside a PostgREST .or() filter so a search for "a,b" or "(x)" cannot alter the filter itself.
    const term = filters.search.replace(/[,()*%\\]/g, " ").trim();
    if (term) query = query.or(`title.ilike.%${term}%,slug.ilike.%${term}%`);
  }

  const sort = filters.sort ?? "updated_desc";
  const ordered =
    sort === "title_asc"
      ? query.order("title", { ascending: true })
      : sort === "updated_asc"
        ? query.order("updated_at", { ascending: true })
        : sort === "status"
          ? query.order("status", { ascending: true }).order("updated_at", { ascending: false })
          : query.order("updated_at", { ascending: false });

  const { data, error, count } = await ordered
    .range(from, to)
    .returns<AdminContentRow[]>();

  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}

export async function getContentById(id: string): Promise<AdminContentRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content")
    .select(ADMIN_CONTENT_SELECT)
    .eq("id", id)
    .maybeSingle()
    .returns<AdminContentRow | null>();

  if (error) throw error;
  return data;
}

export async function getDashboardStats() {
  const supabase = await createClient();

  const [statusCounts, recentContent, contributorsCount, mediaAssetsCount, scheduledContent, draftsNeedingAttention, recentActivity] =
    await Promise.all([
      supabase.from("content").select("status"),
      supabase
        .from("content")
        .select(ADMIN_CONTENT_SELECT)
        .order("updated_at", { ascending: false })
        .limit(6)
        .returns<AdminContentRow[]>(),
      supabase.from("authors").select("id", { count: "exact", head: true }),
      supabase.from("media").select("id", { count: "exact", head: true }),
      // Governance panel: what's coming up, soonest first.
      supabase
        .from("content")
        .select("id, title, publish_at, content_author:author_id ( name )")
        .eq("status", "scheduled")
        .order("publish_at", { ascending: true })
        .limit(5)
        .returns<{ id: string; title: string; publish_at: string | null; content_author: { name: string } | null }[]>(),
      // Governance panel: stalest drafts first — the ones most likely to have been forgotten.
      supabase
        .from("content")
        .select("id, title, updated_at, content_author:author_id ( name )")
        .eq("status", "draft")
        .order("updated_at", { ascending: true })
        .limit(5)
        .returns<{ id: string; title: string; updated_at: string; content_author: { name: string } | null }[]>(),
      listAuditLog({ pageSize: 8 }),
    ]);

  if (statusCounts.error) throw statusCounts.error;
  if (recentContent.error) throw recentContent.error;
  if (scheduledContent.error) throw scheduledContent.error;
  if (draftsNeedingAttention.error) throw draftsNeedingAttention.error;

  const counts: Record<ContentStatus, number> = {
    draft: 0,
    review: 0,
    scheduled: 0,
    published: 0,
    archived: 0,
  };
  for (const row of statusCounts.data ?? []) {
    counts[row.status] += 1;
  }

  return {
    counts,
    total: statusCounts.data?.length ?? 0,
    contributorsCount: contributorsCount.count ?? 0,
    mediaAssetsCount: mediaAssetsCount.count ?? 0,
    recentContent: recentContent.data ?? [],
    scheduledContent: scheduledContent.data ?? [],
    draftsNeedingAttention: draftsNeedingAttention.data ?? [],
    recentActivity: recentActivity.rows,
  };
}

export interface AdminAuthorRow {
  id: string;
  slug: string;
  name: string;
  title: string | null;
  bio: string | null;
  avatar_media_id: string | null;
  avatarUrl: string | null;
  created_at: string;
  articleCount: number;
}

export async function listAuthors(search?: string): Promise<AdminAuthorRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("authors")
    .select("*, author_avatar:avatar_media_id ( storage_path, bucket )")
    .order("name", { ascending: true });

  if (search) query = query.ilike("name", `%${search}%`);

  const [authorsResult, contentResult] = await Promise.all([
    query.returns<
      (Database["public"]["Tables"]["authors"]["Row"] & {
        author_avatar: { storage_path: string; bucket: "public" | "private" } | null;
      })[]
    >(),
    supabase.from("content").select("author_id"),
  ]);

  if (authorsResult.error) throw authorsResult.error;
  if (contentResult.error) throw contentResult.error;

  const counts = countBy((contentResult.data ?? []).map((row) => row.author_id));
  return (authorsResult.data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    title: row.title,
    bio: row.bio,
    avatar_media_id: row.avatar_media_id,
    avatarUrl:
      row.author_avatar && row.author_avatar.bucket === "public"
        ? getPublicUrl(supabase, row.author_avatar.storage_path)
        : null,
    created_at: row.created_at,
    articleCount: counts.get(row.id) ?? 0,
  }));
}

export async function getAuthorById(id: string): Promise<AdminAuthorRow | null> {
  const supabase = await createClient();
  const [authorResult, contentResult] = await Promise.all([
    supabase
      .from("authors")
      .select("*, author_avatar:avatar_media_id ( storage_path, bucket )")
      .eq("id", id)
      .maybeSingle()
      .returns<
        | (Database["public"]["Tables"]["authors"]["Row"] & {
            author_avatar: { storage_path: string; bucket: "public" | "private" } | null;
          })
        | null
      >(),
    supabase.from("content").select("id", { count: "exact", head: true }).eq("author_id", id),
  ]);

  if (authorResult.error) throw authorResult.error;
  if (!authorResult.data) return null;
  const data = authorResult.data;

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    title: data.title,
    bio: data.bio,
    avatar_media_id: data.avatar_media_id,
    avatarUrl:
      data.author_avatar && data.author_avatar.bucket === "public"
        ? getPublicUrl(supabase, data.author_avatar.storage_path)
        : null,
    created_at: data.created_at,
    articleCount: contentResult.count ?? 0,
  };
}

export interface AdminStaffRow {
  id: string;
  slug: string;
  full_name: string;
  title: string | null;
  department: string | null;
  bio: string | null;
  photo_media_id: string | null;
  photoUrl: string | null;
  is_active: boolean;
  created_at: string;
  /** Spotlight + birthday content that reference this person, the same "used by" idea listAuthors' articleCount gives, across both link tables since either can reference staff. */
  spotlightCount: number;
  contentMentionCount: number;
}

/**
 * The employee directory used for Staff Spotlight and Staff News/Birthday
 * content (§Phase 2), the same shape/pattern as listAuthors immediately above,
 * for the same "editor/admin manages a directory of people, not raw ids"
 * reason, just against `staff` (staff_write requires editor/admin, see the
 * RLS migration) instead of `authors`.
 */
export async function listStaff(search?: string): Promise<AdminStaffRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("staff")
    .select("*, staff_photo:photo_media_id ( storage_path, bucket )")
    .order("full_name", { ascending: true });

  if (search) query = query.ilike("full_name", `%${search}%`);

  const [staffResult, spotlightsResult, contentStaffResult] = await Promise.all([
    query.returns<
      (Database["public"]["Tables"]["staff"]["Row"] & {
        staff_photo: { storage_path: string; bucket: "public" | "private" } | null;
      })[]
    >(),
    supabase.from("staff_spotlights").select("staff_id"),
    supabase.from("content_staff").select("staff_id"),
  ]);

  if (staffResult.error) throw staffResult.error;
  if (spotlightsResult.error) throw spotlightsResult.error;
  if (contentStaffResult.error) throw contentStaffResult.error;

  const spotlightCounts = countBy((spotlightsResult.data ?? []).map((row) => row.staff_id));
  const mentionCounts = countBy((contentStaffResult.data ?? []).map((row) => row.staff_id));

  return (staffResult.data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    full_name: row.full_name,
    title: row.title,
    department: row.department,
    bio: row.bio,
    photo_media_id: row.photo_media_id,
    photoUrl: row.staff_photo && row.staff_photo.bucket === "public" ? getPublicUrl(supabase, row.staff_photo.storage_path) : null,
    is_active: row.is_active,
    created_at: row.created_at,
    spotlightCount: spotlightCounts.get(row.id) ?? 0,
    contentMentionCount: mentionCounts.get(row.id) ?? 0,
  }));
}

export async function getStaffById(id: string): Promise<AdminStaffRow | null> {
  const supabase = await createClient();
  const [staffResult, spotlightsResult, contentStaffResult] = await Promise.all([
    supabase
      .from("staff")
      .select("*, staff_photo:photo_media_id ( storage_path, bucket )")
      .eq("id", id)
      .maybeSingle()
      .returns<
        | (Database["public"]["Tables"]["staff"]["Row"] & {
            staff_photo: { storage_path: string; bucket: "public" | "private" } | null;
          })
        | null
      >(),
    supabase.from("staff_spotlights").select("id", { count: "exact", head: true }).eq("staff_id", id),
    supabase.from("content_staff").select("content_id", { count: "exact", head: true }).eq("staff_id", id),
  ]);

  if (staffResult.error) throw staffResult.error;
  if (!staffResult.data) return null;
  const data = staffResult.data;

  return {
    id: data.id,
    slug: data.slug,
    full_name: data.full_name,
    title: data.title,
    department: data.department,
    bio: data.bio,
    photo_media_id: data.photo_media_id,
    photoUrl: data.staff_photo && data.staff_photo.bucket === "public" ? getPublicUrl(supabase, data.staff_photo.storage_path) : null,
    is_active: data.is_active,
    created_at: data.created_at,
    spotlightCount: spotlightsResult.count ?? 0,
    contentMentionCount: contentStaffResult.count ?? 0,
  };
}

export interface AdminSpotlightQuestion {
  id: string;
  question: string;
  answer: string;
  display_order: number;
}

/** The staff_id + ordered Q&A behind one STAFF_SPOTLIGHT content row. Null if this content row has no staff_spotlights row yet (shouldn't happen for a real spotlight, but a brand-new/malformed row shouldn't 500 the edit page). */
export async function getSpotlightByContentId(
  contentId: string
): Promise<{ spotlightId: string; staffId: string; questions: AdminSpotlightQuestion[] } | null> {
  const supabase = await createClient();
  const { data: spotlight, error: spotlightError } = await supabase
    .from("staff_spotlights")
    .select("id, staff_id")
    .eq("content_id", contentId)
    .maybeSingle();
  if (spotlightError) throw spotlightError;
  if (!spotlight) return null;

  const { data: questions, error: questionsError } = await supabase
    .from("spotlight_questions")
    .select("id, question, answer, display_order")
    .eq("spotlight_id", spotlight.id)
    .order("display_order", { ascending: true });
  if (questionsError) throw questionsError;

  return { spotlightId: spotlight.id, staffId: spotlight.staff_id, questions: questions ?? [] };
}

/** The staff members linked to one BIRTHDAY content row via content_staff (role='birthday'), see content_staff's own migration comment for why this is a join table rather than a JSONB array. */
export async function getContentStaffIds(contentId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("content_staff").select("staff_id").eq("content_id", contentId);
  if (error) throw error;
  return (data ?? []).map((row) => row.staff_id);
}

export interface AdminMediaRow {
  id: string;
  bucket: "public" | "private";
  storage_path: string;
  original_filename: string | null;
  alt_text: string | null;
  caption: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
  created_at: string;
  url: string | null;
}

export async function listMedia(search?: string, bucket?: "public" | "private", limit = 60): Promise<AdminMediaRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("media")
    .select(
      "id, bucket, storage_path, original_filename, alt_text, caption, mime_type, width, height, file_size_bytes, created_at"
    )
    .is("content_id", null) // gallery-owned media rows are managed from their gallery content, not the general library
    .order("created_at", { ascending: false })
    .limit(limit);

  // Characters with meaning inside a PostgREST .or() filter are stripped so a search for "a,b" or "(x)" cannot change the filter itself.
  const term = search?.replace(/[,()*%\\]/g, " ").trim();
  if (term) {
    query = query.or(
      `alt_text.ilike.%${term}%,caption.ilike.%${term}%,storage_path.ilike.%${term}%,original_filename.ilike.%${term}%`
    );
  }
  if (bucket) query = query.eq("bucket", bucket);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    url: row.bucket === "public" ? getPublicUrl(supabase, row.storage_path) : null,
  }));
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  role: Database["public"]["Enums"]["user_role"];
  full_name: string | null;
  created_at: string;
}

/** Admin-only — backed by public.list_profiles_with_email(), which enforces is_admin() itself. */
export async function listUsers(): Promise<AdminUserRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_profiles_with_email");
  if (error) throw error;
  return data ?? [];
}

/** Groups a flat list of foreign-key values into {value: count}, skipping nulls. Used for the lightweight "N content items" counts shown in the taxonomy managers — a single cheap column-only fetch beats one COUNT query per row. */
function countBy(values: (string | null)[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

export async function listCategories() {
  const supabase = await createClient();
  const [categoriesResult, contentResult] = await Promise.all([
    supabase.from("categories").select("*").order("name", { ascending: true }),
    supabase.from("content").select("category_id"),
  ]);
  if (categoriesResult.error) throw categoriesResult.error;
  if (contentResult.error) throw contentResult.error;

  const counts = countBy((contentResult.data ?? []).map((row) => row.category_id));
  return (categoriesResult.data ?? []).map((category) => ({
    ...category,
    contentCount: counts.get(category.id) ?? 0,
  }));
}

export async function listSections(publicationId?: string) {
  const supabase = await createClient();
  let query = supabase.from("sections").select("*").order("display_order", { ascending: true });
  if (publicationId) query = query.eq("publication_id", publicationId);

  const [sectionsResult, contentResult] = await Promise.all([query, supabase.from("content").select("section_id")]);
  if (sectionsResult.error) throw sectionsResult.error;
  if (contentResult.error) throw contentResult.error;

  const counts = countBy((contentResult.data ?? []).map((row) => row.section_id));
  return (sectionsResult.data ?? []).map((section) => ({
    ...section,
    contentCount: counts.get(section.id) ?? 0,
  }));
}

const PUBLICATION_SELECT = "*, publication_cover:cover_media_id ( storage_path, bucket, alt_text )";

interface PublicationCoverJoin {
  publication_cover: { storage_path: string; bucket: "public" | "private"; alt_text: string | null } | null;
}

function withPublicationCoverUrl<T extends PublicationCoverJoin>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: T
) {
  const { publication_cover, ...rest } = row;
  return {
    ...rest,
    coverUrl: publication_cover && publication_cover.bucket === "public" ? getPublicUrl(supabase, publication_cover.storage_path) : null,
    coverAltText: publication_cover?.alt_text ?? null,
  };
}

export async function listPublications() {
  const supabase = await createClient();
  const [publicationsResult, sectionsResult, contentResult] = await Promise.all([
    supabase
      .from("publications")
      .select(PUBLICATION_SELECT)
      .order("created_at", { ascending: false })
      .returns<(Database["public"]["Tables"]["publications"]["Row"] & PublicationCoverJoin)[]>(),
    supabase.from("sections").select("publication_id"),
    supabase.from("content").select("publication_id"),
  ]);
  if (publicationsResult.error) throw publicationsResult.error;
  if (sectionsResult.error) throw sectionsResult.error;
  if (contentResult.error) throw contentResult.error;

  const sectionCounts = countBy((sectionsResult.data ?? []).map((row) => row.publication_id));
  const contentCounts = countBy((contentResult.data ?? []).map((row) => row.publication_id));
  return (publicationsResult.data ?? []).map((row) => ({
    ...withPublicationCoverUrl(supabase, row),
    sectionCount: sectionCounts.get(row.id) ?? 0,
    contentCount: contentCounts.get(row.id) ?? 0,
  }));
}

export async function getPublicationById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("publications")
    .select(PUBLICATION_SELECT)
    .eq("id", id)
    .maybeSingle()
    .returns<(Database["public"]["Tables"]["publications"]["Row"] & PublicationCoverJoin) | null>();
  if (error) throw error;
  if (!data) return null;
  return withPublicationCoverUrl(supabase, data);
}

interface SiteAssetSlot {
  mediaId: string | null;
  url: string | null;
}

export interface AdminSiteSettings {
  defaultPublicationId: string | null;
  featuredContentId: string | null;
  featuredContentTitle: string | null;
  featuredAuthorIds: string[];
  featuredAuthorNames: { id: string; name: string }[];
  bannerTitle: string | null;
  bannerDescription: string | null;
  siteTitle: string | null;
  seoDefaultDescription: string | null;
  logoPhd: SiteAssetSlot;
  logoSpringboard: SiteAssetSlot;
  favicon: SiteAssetSlot;
  ogImage: SiteAssetSlot;
  homepageArtwork: SiteAssetSlot;
}

const SITE_SETTINGS_SELECT = `
  default_publication_id, featured_content_id, featured_author_ids,
  banner_title, banner_description, site_title, seo_default_description,
  featured_content:featured_content_id ( title ),
  logo_phd:logo_phd_media_id ( id, storage_path, bucket ),
  logo_springboard:logo_springboard_media_id ( id, storage_path, bucket ),
  favicon:favicon_media_id ( id, storage_path, bucket ),
  og_image:og_image_media_id ( id, storage_path, bucket ),
  homepage_artwork:homepage_artwork_media_id ( id, storage_path, bucket )
`;

interface SiteSettingsMediaJoin {
  id: string;
  storage_path: string;
  bucket: "public" | "private";
}

interface SiteSettingsRow {
  default_publication_id: string | null;
  featured_content_id: string | null;
  featured_author_ids: string[] | null;
  banner_title: string | null;
  banner_description: string | null;
  site_title: string | null;
  seo_default_description: string | null;
  featured_content: { title: string } | null;
  logo_phd: SiteSettingsMediaJoin | null;
  logo_springboard: SiteSettingsMediaJoin | null;
  favicon: SiteSettingsMediaJoin | null;
  og_image: SiteSettingsMediaJoin | null;
  homepage_artwork: SiteSettingsMediaJoin | null;
}

function resolveAssetSlot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  join: SiteSettingsMediaJoin | null
): SiteAssetSlot {
  return {
    mediaId: join?.id ?? null,
    url: join && join.bucket === "public" ? getPublicUrl(supabase, join.storage_path) : null,
  };
}

/**
 * All nav items, visible or not — the admin manager needs to show hidden
 * rows too (that's what the visibility toggle is for). Public rendering
 * uses getPublicNavItems() (src/lib/content/queries.ts) instead, which is
 * RLS-scoped to is_visible = true.
 */
export async function getNavItems() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("nav_items").select("*").order("display_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** The single site_settings row is seeded by its migration — always exactly one row, never missing. */
export async function getSiteSettings(): Promise<AdminSiteSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select(SITE_SETTINGS_SELECT)
    .eq("id", true)
    .maybeSingle()
    .returns<SiteSettingsRow | null>();
  if (error) throw error;

  const featuredAuthorIds = data?.featured_author_ids ?? [];
  let featuredAuthorNames: { id: string; name: string }[] = [];
  if (featuredAuthorIds.length > 0) {
    const { data: authorsData } = await supabase.from("authors").select("id, name").in("id", featuredAuthorIds);
    // Preserve the stored order (display order), not whatever order the DB happens to return.
    const byId = new Map((authorsData ?? []).map((a) => [a.id, a.name]));
    featuredAuthorNames = featuredAuthorIds.filter((id) => byId.has(id)).map((id) => ({ id, name: byId.get(id)! }));
  }

  return {
    defaultPublicationId: data?.default_publication_id ?? null,
    featuredContentId: data?.featured_content_id ?? null,
    featuredContentTitle: data?.featured_content?.title ?? null,
    featuredAuthorIds,
    featuredAuthorNames,
    bannerTitle: data?.banner_title ?? null,
    bannerDescription: data?.banner_description ?? null,
    siteTitle: data?.site_title ?? null,
    seoDefaultDescription: data?.seo_default_description ?? null,
    logoPhd: resolveAssetSlot(supabase, data?.logo_phd ?? null),
    logoSpringboard: resolveAssetSlot(supabase, data?.logo_springboard ?? null),
    favicon: resolveAssetSlot(supabase, data?.favicon ?? null),
    ogImage: resolveAssetSlot(supabase, data?.og_image ?? null),
    homepageArtwork: resolveAssetSlot(supabase, data?.homepage_artwork ?? null),
  };
}

// -------------------------------------------------------------------- audit
type AuditAction = Database["public"]["Enums"]["audit_action"];
type AuditEntityType = Database["public"]["Enums"]["audit_entity_type"];

export interface AdminAuditLogRow {
  id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogFilters {
  actorUserId?: string;
  action?: AuditAction;
  entityType?: AuditEntityType;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Names are resolved through list_actor_profiles() (editor/admin-gated
 * SECURITY DEFINER function — see its migration) rather than a normal
 * embedded join, since profiles_select_own_or_admin would otherwise hide
 * every actor except the viewer themselves from a non-admin editor.
 */
export async function listAuditLog(
  filters: AuditLogFilters = {}
): Promise<{ rows: AdminAuditLogRow[]; total: number; page: number; pageSize: number }> {
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("audit_log").select("*", { count: "exact" });
  if (filters.actorUserId) query = query.eq("actor_user_id", filters.actorUserId);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("created_at", filters.dateTo);

  const [logResult, actorsResult] = await Promise.all([
    query.order("created_at", { ascending: false }).range(from, to),
    supabase.rpc("list_actor_profiles"),
  ]);

  if (logResult.error) throw logResult.error;
  // A contributor session can't call list_actor_profiles (editor/admin-only)
  // — that's expected here, since contributors never reach /admin/activity
  // in the first place (audit_log_select_* RLS already blocks them from
  // reading any rows at all), so an error on this call is harmless to swallow.
  const actorNames = new Map((actorsResult.data ?? []).map((row) => [row.id, row.full_name ?? row.email]));

  const rows = (logResult.data ?? []).map((row) => ({
    id: row.id,
    actor_user_id: row.actor_user_id,
    actor_name: row.actor_user_id ? (actorNames.get(row.actor_user_id) ?? null) : "System (scheduler)",
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    created_at: row.created_at,
  }));

  return { rows, total: logResult.count ?? 0, page, pageSize };
}

/** For the Activity page's "User" filter dropdown — same editor/admin-gated function as name resolution above. */
export async function listAuditActors(): Promise<{ id: string; label: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_actor_profiles");
  if (error) return [];
  return (data ?? []).map((row) => ({ id: row.id, label: row.full_name ?? row.email ?? row.id }));
}


/** Items waiting for an editor. RLS-scoped, so for a contributor this is only their own. */
export async function getReviewQueueCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("content").select("id", { count: "exact", head: true }).eq("status", "review");
  if (error) {
    console.error("review count failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

export type ContentStatusCounts = Record<ContentStatus, number>;

function emptyStatusCounts(): ContentStatusCounts {
  return { draft: 0, review: 0, scheduled: 0, published: 0, archived: 0 };
}

/** Status counts for the signed-in user's own content. Real query, scoped by created_by. */
export async function getMyWorkCounts(userId: string): Promise<ContentStatusCounts> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("content").select("status").eq("created_by", userId);
  if (error) throw error;
  const counts = emptyStatusCounts();
  for (const row of data ?? []) counts[row.status] += 1;
  return counts;
}

export interface EditionSnapshot {
  id: string;
  title: string;
  slug: string;
  status: string;
  counts: ContentStatusCounts;
  total: number;
  sectionCount: number;
}

/**
 * The active edition is the Site Settings default publication (the same value that
 * pre-selects a publication for new content). Counts are live queries, never cached.
 */
export async function getActiveEditionSnapshot(): Promise<EditionSnapshot | null> {
  const supabase = await createClient();
  const { data: settings, error: settingsError } = await supabase
    .from("site_settings")
    .select("default_publication_id")
    .eq("id", true)
    .maybeSingle();
  if (settingsError) throw settingsError;
  const id = settings?.default_publication_id;
  if (!id) return null;
  return getEditionSnapshotById(id);
}

export async function getEditionSnapshotById(id: string): Promise<EditionSnapshot | null> {
  const supabase = await createClient();
  const [pub, content, sections] = await Promise.all([
    supabase.from("publications").select("id, title, slug, status").eq("id", id).maybeSingle(),
    supabase.from("content").select("status").eq("publication_id", id),
    supabase.from("sections").select("id", { count: "exact", head: true }).eq("publication_id", id),
  ]);
  if (pub.error) throw pub.error;
  if (content.error) throw content.error;
  if (!pub.data) return null;
  const counts = emptyStatusCounts();
  for (const row of content.data ?? []) counts[row.status] += 1;
  return {
    id: pub.data.id,
    title: pub.data.title,
    slug: pub.data.slug,
    status: pub.data.status,
    counts,
    total: content.data?.length ?? 0,
    sectionCount: sections.count ?? 0,
  };
}


/**
 * Which editions each media file is used in, derived from where the file is actually referenced
 * (story cover, image/gallery/video-thumbnail blocks, gallery attachments, edition cover).
 * No schema change: the same references getMediaUsageAction already follows, read once for the whole library.
 * A file used by a story with no edition maps to NO_EDITION_TOKEN; a file used nowhere has no entry.
 * Runs through the signed-in user's RLS-scoped client.
 */
export async function getMediaEditionUsage(): Promise<Record<string, string[]>> {
  const supabase = await createClient();
  const [contentResult, galleryResult, publicationResult] = await Promise.all([
    supabase.from("content").select("id, publication_id, cover_media_id, body"),
    supabase.from("media").select("id, content_id").not("content_id", "is", null),
    supabase.from("publications").select("id, cover_media_id").not("cover_media_id", "is", null),
  ]);
  if (contentResult.error) throw contentResult.error;

  const usage = new Map<string, Set<string>>();
  const add = (mediaId: unknown, publicationId: string | null) => {
    if (typeof mediaId !== "string" || !mediaId) return;
    const set = usage.get(mediaId) ?? new Set<string>();
    set.add(publicationId ?? NO_EDITION_TOKEN);
    usage.set(mediaId, set);
  };

  const publicationByContent = new Map<string, string | null>();
  for (const row of contentResult.data ?? []) {
    publicationByContent.set(row.id, row.publication_id);
    add(row.cover_media_id, row.publication_id);
    const blocks = (row.body as { blocks?: unknown } | null)?.blocks;
    if (!Array.isArray(blocks)) continue;
    for (const block of blocks as Array<Record<string, unknown>>) {
      add(block?.mediaId, row.publication_id);
      add(block?.thumbnailMediaId, row.publication_id);
      if (Array.isArray(block?.mediaIds)) for (const id of block.mediaIds) add(id, row.publication_id);
    }
  }
  for (const row of galleryResult.data ?? []) {
    if (row.content_id) add(row.id, publicationByContent.get(row.content_id) ?? null);
  }
  for (const row of publicationResult.data ?? []) add(row.cover_media_id, row.id);

  return Object.fromEntries([...usage.entries()].map(([id, set]) => [id, [...set]]));
}

export interface EditionSummary {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  status: string;
  coverMediaId: string | null;
  coverUrl: string | null;
  coverAltText: string | null;
  createdAt: string;
  publishedAt: string | null;
  isActive: boolean;
  counts: ContentStatusCounts;
  total: number;
  sectionCount: number;
  mediaCount: number;
}

/**
 * Editions (publications) with live counts. Every number comes from a query against the real tables on each
 * request: stories by status, sections, and distinct media files referenced by the edition's stories and cover.
 */
export async function listEditionSummaries(): Promise<EditionSummary[]> {
  const supabase = await createClient();
  const [publicationsResult, contentResult, sectionsResult, settingsResult, mediaUsage] = await Promise.all([
    supabase
      .from("publications")
      .select(PUBLICATION_SELECT)
      .order("created_at", { ascending: false })
      .returns<(Database["public"]["Tables"]["publications"]["Row"] & PublicationCoverJoin)[]>(),
    supabase.from("content").select("publication_id, status"),
    supabase.from("sections").select("publication_id"),
    supabase.from("site_settings").select("default_publication_id").eq("id", true).maybeSingle(),
    getMediaEditionUsage(),
  ]);
  if (publicationsResult.error) throw publicationsResult.error;
  if (contentResult.error) throw contentResult.error;
  if (sectionsResult.error) throw sectionsResult.error;

  const activeId = settingsResult.data?.default_publication_id ?? null;
  const statusByPublication = new Map<string, ContentStatusCounts>();
  for (const row of contentResult.data ?? []) {
    if (!row.publication_id) continue;
    const counts = statusByPublication.get(row.publication_id) ?? emptyStatusCounts();
    counts[row.status] += 1;
    statusByPublication.set(row.publication_id, counts);
  }
  const sectionCounts = countBy((sectionsResult.data ?? []).map((row) => row.publication_id));
  const mediaCounts = new Map<string, number>();
  for (const editionIds of Object.values(mediaUsage)) {
    for (const editionId of editionIds) mediaCounts.set(editionId, (mediaCounts.get(editionId) ?? 0) + 1);
  }

  return (publicationsResult.data ?? []).map((row) => {
    const { coverUrl, coverAltText } = withPublicationCoverUrl(supabase, row);
    const counts = statusByPublication.get(row.id) ?? emptyStatusCounts();
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      subtitle: row.subtitle,
      status: row.status,
      coverMediaId: row.cover_media_id,
      coverUrl,
      coverAltText,
      createdAt: row.created_at,
      publishedAt: row.published_at,
      isActive: row.id === activeId,
      counts,
      total: Object.values(counts).reduce((sum, n) => sum + n, 0),
      sectionCount: sectionCounts.get(row.id) ?? 0,
      mediaCount: mediaCounts.get(row.id) ?? 0,
    };
  });
}

export interface EditionWorkspaceData {
  edition: EditionSummary;
  sections: { id: string; title: string; displayOrder: number; storyCount: number }[];
  unsectionedCount: number;
  stories: AdminContentRow[];
  storyTotal: number;
  media: AdminMediaRow[];
}

/** Everything the edition workspace shows, from real queries. Returns null when the edition does not exist or is not visible to this role. */
export async function getEditionWorkspace(id: string, page = 1): Promise<EditionWorkspaceData | null> {
  const supabase = await createClient();
  const summaries = await listEditionSummaries();
  const edition = summaries.find((item) => item.id === id);
  if (!edition) return null;

  const [sectionsResult, sectionContentResult, stories, mediaUsage] = await Promise.all([
    supabase.from("sections").select("id, title, display_order").eq("publication_id", id).order("display_order", { ascending: true }),
    supabase.from("content").select("section_id").eq("publication_id", id),
    listContent({ publicationId: id, page, pageSize: 15, sort: "status" }),
    getMediaEditionUsage(),
  ]);
  if (sectionsResult.error) throw sectionsResult.error;
  if (sectionContentResult.error) throw sectionContentResult.error;

  const perSection = countBy((sectionContentResult.data ?? []).map((row) => row.section_id));
  const sections = (sectionsResult.data ?? []).map((section) => ({
    id: section.id,
    title: section.title,
    displayOrder: section.display_order,
    storyCount: perSection.get(section.id) ?? 0,
  }));
  const unsectionedCount = (sectionContentResult.data ?? []).filter((row) => !row.section_id).length;

  const mediaIds = Object.entries(mediaUsage)
    .filter(([, editionIds]) => editionIds.includes(id))
    .map(([mediaId]) => mediaId)
    .slice(0, 24);
  const media = mediaIds.length ? await listMediaByIds(mediaIds) : [];

  return { edition, sections, unsectionedCount, stories: stories.rows, storyTotal: stories.total, media };
}

async function listMediaByIds(ids: string[]): Promise<AdminMediaRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media")
    .select("id, bucket, storage_path, original_filename, alt_text, caption, mime_type, width, height, file_size_bytes, created_at")
    .in("id", ids);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    url: row.bucket === "public" ? getPublicUrl(supabase, row.storage_path) : null,
  }));
}
