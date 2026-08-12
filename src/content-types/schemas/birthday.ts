import { z } from "zod";

/**
 * BIRTHDAY's staff references live in the `content_staff` join table (with
 * role = 'birthday'), not in content.metadata — see content_staff in the
 * schema for why a join table beats a JSONB array of staff ids here.
 */
export const birthdayMetadataSchema = z.object({}).strict();

export type BirthdayMetadata = z.infer<typeof birthdayMetadataSchema>;
