"use client";

import { useState } from "react";
import Image from "next/image";
import type { Block, BlockType } from "@/content-types/blocks";
import { AdminButton, AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/ui";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { ContentPicker } from "@/components/admin/ContentPicker";
import type { AdminMediaRow } from "@/lib/admin/queries";

const BLOCK_LABELS: Record<BlockType, string> = {
  paragraph: "Paragraph",
  heading: "Heading",
  image: "Image",
  gallery: "Gallery",
  quote: "Quote",
  statistic: "Statistic",
  video: "Video",
  callout: "Callout",
  "related-content": "Related content",
};

function createDefaultBlock(type: BlockType): Block {
  switch (type) {
    case "paragraph":
      return { type: "paragraph", text: "" };
    case "heading":
      return { type: "heading", level: 2, text: "" };
    case "image":
      return { type: "image", mediaId: "", caption: "", alt: "" };
    case "gallery":
      return { type: "gallery", mediaIds: [] };
    case "quote":
      return { type: "quote", text: "", attribution: "" };
    case "statistic":
      return { type: "statistic", value: "", label: "", description: "" };
    case "video":
      return { type: "video", externalUrl: "", provider: "" };
    case "callout":
      return { type: "callout", style: "info", text: "" };
    case "related-content":
      return { type: "related-content", contentIds: [] };
  }
}

interface BlockEditorProps {
  initialBlocks: Block[];
  /** Excluded from the related-content picker so an item can't reference itself. */
  currentContentId?: string;
  /** Media referenced by existing image/gallery blocks, resolved once up front so thumbnails render without an extra round trip per block. */
  initialMediaById: Record<string, { url: string | null; alt_text: string | null }>;
}

export function BlockEditor({ initialBlocks, currentContentId, initialMediaById }: BlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [mediaById, setMediaById] = useState(initialMediaById);
  const [addType, setAddType] = useState<BlockType>("paragraph");

  function updateBlock(index: number, next: Block) {
    setBlocks((prev) => prev.map((block, i) => (i === index ? next : block)));
  }

  function removeBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setBlocks((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addBlock() {
    setBlocks((prev) => [...prev, createDefaultBlock(addType)]);
  }

  function rememberMedia(media: AdminMediaRow) {
    setMediaById((prev) => ({ ...prev, [media.id]: { url: media.url, alt_text: media.alt_text } }));
  }

  return (
    <div>
      <input type="hidden" name="body" value={JSON.stringify({ version: 1, blocks })} readOnly />

      <div className="space-y-4">
        {blocks.map((block, index) => (
          <div key={index} className="border border-border bg-background p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">
                {index + 1}. {BLOCK_LABELS[block.type]}
              </span>
              <div className="flex gap-2">
                <AdminButton type="button" variant="ghost" disabled={index === 0} onClick={() => moveBlock(index, -1)}>
                  ↑
                </AdminButton>
                <AdminButton
                  type="button"
                  variant="ghost"
                  disabled={index === blocks.length - 1}
                  onClick={() => moveBlock(index, 1)}
                >
                  ↓
                </AdminButton>
                <AdminButton type="button" variant="danger" onClick={() => removeBlock(index)}>
                  Remove
                </AdminButton>
              </div>
            </div>

            <BlockFields
              block={block}
              onChange={(next) => updateBlock(index, next)}
              mediaById={mediaById}
              onMediaResolved={rememberMedia}
              currentContentId={currentContentId}
            />
          </div>
        ))}

        {blocks.length === 0 && (
          <p className="border border-dashed border-border p-6 text-center font-body text-sm text-foreground-muted">
            No blocks yet — add one below.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
        <AdminSelect
          aria-label="Block type to add"
          value={addType}
          onChange={(event) => setAddType(event.target.value as BlockType)}
          className="max-w-[220px]"
        >
          {(Object.keys(BLOCK_LABELS) as BlockType[]).map((type) => (
            <option key={type} value={type}>
              {BLOCK_LABELS[type]}
            </option>
          ))}
        </AdminSelect>
        <AdminButton type="button" variant="secondary" onClick={addBlock}>
          Add block
        </AdminButton>
      </div>
    </div>
  );
}

function BlockFields({
  block,
  onChange,
  mediaById,
  onMediaResolved,
  currentContentId,
}: {
  block: Block;
  onChange: (next: Block) => void;
  mediaById: Record<string, { url: string | null; alt_text: string | null }>;
  onMediaResolved: (media: AdminMediaRow) => void;
  currentContentId?: string;
}) {
  switch (block.type) {
    case "paragraph":
      return (
        <AdminTextarea rows={4} value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} />
      );

    case "heading":
      return (
        <div className="flex gap-3">
          <AdminSelect
            value={block.level}
            onChange={(e) => onChange({ ...block, level: Number(e.target.value) as 2 | 3 | 4 })}
            className="w-24"
          >
            <option value={2}>H2</option>
            <option value={3}>H3</option>
            <option value={4}>H4</option>
          </AdminSelect>
          <AdminInput
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            className="flex-1"
          />
        </div>
      );

    case "quote":
      return (
        <div className="space-y-3">
          <AdminTextarea
            rows={3}
            placeholder="Quote text"
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
          />
          <AdminInput
            placeholder="Attribution (optional)"
            value={block.attribution ?? ""}
            onChange={(e) => onChange({ ...block, attribution: e.target.value || undefined })}
          />
        </div>
      );

    case "statistic":
      return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <AdminInput
            placeholder="Value (e.g. 3.4x)"
            value={block.value}
            onChange={(e) => onChange({ ...block, value: e.target.value })}
          />
          <AdminInput
            placeholder="Label"
            value={block.label}
            onChange={(e) => onChange({ ...block, label: e.target.value })}
          />
          <AdminInput
            placeholder="Description (optional)"
            value={block.description ?? ""}
            onChange={(e) => onChange({ ...block, description: e.target.value || undefined })}
          />
        </div>
      );

    case "callout":
      return (
        <div className="space-y-3">
          <AdminSelect
            value={block.style}
            onChange={(e) => onChange({ ...block, style: e.target.value as "info" | "warning" | "success" })}
            className="w-40"
          >
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="success">Success</option>
          </AdminSelect>
          <AdminTextarea rows={2} value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} />
        </div>
      );

    case "image": {
      const current = block.mediaId ? mediaById[block.mediaId] : undefined;
      return (
        <div className="space-y-3">
          <MediaPicker
            selected={block.mediaId ? { id: block.mediaId, url: current?.url ?? null, alt_text: current?.alt_text ?? null } : null}
            onSelect={(media) => {
              onMediaResolved(media);
              onChange({ ...block, mediaId: media.id, alt: block.alt ?? media.alt_text ?? undefined });
            }}
            onClear={() => onChange({ ...block, mediaId: "" })}
          />
          <AdminInput
            placeholder="Caption (optional)"
            value={block.caption ?? ""}
            onChange={(e) => onChange({ ...block, caption: e.target.value || undefined })}
          />
          <AdminInput
            placeholder="Alt text"
            value={block.alt ?? ""}
            onChange={(e) => onChange({ ...block, alt: e.target.value || undefined })}
          />
        </div>
      );
    }

    case "gallery":
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {block.mediaIds.map((id) => (
              <div key={id} className="relative h-16 w-16 overflow-hidden border border-border">
                {mediaById[id]?.url ? (
                  <Image src={mediaById[id]!.url!} alt="" fill sizes="64px" className="object-cover" />
                ) : null}
                <button
                  type="button"
                  onClick={() => onChange({ ...block, mediaIds: block.mediaIds.filter((existing) => existing !== id) })}
                  className="absolute top-0 right-0 bg-danger px-1 font-body text-[10px] text-foreground"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <MediaPicker
            selected={null}
            onSelect={(media) => {
              onMediaResolved(media);
              if (!block.mediaIds.includes(media.id)) {
                onChange({ ...block, mediaIds: [...block.mediaIds, media.id] });
              }
            }}
          />
        </div>
      );

    case "video":
      return (
        <div className="space-y-3">
          <AdminInput
            placeholder="External video URL (YouTube, Vimeo, ...)"
            value={block.externalUrl ?? ""}
            onChange={(e) => onChange({ ...block, externalUrl: e.target.value || undefined })}
          />
          <AdminInput
            placeholder="Provider (optional, e.g. youtube)"
            value={block.provider ?? ""}
            onChange={(e) => onChange({ ...block, provider: e.target.value || undefined })}
          />
          <p className="font-body text-xs text-foreground-muted">
            Uploaded video media isn&rsquo;t supported in this editor yet — use an external URL.
          </p>
        </div>
      );

    case "related-content":
      return (
        <ContentPicker
          selectedIds={block.contentIds}
          excludeId={currentContentId}
          onChange={(ids) => onChange({ ...block, contentIds: ids })}
        />
      );
  }
}
