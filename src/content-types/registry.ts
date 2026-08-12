import type { ComponentType } from "react";
import type { z } from "zod";
import type { Content, ContentType } from "./types";
import { ArticleTemplate } from "@/components/templates/ArticleTemplate";
import { NewsTemplate } from "@/components/templates/NewsTemplate";
import { SpotlightTemplate } from "@/components/templates/SpotlightTemplate";
import { ArticleCard } from "@/components/editorial/ArticleCard";
import { NewsCard } from "@/components/editorial/NewsCard";
import { StaffProfile } from "@/components/editorial/StaffProfile";
import {
  editorNoteMetadataSchema,
  articleMetadataSchema,
  companyNewsMetadataSchema,
  eventMetadataSchema,
  staffSpotlightMetadataSchema,
  birthdayMetadataSchema,
  healthTipMetadataSchema,
  galleryMetadataSchema,
} from "./schemas";

export interface ContentTypeConfig {
  Template: ComponentType<{ content: Content }>;
  Card: ComponentType<{ content: Content }>;
  metadataSchema: z.ZodTypeAny;
}

/**
 * The single extensibility point: every route/section that needs to render a
 * piece of content looks it up here by `content_type` instead of branching
 * on type directly. Adding a 9th content type later means: add the DB enum
 * value, a metadata schema, a Template + Card, and one entry below — nothing
 * else in routing or data-fetching changes.
 *
 * Template/Card mappings below are placeholders (see each component file) —
 * several content types share a template until a dedicated one is designed:
 * EVENT currently reuses NewsTemplate/NewsCard, and BIRTHDAY currently reuses
 * ArticleTemplate/StaffProfile as a generic fallback for the rare case of a
 * direct detail-page visit (its primary presentation is BirthdayGrid, a
 * section-level component that isn't part of this per-item registry).
 */
export const contentTypeRegistry: Record<ContentType, ContentTypeConfig> = {
  EDITOR_NOTE: {
    Template: ArticleTemplate,
    Card: ArticleCard,
    metadataSchema: editorNoteMetadataSchema,
  },
  ARTICLE: {
    Template: ArticleTemplate,
    Card: ArticleCard,
    metadataSchema: articleMetadataSchema,
  },
  HEALTH_TIP: {
    Template: ArticleTemplate,
    Card: ArticleCard,
    metadataSchema: healthTipMetadataSchema,
  },
  COMPANY_NEWS: {
    Template: NewsTemplate,
    Card: NewsCard,
    metadataSchema: companyNewsMetadataSchema,
  },
  EVENT: {
    Template: NewsTemplate,
    Card: NewsCard,
    metadataSchema: eventMetadataSchema,
  },
  GALLERY: {
    Template: NewsTemplate,
    Card: NewsCard,
    metadataSchema: galleryMetadataSchema,
  },
  STAFF_SPOTLIGHT: {
    Template: SpotlightTemplate,
    Card: StaffProfile,
    metadataSchema: staffSpotlightMetadataSchema,
  },
  BIRTHDAY: {
    Template: ArticleTemplate,
    Card: StaffProfile,
    metadataSchema: birthdayMetadataSchema,
  },
};

export function getContentTypeConfig(contentType: ContentType): ContentTypeConfig {
  return contentTypeRegistry[contentType];
}
