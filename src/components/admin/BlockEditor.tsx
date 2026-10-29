"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Block, BlockType } from "@/content-types/blocks";
import { AdminButton, AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/ui";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { ContentPicker } from "@/components/admin/ContentPicker";
import { VideoBlockFields } from "@/components/admin/VideoBlockFields";
import type { AdminMediaRow } from "@/lib/admin/queries";

const BLOCK_META: Record<BlockType, { label: string; description: string; keywords: string }> = {
  paragraph: { label: "Paragraph", description: "Body text", keywords: "text body copy write" },
  heading: { label: "Heading", description: "A section title (H2 to H4)", keywords: "title subheading h2 h3 h4" },
  image: { label: "Image", description: "One picture with caption and alt text", keywords: "photo picture media" },
  gallery: { label: "Gallery", description: "Several pictures together", keywords: "photos pictures slideshow grid" },
  quote: { label: "Quote", description: "A pull quote with attribution", keywords: "pullquote testimonial" },
  statistic: { label: "Statistic", description: "A big number with a label", keywords: "number figure stat data" },
  video: { label: "Video", description: "A YouTube video", keywords: "youtube movie clip" },
  callout: { label: "Callout", description: "Highlighted note: info, warning or success", keywords: "note alert highlight box" },
  "related-content": { label: "Related content", description: "Links to other stories", keywords: "links more reading" },
};
const BLOCK_TYPES = Object.keys(BLOCK_META) as BlockType[];

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
      return { type: "video", provider: "youtube", orientation: "landscape" };
    case "callout":
      return { type: "callout", style: "info", text: "" };
    case "related-content":
      return { type: "related-content", contentIds: [] };
  }
}

/** One short line that says what a block holds, shown on the block header and when it is collapsed. */
function summarize(block: Block): string {
  const clip = (text: string) => (text.length > 90 ? `${text.slice(0, 90)}…` : text);
  switch (block.type) {
    case "paragraph":
    case "callout":
    case "quote":
      return block.text.trim() ? clip(block.text.trim()) : "Empty";
    case "heading":
      return block.text.trim() ? `H${block.level}: ${clip(block.text.trim())}` : "Empty";
    case "image":
      return block.mediaId ? (block.alt ? `Alt: ${clip(block.alt)}` : "No alt text yet") : "No image chosen";
    case "gallery":
      return `${block.mediaIds.length} ${block.mediaIds.length === 1 ? "image" : "images"}`;
    case "statistic":
      return [block.value, block.label].filter(Boolean).join(" · ") || "Empty";
    case "video":
      return block.title?.trim() || (block.videoId ? "YouTube video" : "No video link yet");
    case "related-content":
      return `${block.contentIds.length} ${block.contentIds.length === 1 ? "story" : "stories"}`;
  }
}

/**
 * Mirrors the cases the server refuses (src/content-types/blocks/schema.ts and normalize-video-blocks),
 * so the editor can point at the block instead of reporting a generic failure. The server stays the authority.
 */
export function blockProblem(block: Block): string | null {
  switch (block.type) {
    case "image":
      return block.mediaId ? null : "Choose an image";
    case "gallery":
      return block.mediaIds.length > 0 ? null : "Add at least one image";
    case "related-content":
      return block.contentIds.length > 0 ? null : "Choose at least one story";
    case "video":
      return block.videoId || block.mediaId || block.externalUrl ? null : "Paste a YouTube link";
    default:
      return null;
  }
}

interface Item {
  key: number;
  block: Block;
}

interface BlockEditorProps {
  initialBlocks: Block[];
  /** Excluded from the related-content picker so an item can't reference itself. */
  currentContentId?: string;
  /** Media referenced by existing image/gallery blocks, resolved once up front so thumbnails render without an extra round trip per block. */
  initialMediaById: Record<string, { url: string | null; alt_text: string | null }>;
  /** Called on any edit so the surrounding form can warn about unsaved changes. */
  onDirty?: () => void;
  /** Reports the current blocks after every edit so the publishing panel can show real readiness. */
  onBlocksChange?: (blocks: Block[]) => void;
}

