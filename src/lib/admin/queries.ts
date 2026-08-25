import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { getPublicUrl } from "@/lib/storage/buckets";

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
  search?: string;
  page?: number;
  pageSize?: number;
}

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
  if (filters.search) query = query.or(`title.ilike.%${filters.search}%,slug.ilike.%${filters.search}%`);

  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
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

  if (search) {
    query = query.or(
      `alt_text.ilike.%${search}%,caption.ilike.%${search}%,storage_path.ilike.%${search}%,original_filename.ilike.%${search}%`
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
