import { z } from "zod";
import { blockSchema } from "./schema";

export const BODY_DOCUMENT_VERSION = 1 as const;

export const bodyDocumentSchema = z
  .object({
    version: z.literal(BODY_DOCUMENT_VERSION),
    blocks: z.array(blockSchema),
  })
  .superRefine((doc, ctx) => {
    doc.blocks.forEach((block, index) => {
      if (block.type === "video" && !block.mediaId && !block.externalUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["blocks", index],
          message: "A video block needs either mediaId or externalUrl",
        });
      }
    });
  });

export type BodyDocument = z.infer<typeof bodyDocumentSchema>;

export function createEmptyBodyDocument(): BodyDocument {
  return { version: BODY_DOCUMENT_VERSION, blocks: [] };
}

/**
 * Validates a content row's raw `body` jsonb against the current block
 * schema version. When a future block-shape change ships, add an
 * `upgradeDocument` step here rather than destructively rewriting stored
 * documents.
 */
export function parseBodyDocument(raw: unknown): BodyDocument {
  return bodyDocumentSchema.parse(raw);
}

export function safeParseBodyDocument(raw: unknown) {
  return bodyDocumentSchema.safeParse(raw);
}
