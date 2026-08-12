import { z } from "zod";
import {
  paragraphBlockSchema,
  headingBlockSchema,
  imageBlockSchema,
  galleryBlockSchema,
  quoteBlockSchema,
  statisticBlockSchema,
  videoBlockSchema,
  calloutBlockSchema,
  relatedContentBlockSchema,
  blockSchema,
} from "./schema";

export type ParagraphBlock = z.infer<typeof paragraphBlockSchema>;
export type HeadingBlock = z.infer<typeof headingBlockSchema>;
export type ImageBlock = z.infer<typeof imageBlockSchema>;
export type GalleryBlock = z.infer<typeof galleryBlockSchema>;
export type QuoteBlock = z.infer<typeof quoteBlockSchema>;
export type StatisticBlock = z.infer<typeof statisticBlockSchema>;
export type VideoBlock = z.infer<typeof videoBlockSchema>;
export type CalloutBlock = z.infer<typeof calloutBlockSchema>;
export type RelatedContentBlock = z.infer<typeof relatedContentBlockSchema>;

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
