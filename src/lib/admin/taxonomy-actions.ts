"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/admin/audit";
import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type PublicationUpsert = Database["public"]["Tables"]["publications"]["Insert"];

function nullableString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

function describeError(message: string): string {
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "You don't have permission to do that with your current role.";
  }
  if (message.includes("duplicate key")) {
    return "That slug is already in use.";
  }
  if (message.includes("foreign key")) {
    return "This is still referenced by existing content — reassign or remove that content first.";
  }
  return message;
}

const NO_PERMISSION_ERROR = "You don't have permission to do that with your current role.";

/**
 * categories_write/sections_write/publications_write all require
 * editor/admin for both USING and WITH CHECK — a contributor's
 * update/delete matches zero rows and returns no `error` rather than
 * throwing (RLS silently filters it out of the affected set). Every
 * mutation below selects the affected row back so that case is
 * detectable and reported, instead of failing silently.
 */
function permissionResult<T>(data: T[] | null): TaxonomyActionResult | null {
  if (!data || data.length === 0) return { error: NO_PERMISSION_ERROR };
  return null;
}

export interface TaxonomyActionResult {
  error: string | null;
}

async function requireUser(supabase: SupabaseClient<Database>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Every FK from content into categories/sections/publications is `on
 * delete set null` (see 20260812010700_content.sql) — the database itself
 * will never block a delete here, it'll just silently null out the
 * reference on any content that had it, which is exactly the "orphaned
 * content" the Phase 4C brief warns against. These usage counts are what
 * let the UI warn before that happens, matching the same
 * check-then-confirm pattern Phase 4B built for media deletion.
 */
export async function getCategoryUsageAction(id: string): Promise<{ count: number }> {
  const supabase = await createClient();
  const { count } = await supabase.from("content").select("id", { count: "exact", head: true }).eq("category_id", id);
  return { count: count ?? 0 };
}

export async function getSectionUsageAction(id: string): Promise<{ count: number }> {
  const supabase = await createClient();
  const { count } = await supabase.from("content").select("id", { count: "exact", head: true }).eq("section_id", id);
  return { count: count ?? 0 };
}

export async function getPublicationUsageAction(id: string): Promise<{ sectionCount: number; contentCount: number }> {
  const supabase = await createClient();
  const [sections, content] = await Promise.all([
    supabase.from("sections").select("id", { count: "exact", head: true }).eq("publication_id", id),
    supabase.from("content").select("id", { count: "exact", head: true }).eq("publication_id", id),
  ]);
  return { sectionCount: sections.count ?? 0, contentCount: content.count ?? 0 };
}

// ---------------------------------------------------------------- categories
export async function saveCategoryAction(formData: FormData): Promise<TaxonomyActionResult> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: "Your session has expired — sign in again." };

  const id = nullableString(formData, "id");
  const name = nullableString(formData, "name");
  const slug = nullableString(formData, "slug");
  if (!name || !slug) return { error: "Name and slug are required." };

  const record = { name, slug, description: nullableString(formData, "description") };

  if (id) {
    const { data, error } = await supabase.from("categories").update(record).eq("id", id).select("id");
    if (error) return { error: describeError(error.message) };
    const denied = permissionResult(data);
    if (denied) return denied;
    await logAuditEvent(supabase, { actorUserId: user.id, action: "UPDATE", entityType: "CATEGORY", entityId: id, metadata: { name, slug } });
  } else {
    const { data, error } = await supabase.from("categories").insert(record).select("id").single();
    if (error) return { error: describeError(error.message) };
    await logAuditEvent(supabase, { actorUserId: user.id, action: "CREATE", entityType: "CATEGORY", entityId: data.id, metadata: { name, slug } });
  }

  revalidatePath("/admin/categories");
  return { error: null };
}

export async function deleteCategoryAction(id: string): Promise<TaxonomyActionResult> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: "Your session has expired — sign in again." };

  const { data, error } = await supabase.from("categories").delete().eq("id", id).select("id, name");
  if (error) return { error: describeError(error.message) };
  const denied = permissionResult(data);
  if (denied) return denied;

  await logAuditEvent(supabase, { actorUserId: user.id, action: "DELETE", entityType: "CATEGORY", entityId: id, metadata: { name: data[0]?.name } });

  revalidatePath("/admin/categories");
  return { error: null };
}