export function BlockEditor({ initialBlocks, currentContentId, initialMediaById, onDirty, onBlocksChange }: BlockEditorProps) {
  const seq = useRef(initialBlocks.length);
  const nextKey = () => (seq.current += 1);
  const [items, setItems] = useState<Item[]>(() => initialBlocks.map((block, index) => ({ key: index, block })));
  const [mediaById, setMediaById] = useState(initialMediaById);
  const [inserter, setInserter] = useState<{ index: number } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [removed, setRemoved] = useState<{ item: Item; index: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const focusKey = useRef<number | null>(null);
  const containerRefs = useRef(new Map<number, HTMLDivElement>());

  const blocks = items.map((item) => item.block);

  // After inserting, move focus into the new block's first field so typing can start immediately.
  useEffect(() => {
    if (focusKey.current === null) return;
    const el = containerRefs.current.get(focusKey.current);
    focusKey.current = null;
    el?.querySelector<HTMLElement>("textarea, input:not([type=hidden]), select, button")?.focus();
  });

  /** Every mutation goes through here so the dirty flag and the readiness summary can never drift from what will be saved. */
  function commit(next: Item[]) {
    setItems(next);
    onDirty?.();
    onBlocksChange?.(next.map((item) => item.block));
  }

  function updateBlock(key: number, next: Block) {
    commit(items.map((item) => (item.key === key ? { ...item, block: next } : item)));
  }

  function insertBlock(type: BlockType, at: number) {
    const item = { key: nextKey(), block: createDefaultBlock(type) };
    commit([...items.slice(0, at), item, ...items.slice(at)]);
    focusKey.current = item.key;
    setRemoved(null);
    setAnnouncement(`${BLOCK_META[type].label} block added at position ${at + 1}.`);
  }

  function removeBlock(index: number) {
    const item = items[index];
    commit(items.filter((_, i) => i !== index));
    setRemoved({ item, index });
    setAnnouncement(`${BLOCK_META[item.block.type].label} block removed. Undo is available.`);
  }

  function undoRemove() {
    if (!removed) return;
    const { item, index } = removed;
    const at = Math.min(index, items.length);
    commit([...items.slice(0, at), item, ...items.slice(at)]);
    setRemoved(null);
    setAnnouncement(`${BLOCK_META[item.block.type].label} block restored.`);
  }

  function moveBlock(from: number, to: number) {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
    setAnnouncement(`${BLOCK_META[moved.block.type].label} block moved to position ${to + 1} of ${items.length}.`);
  }

  function toggleCollapsed(key: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function rememberMedia(media: AdminMediaRow) {
    setMediaById((prev) => ({ ...prev, [media.id]: { url: media.url, alt_text: media.alt_text } }));
  }

  const problems = blocks.filter((block) => blockProblem(block)).length;

  return (
    <div>
      <input type="hidden" name="body" value={JSON.stringify({ version: 1, blocks })} readOnly />
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-body text-xs text-foreground-muted">
          {items.length} {items.length === 1 ? "block" : "blocks"}
          {problems > 0 && <span className="ml-2 font-semibold text-danger">{problems} need attention</span>}
        </p>
        {items.length > 1 && (
          <div className="flex gap-3 font-body text-xs">
            <button type="button" className="text-primary-600 underline underline-offset-2" onClick={() => setCollapsed(new Set(items.map((i) => i.key)))}>
              Collapse all
            </button>
            <button type="button" className="text-primary-600 underline underline-offset-2" onClick={() => setCollapsed(new Set())}>
              Expand all
            </button>
          </div>
        )}
      </div>

      <ul className="space-y-3">
        {items.map((item, index) => {
          const { block, key } = item;
          const problem = blockProblem(block);
          const isCollapsed = collapsed.has(key);
          return (
            <li
              key={key}
              ref={(el) => {
                if (el) containerRefs.current.set(key, el as unknown as HTMLDivElement);
                else containerRefs.current.delete(key);
              }}
              onDragOver={(event) => {
                if (dragIndex === null) return;
                event.preventDefault();
                setOverIndex(index);
              }}
              onDrop={(event) => {
                if (dragIndex === null) return;
                event.preventDefault();
                moveBlock(dragIndex, index);
                setDragIndex(null);
                setOverIndex(null);
              }}
              className={`border bg-surface ${problem ? "border-danger" : "border-border"} ${overIndex === index && dragIndex !== null && dragIndex !== index ? "border-t-[3px] border-t-primary-500" : ""}`}
            >
              <div className="flex items-center gap-2 border-b border-border bg-surface-raised px-2 py-1.5">
                <span
                  aria-hidden="true"
                  title="Drag to reorder (or use the move buttons)"
                  draggable
                  onDragStart={(event) => {
                    setDragIndex(index);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(index));
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  className="cursor-grab px-1 font-body text-base leading-none text-foreground-muted select-none active:cursor-grabbing"
                >
                  ⠿
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-xs font-semibold text-foreground">
                    {index + 1}. {BLOCK_META[block.type].label}
                    {problem && <span className="ml-2 font-bold text-danger">· {problem}</span>}
                  </p>
                  {isCollapsed && <p className="truncate font-body text-xs text-foreground-muted">{summarize(block)}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton label={`${isCollapsed ? "Expand" : "Collapse"} block ${index + 1}`} onClick={() => toggleCollapsed(key)}>
                    {isCollapsed ? "Expand" : "Collapse"}
                  </IconButton>
                  <IconButton label={`Move block ${index + 1} up`} disabled={index === 0} onClick={() => moveBlock(index, index - 1)}>
                    ↑
                  </IconButton>
                  <IconButton label={`Move block ${index + 1} down`} disabled={index === items.length - 1} onClick={() => moveBlock(index, index + 1)}>
                    ↓
                  </IconButton>
                  <IconButton label={`Add a block below block ${index + 1}`} onClick={() => setInserter({ index: index + 1 })}>
                    +
                  </IconButton>
                  <IconButton label={`Remove block ${index + 1}`} danger onClick={() => removeBlock(index)}>
                    Remove
                  </IconButton>
                </div>
              </div>
              {!isCollapsed && (
                <div className="p-3">
                  <BlockFields
                    block={block}
                    onChange={(next) => updateBlock(key, next)}
                    mediaById={mediaById}
                    onMediaResolved={rememberMedia}
                    currentContentId={currentContentId}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {items.length === 0 && (
        <p className="border border-dashed border-border-strong bg-surface p-6 text-center font-body text-sm text-foreground-muted">
          This story has no content yet. Add a paragraph, image, video or any other block to begin.
        </p>
      )}

      {removed && (
        <p role="status" className="mt-3 flex items-center gap-3 border border-border-strong bg-surface-raised px-3 py-2 font-body text-sm text-foreground">
          {BLOCK_META[removed.item.block.type].label} block removed.
          <button type="button" onClick={undoRemove} className="font-semibold text-primary-600 underline underline-offset-2">
            Undo
          </button>
        </p>
      )}

      <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
        <AdminButton type="button" variant="secondary" onClick={() => setInserter({ index: items.length })}>
          + Add block
        </AdminButton>
        <span className="font-body text-xs text-foreground-muted">Search the list by typing, for example &ldquo;video&rdquo;.</span>
      </div>

      <BlockInserter
        open={inserter !== null}
        onClose={() => setInserter(null)}
        onPick={(type) => {
          if (inserter) insertBlock(type, inserter.index);
          setInserter(null);
        }}
      />
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-8 min-w-8 border px-2 font-body text-xs font-medium transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? "border-danger text-danger hover:bg-danger/10" : "border-border bg-surface text-foreground hover:border-border-strong"
      }`}
    >
      {children}
    </button>
  );
}

/** Searchable block chooser. Native dialog: focus is trapped, Escape closes, focus returns to the control that opened it. */
function BlockInserter({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (type: BlockType) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const needle = query.trim().toLowerCase();
  const matches = BLOCK_TYPES.filter((type) => {
    if (!needle) return true;
    const meta = BLOCK_META[type];
    return `${meta.label} ${meta.description} ${meta.keywords}`.toLowerCase().includes(needle);
  });

  function close() {
    setQuery("");
    onClose();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="inserter-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === ref.current) close();
      }}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] border border-border-strong bg-surface p-0 text-foreground backdrop:bg-[#1a0b3b]/60"
    >
      <div className="border-b border-border p-4">
        <h2 id="inserter-title" className="mb-2 font-display text-base font-semibold">
          Add a block
        </h2>
        <label htmlFor="inserter-search" className="sr-only">
          Search blocks
        </label>
        <AdminInput
          id="inserter-search"
          ref={searchRef}
          type="search"
          autoFocus
          value={query}
          placeholder="Search blocks…"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && matches[0]) {
              event.preventDefault();
              setQuery("");
              onPick(matches[0]);
            }
          }}
        />
      </div>
      <ul className="max-h-[50vh] overflow-y-auto">
        {matches.map((type) => (
          <li key={type}>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                onPick(type);
              }}
              className="flex w-full flex-col border-b border-border px-4 py-2.5 text-left hover:bg-surface-raised focus-visible:bg-surface-raised"
            >
              <span className="font-body text-sm font-semibold">{BLOCK_META[type].label}</span>
              <span className="font-body text-xs text-foreground-muted">{BLOCK_META[type].description}</span>
            </button>
          </li>
        ))}
        {matches.length === 0 && <li className="px-4 py-6 font-body text-sm text-foreground-muted">No block matches &ldquo;{query}&rdquo;.</li>}
      </ul>
      <div className="flex justify-between border-t border-border bg-surface-raised px-4 py-2">
        <span className="font-body text-xs text-foreground-muted">Enter adds the first match</span>
        <AdminButton type="button" variant="secondary" onClick={close}>
          Cancel
        </AdminButton>
      </div>
    </dialog>
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
        <AdminTextarea aria-label="Paragraph text" rows={4} value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} />
      );

    case "heading":
      return (
        <div className="flex gap-3">
          <AdminSelect
            aria-label="Heading level"
            value={block.level}
            onChange={(e) => onChange({ ...block, level: Number(e.target.value) as 2 | 3 | 4 })}
            className="w-24"
          >
            <option value={2}>H2</option>
            <option value={3}>H3</option>
            <option value={4}>H4</option>
          </AdminSelect>
          <AdminInput
            aria-label="Heading text"
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
            aria-label="Quote text"
            rows={3}
            placeholder="Quote text"
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
          />
          <AdminInput
            aria-label="Attribution"
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
            aria-label="Statistic value"
            placeholder="Value (e.g. 3.4x)"
            value={block.value}
            onChange={(e) => onChange({ ...block, value: e.target.value })}
          />
          <AdminInput
            aria-label="Statistic label"
            placeholder="Label"
            value={block.label}
            onChange={(e) => onChange({ ...block, label: e.target.value })}
          />
          <AdminInput
            aria-label="Statistic description"
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
            aria-label="Callout style"
            value={block.style}
            onChange={(e) => onChange({ ...block, style: e.target.value as "info" | "warning" | "success" })}
            className="w-40"
          >
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="success">Success</option>
          </AdminSelect>
          <AdminTextarea aria-label="Callout text" rows={2} value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} />
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
            aria-label="Image caption"
            placeholder="Caption (optional)"
            value={block.caption ?? ""}
            onChange={(e) => onChange({ ...block, caption: e.target.value || undefined })}
          />
          <AdminInput
            aria-label="Image alt text (describes the picture for screen readers)"
            placeholder="Alt text: describe the picture"
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
                  aria-label="Remove this image from the gallery"
                  className="absolute top-0 right-0 bg-danger px-1.5 py-0.5 font-body text-xs font-bold text-white"
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
      return <VideoBlockFields block={block} onChange={onChange} mediaById={mediaById} onMediaResolved={onMediaResolved} />;

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
