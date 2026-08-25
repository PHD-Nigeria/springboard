import type { BodyDocument } from "./blocks";

/** Mirrors the public.content_type enum in supabase/migrations. */
export const CONTENT_TYPES = [
  "EDITOR_NOTE",
  "ARTICLE",
  "COMPANY_NEWS",
  "EVENT",
  "STAFF_SPOTLIGHT",
  "BIRTHDAY",
  "HEALTH_TIP",
  "GALLERY",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

/** Mirrors the public.content_status enum. */
export const CONTENT_STATUSES = [
  "draft",
  "review",
  "scheduled",
  "published",
  "archived",
] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Shape of a row in public.content. */
export interface Content {
  id: string;
  publicationId: string | null;
  contentType: ContentType;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  body: BodyDocument;
  metadata: Record<string, unknown>;
  status: ContentStatus;
  sectionId: string | null;
  authorId: string | null;
  categoryId: string | null;
  coverMediaId: string | null;
  displayOrder: number;
  publishAt: string | null;
  publishedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;

  /**
   * Resolved relations, populated only by list/card queries that join for
   * them (e.g. lib/content/queries.ts's homepage queries) — undefined
   * elsewhere (e.g. a single content fetch by slug). Optional rather than a
   * separate "CardContent" type so the one Content shape still satisfies the
   * content-type registry's `ComponentType<{ content: Content }>` contract
   * for every Card, whether or not the caller populated these.
   */
  category?: { name: string; slug: string } | null;
  author?: { name: string; slug: string } | null;
  coverImageUrl?: string | null;
  /** Route to this content's detail page, built from its publication's slug. */
  href?: string;
}

/** Shape of a row in public.authors, with its avatar resolved to a public URL. */
export interface Author {
  id: string;
  slug: string;
  name: string;
  title: string | null;
  bio: string | null;
  avatarUrl: string | null;
}