// ------------------------------------------------------------------ sections
export async function saveSectionAction(formData: FormData): Promise<TaxonomyActionResult> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: "Your session has expired — sign in again." };

  const id = nullableString(formData, "id");
  const title = nullableString(formData, "title");
  const slug = nullableString(formData, "slug");
  const publicationId = nullableString(formData, "publication_id");
  if (!title || !slug) return { error: "Title and slug are required." };
  if (!publicationId) return { error: "A publication is required." };

  const record = {
    title,
    slug,
    publication_id: publicationId,
    display_order: Number(formData.get("display_order") ?? 0) || 0,
  };

  if (id) {
    const { data, error } = await supabase.from("sections").update(record).eq("id", id).select("id");
    if (error) return { error: describeError(error.message) };
    const denied = permissionResult(data);
    if (denied) return denied;
    await logAuditEvent(supabase, { actorUserId: user.id, action: "UPDATE", entityType: "SECTION", entityId: id, metadata: { title, slug } });
  } else {
    const { data, error } = await supabase.from("sections").insert(record).select("id").single();
    if (error) return { error: describeError(error.message) };
    await logAuditEvent(supabase, { actorUserId: user.id, action: "CREATE", entityType: "SECTION", entityId: data.id, metadata: { title, slug } });
  }

  revalidatePath("/admin/sections");
  return { error: null };
}

export async function deleteSectionAction(id: string): Promise<TaxonomyActionResult> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: "Your session has expired — sign in again." };

  const { data, error } = await supabase.from("sections").delete().eq("id", id).select("id, title");
  if (error) return { error: describeError(error.message) };
  const denied = permissionResult(data);
  if (denied) return denied;

  await logAuditEvent(supabase, { actorUserId: user.id, action: "DELETE", entityType: "SECTION", entityId: id, metadata: { title: data[0]?.title } });

  revalidatePath("/admin/sections");
  return { error: null };
}

// -------------------------------------------------------------- publications
export async function savePublicationAction(formData: FormData): Promise<TaxonomyActionResult> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: "Your session has expired — sign in again." };

  const id = nullableString(formData, "id");
  const title = nullableString(formData, "title");
  const slug = nullableString(formData, "slug");
  if (!title || !slug) return { error: "Title and slug are required." };

  const statusRaw = nullableString(formData, "status") ?? "draft";
  const status = (["draft", "review", "scheduled", "published", "archived"] as const).includes(
    statusRaw as never
  )
    ? (statusRaw as PublicationUpsert["status"])
    : "draft";
  const record: PublicationUpsert = {
    title,
    slug,
    subtitle: nullableString(formData, "subtitle"),
    cover_media_id: nullableString(formData, "cover_media_id"),
    status,
  };
  if (status === "published") record.published_at = new Date().toISOString();

  if (id) {
    const { data, error } = await supabase.from("publications").update(record).eq("id", id).select("id");
    if (error) return { error: describeError(error.message) };
    const denied = permissionResult(data);
    if (denied) return denied;
    await logAuditEvent(supabase, { actorUserId: user.id, action: "UPDATE", entityType: "PUBLICATION", entityId: id, metadata: { title, slug, status } });
  } else {
    const { data, error } = await supabase.from("publications").insert(record).select("id").single();
    if (error) return { error: describeError(error.message) };
    await logAuditEvent(supabase, { actorUserId: user.id, action: "CREATE", entityType: "PUBLICATION", entityId: data.id, metadata: { title, slug, status } });
  }

  revalidatePath("/admin/publications");
  revalidatePath("/");
  return { error: null };
}

export async function deletePublicationAction(id: string): Promise<TaxonomyActionResult> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: "Your session has expired — sign in again." };

  const { data, error } = await supabase.from("publications").delete().eq("id", id).select("id, title");
  if (error) return { error: describeError(error.message) };
  const denied = permissionResult(data);
  if (denied) return denied;

  await logAuditEvent(supabase, { actorUserId: user.id, action: "DELETE", entityType: "PUBLICATION", entityId: id, metadata: { title: data[0]?.title } });

  revalidatePath("/admin/publications");
  return { error: null };
}

