import { z } from "zod";

/**
 * Zod schemas for every block type a content.body document can contain.
 * References inside blocks (mediaId, mediaIds, contentIds) are plain UUID
 * strings, not enforced by a Postgres foreign key — validated for
 * well-formedness here, resolved (and soft-failed if stale) at render time.
 */

export const paragraphBlockSchema = z.object({
  type: z.literal("paragraph"),
  text: z.string(),
});

export const headingBlockSchema = z.object({
  type: z.literal("heading"),
  level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  text: z.string(),
});

export const imageBlockSchema = z.object({
  type: z.literal("image"),
  mediaId: z.uuid(),
  caption: z.string().optional(),
  alt: z.string().optional(),
});

export const galleryBlockSchema = z.object({
  type: z.literal("gallery"),
  mediaIds: z.array(z.uuid()).min(1),
});

export const quoteBlockSchema = z.object({
  type: z.literal("quote"),
  text: z.string(),
  attribution: z.string().optional(),
});

export const statisticBlockSchema = z.object({
  type: z.literal("statistic"),
  value: z.string(),
  label: z.string(),
  description: z.string().optional(),
});

// Note: "must have mediaId or externalUrl" is a cross-field constraint that
// can't be expressed with `.refine()` here without breaking discriminated
// union member compatibility (refine wraps the schema in a ZodEffects, which
// z.discriminatedUnion can't introspect for its literal key). Enforced
// instead in `document.ts`'s `parseBodyDocument`.
export const videoBlockSchema = z.object({
  type: z.literal("video"),
  mediaId: z.uuid().optional(),
  externalUrl: z.url().optional(),
  provider: z.string().optional(),
});

export const calloutBlockSchema = z.object({
  type: z.literal("callout"),
  style: z.enum(["info", "warning", "success"]),
  text: z.string(),
});

export const relatedContentBlockSchema = z.object({
  type: z.literal("related-content"),
  contentIds: z.array(z.uuid()).min(1),
});

export const blockSchema = z.discriminatedUnion("type", [
  paragraphBlockSchema,
  headingBlockSchema,
  imageBlockSchema,
  galleryBlockSchema,
  quoteBlockSchema,
  statisticBlockSchema,
  videoBlockSchema,
  calloutBlockSchema,
  relatedContentBlockSchema,
]);
