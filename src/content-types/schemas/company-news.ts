import { z } from "zod";

export const companyNewsMetadataSchema = z
  .object({
    announcementType: z.string().optional(),
  })
  .strict();

export type CompanyNewsMetadata = z.infer<typeof companyNewsMetadataSchema>;