// ------------------------------------------------------------------ settings
/** site_settings_write is admin-only (see 20260815000000_site_settings.sql) — the same permissionResult pattern applies. */
export async function saveSiteSettingsAction(formData: FormData): Promise<TaxonomyActionResult> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: "Your session has expired — sign in again." };

  const defaultPublicationId = nullableString(formData, "default_publication_id");

  const { data: before } = await supabase.from("site_settings").select("default_publication_id").eq("id", true).maybeSingle();

  const { data, error } = await supabase
    .from("site_settings")
    .update({ default_publication_id: defaultPublicationId })
    .eq("id", true)
    .select("id");
  if (error) return { error: describeError(error.message) };
  const denied = permissionResult(data);
  if (denied) return denied;

  await logAuditEvent(supabase, {
    actorUserId: user.id,
    action: "SETTINGS_UPDATE",
    entityType: "SETTINGS",
    metadata: { default_publication_id_before: before?.default_publication_id ?? null, default_publication_id_after: defaultPublicationId },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/content/new");
  return { error: null };
}

/**
 * Homepage editorial configuration + SEO defaults (§12/§14, Phase 4F) —
 * the CMS controls WHICH content/contributors/copy, the existing
 * FeaturedStory/ContributorCard/EditorialBanner components and
 * src/app/layout.tsx's metadata still control HOW it's rendered. A null
 * pick for any field falls back to the pre-existing automatic behavior
 * (most-recent content, alphabetical contributors, hardcoded copy) —
 * nothing breaks if an admin never touches this page.
 */
export async function saveHomepageConfigAction(formData: FormData): Promise<TaxonomyActionResult> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: "Your session has expired — sign in again." };

  const featuredContentId = nullableString(formData, "featured_content_id");
  const featuredAuthorIds = formData
    .getAll("featured_author_id")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
  const bannerTitle = nullableString(formData, "banner_title");
  const bannerDescription = nullableString(formData, "banner_description");
  const siteTitle = nullableString(formData, "site_title");
  const seoDefaultDescription = nullableString(formData, "seo_default_description");

  const { data, error } = await supabase
    .from("site_settings")
    .update({
      featured_content_id: featuredContentId,
      featured_author_ids: featuredAuthorIds.length > 0 ? featuredAuthorIds : null,
      banner_title: bannerTitle,
      banner_description: bannerDescription,
      site_title: siteTitle,
      seo_default_description: seoDefaultDescription,
    })
    .eq("id", true)
    .select("id");
  if (error) return { error: describeError(error.message) };
  const denied = permissionResult(data);
  if (denied) return denied;

  await logAuditEvent(supabase, {
    actorUserId: user.id,
    action: "SETTINGS_UPDATE",
    entityType: "SETTINGS",
    metadata: { section: "homepage_and_seo", featured_content_id: featuredContentId, featured_author_count: featuredAuthorIds.length },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { error: null };
}

/**
 * Site assets (§11, Phase 4F) — each field is a media id, reusing the
 * existing Media Library/MediaPicker entirely; no second media model.
 * Admin-only, same as every other site_settings write.
 */
export async function saveSiteAssetsAction(formData: FormData): Promise<TaxonomyActionResult> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: "Your session has expired — sign in again." };

  const record = {
    logo_phd_media_id: nullableString(formData, "logo_phd_media_id"),
    logo_springboard_media_id: nullableString(formData, "logo_springboard_media_id"),
    favicon_media_id: nullableString(formData, "favicon_media_id"),
    og_image_media_id: nullableString(formData, "og_image_media_id"),
    homepage_artwork_media_id: nullableString(formData, "homepage_artwork_media_id"),
  };

  const { data, error } = await supabase.from("site_settings").update(record).eq("id", true).select("id");
  if (error) return { error: describeError(error.message) };
  const denied = permissionResult(data);
  if (denied) return denied;

  await logAuditEvent(supabase, {
    actorUserId: user.id,
    action: "SETTINGS_UPDATE",
    entityType: "SETTINGS",
    metadata: { section: "site_assets" },
  });

  revalidatePath("/admin/settings/assets");
  revalidatePath("/");
  return { error: null };
}
