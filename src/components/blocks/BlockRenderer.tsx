import type { Block } from "@/content-types/blocks";
import { ParagraphBlock } from "./ParagraphBlock";
import { HeadingBlock } from "./HeadingBlock";
import { ImageBlock } from "./ImageBlock";
import { GalleryBlock } from "./GalleryBlock";
import { QuoteBlock } from "./QuoteBlock";
import { StatisticBlock } from "./StatisticBlock";
import { VideoBlock } from "./VideoBlock";
import { CalloutBlock } from "./CalloutBlock";
import { RelatedContentBlock } from "./RelatedContentBlock";

interface ResolvedMedia {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  caption?: string;
}

interface ResolvedRelatedContent {
  id: string;
  title: string;
  href: string;
}

export interface BlockRendererProps {
  blocks: Block[];
  /** mediaId -> resolved file info, for image/gallery/video blocks. */
  mediaMap?: Record<string, ResolvedMedia>;
  /** contentId -> resolved link info, for related-content blocks. */
  relatedContent?: ResolvedRelatedContent[];
}

/**
 * Dispatches each block in a content.body document to its renderer by
 * `block.type` — the read-side counterpart to the content-type registry.
 * Media/related-content references are resolved by the caller ahead of time
 * (a single batch query) rather than fetched per-block here.
 */
export function BlockRenderer({ blocks, mediaMap = {}, relatedContent = [] }: BlockRendererProps) {
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "paragraph":
            return <ParagraphBlock key={index} block={block} />;
          case "heading":
            return <HeadingBlock key={index} block={block} />;
          case "image":
            return <ImageBlock key={index} block={block} media={mediaMap[block.mediaId]} />;
          case "gallery":
            return <GalleryBlock key={index} block={block} mediaMap={mediaMap} />;
          case "quote":
            return <QuoteBlock key={index} block={block} />;
          case "statistic":
            return <StatisticBlock key={index} block={block} />;
          case "video":
            return (
              <VideoBlock
                key={index}
                block={block}
                media={block.mediaId ? mediaMap[block.mediaId] : undefined}
              />
            );
          case "callout":
            return <CalloutBlock key={index} block={block} />;
          case "related-content":
            return <RelatedContentBlock key={index} block={block} items={relatedContent} />;
          default:
            return null;
        }
      })}
    </>
  );
}
