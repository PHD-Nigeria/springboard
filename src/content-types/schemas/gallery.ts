import { z } from "zod";

/**
 * GALLERY's images are `media` rows with content_id = this content row and
 * an explicit display_order — not stored in content.metadata.
 */
export const galleryMetadataSchema = z.object({}).strict();

export type GalleryMetadata = z.infer<typeof galleryMetadataSchema>;
