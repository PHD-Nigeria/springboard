import { z } from "zod";

export const healthTipMetadataSchema = z
  .object({
    source: z.string().optional(),
    sourceUrl: z.url().optional(),
  })
  .strict();

export type HealthTipMetadata = z.infer<typeof healthTipMetadataSchema>;
