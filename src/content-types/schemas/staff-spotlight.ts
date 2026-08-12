import { z } from "zod";

/**
 * STAFF_SPOTLIGHT's real data (which staff member, the Q&A pairs) lives in
 * the relational `staff_spotlights`/`spotlight_questions` tables, not in
 * content.metadata — those have genuine repeating/ordered child records, the
 * case the schema design explicitly carves out for a dedicated table.
 */
export const staffSpotlightMetadataSchema = z.object({}).strict();

export type StaffSpotlightMetadata = z.infer<typeof staffSpotlightMetadataSchema>;
