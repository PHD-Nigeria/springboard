import { z } from "zod";

/** ARTICLE carries no type-specific fields beyond the shared content columns. */
export const articleMetadataSchema = z.object({}).strict();

export type ArticleMetadata = z.infer<typeof articleMetadataSchema>;
