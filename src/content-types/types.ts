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
}
