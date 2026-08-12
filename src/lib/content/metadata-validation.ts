import { getContentTypeConfig } from "@/content-types/registry";
import type { ContentType } from "@/content-types/types";

/** Validates a content row's `metadata` jsonb against its content-type's registered zod schema. */
export function validateContentMetadata(contentType: ContentType, metadata: unknown) {
  return getContentTypeConfig(contentType).metadataSchema.parse(metadata);
}

export function safeValidateContentMetadata(contentType: ContentType, metadata: unknown) {
  return getContentTypeConfig(contentType).metadataSchema.safeParse(metadata);
}
