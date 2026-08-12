import { z } from "zod";

export const eventMetadataSchema = z
  .object({
    eventDate: z.iso.datetime(),
    eventEndDate: z.iso.datetime().optional(),
    location: z.string().optional(),
    rsvpUrl: z.url().optional(),
  })
  .strict();

export type EventMetadata = z.infer<typeof eventMetadataSchema>;
