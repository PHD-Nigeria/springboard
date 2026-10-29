"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Image from "next/image";
import {
  searchMediaAction,
  updateMediaAction,
  deleteMediaAction,
  promoteMediaAction,
  replaceMediaAction,
  getMediaUsageAction,
  getPrivateMediaPreviewUrlsAction,
  findMediaDuplicatesAction,
  type MediaUsageRow,
  type MediaDuplicateMatch,
} from "@/lib/admin/media-actions";
import { uploadMediaDirect, isRetryableMediaUploadError, type MediaUploadStage } from "@/lib/admin/media-upload-client";
import type { AdminMediaRow } from "@/lib/admin/queries";
import { NO_EDITION_TOKEN } from "@/lib/admin/media-constants";
import type { AdminSession } from "@/lib/auth/session";
import { AdminButton, AdminInput, AdminLabel, AdminNotice, AdminSelect, AdminEmptyState } from "@/components/admin/ui";

const STAGE_LABEL: Record<MediaUploadStage, string> = {
  preparing: "Preparing…",
  uploading: "Uploading…",
  saving: "Saving…",
};

const TYPE_FILTERS = [
  { label: "All image types", value: "" },
  { label: "JPEG", value: "image/jpeg" },
  { label: "PNG", value: "image/png" },
  { label: "WebP", value: "image/webp" },
];

type SortKey = "newest" | "oldest" | "name" | "size";
type ViewMode = "grid" | "list";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function displayName(item: AdminMediaRow): string {
  return item.original_filename ?? item.storage_path.split("/").pop() ?? item.storage_path;
}

function orientationOf(width: number | null, height: number | null): "Landscape" | "Portrait" | "Square" | null {
  if (!width || !height) return null;
  if (width === height) return "Square";
  return width > height ? "Landscape" : "Portrait";
}

/** Visibility is shown as text plus a marker, never colour alone. */
function VisibilityBadge({ bucket }: { bucket: "public" | "private" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-body text-[11px] font-semibold whitespace-nowrap ${
        bucket === "public" ? "border-primary-500 bg-primary-50 text-foreground" : "border-border-strong bg-surface-raised text-foreground"
      }`}
    >
      <span aria-hidden="true">{bucket === "public" ? "●" : "🔒︎"}</span>
      {bucket === "public" ? "Public" : "Private"}
    </span>
  );
}

/** Defined at module level on purpose: a component created inside another component's render is remounted on every render. */
function MediaThumb({
  item,
  previews,
  onError,
  sizes,
  className,
}: {
  item: AdminMediaRow;
  previews: Record<string, string>;
  onError: (id: string) => void;
  sizes: string;
  className: string;
}) {
  if (item.url) return <Image src={item.url} alt="" fill sizes={sizes} className={className} />;
  if (previews[item.id]) {
    // Signed private-bucket URL: not eligible for next/image's optimizer (public-bucket paths only), so a plain <img>.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={previews[item.id]} alt="" loading="lazy" decoding="async" onError={() => onError(item.id)} className={`h-full w-full ${className}`} />;
  }
  return <div className="flex h-full w-full items-center justify-center font-body text-[11px] text-foreground-muted">Private</div>;
}

interface MediaLibraryProps {
  initialMedia: AdminMediaRow[];
  /** media id -> edition ids it is used in (NO_EDITION_TOKEN for stories without an edition). Derived from real references. */
  editionUsage: Record<string, string[]>;
  editions: { id: string; title: string }[];
  role: AdminSession["role"];
}

export function MediaLibrary({ initialMedia, editionUsage, editions, role }: MediaLibraryProps) {
  const [media, setMedia] = useState(initialMedia);
  const [query, setQuery] = useState("");
  const [bucketFilter, setBucketFilter] = useState<"" | "public" | "private">("");
  const [typeFilter, setTypeFilter] = useState("");
  const [editionFilter, setEditionFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<ViewMode>("grid");
  const [selected, setSelected] = useState<AdminMediaRow | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadStage, setUploadStage] = useState<MediaUploadStage | null>(null);
  const [duplicates, setDuplicates] = useState<MediaDuplicateMatch[]>([]);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Short-lived signed URLs for private items (id -> URL), fetched through an
  // authorised server action. Held in memory only — never saved or sent anywhere else.
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const previewRetried = useRef<Set<string>>(new Set());

  async function loadPreviews(ids: string[]) {
    for (let start = 0; start < ids.length; start += 100) {
      const result = await getPrivateMediaPreviewUrlsAction(ids.slice(start, start + 100));
      if (Object.keys(result.urls).length > 0) setPreviews((prev) => ({ ...prev, ...result.urls }));
    }
  }

  useEffect(() => {
    const missing = media.filter((item) => item.bucket === "private" && !previews[item.id]).map((item) => item.id);
    if (missing.length === 0) return;
    // Mark as tried so a row that can't be previewed (e.g. missing object) isn't re-requested on every render.
    const fresh = missing.filter((id) => !previewRetried.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => previewRetried.current.add(id));
    void loadPreviews(fresh);
  }, [media, previews]);

  /**
   * A preview failed to load — most likely its signed URL expired while the page stayed open. Drop it and ask for
   * one fresh URL. A second failure for the same image (e.g. the object is genuinely missing) gives up and shows
   * the "private" placeholder instead of looping.
   */
  const previewFailures = useRef<Set<string>>(new Set());
  function refreshPreview(id: string) {
    setPreviews((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (previewFailures.current.has(id)) return; // already retried once: stay on the placeholder
    previewFailures.current.add(id);
    previewRetried.current.delete(id);
  }

  function refetch(nextQuery: string, nextBucket: "" | "public" | "private") {
    startTransition(async () => {
      setMedia(await searchMediaAction(nextQuery || undefined, nextBucket || undefined));
    });
  }

  function runSearch(next: string) {
    setQuery(next);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => refetch(next, bucketFilter), 250);
  }

  function runBucketFilter(next: "" | "public" | "private") {
    setBucketFilter(next);
    refetch(query, next);
  }

  const editionTitle = (id: string) => (id === NO_EDITION_TOKEN ? "No edition" : (editions.find((e) => e.id === id)?.title ?? "Unknown edition"));

  const visibleMedia = media
    .filter((item) => !typeFilter || item.mime_type === typeFilter)
    .filter((item) => {
      if (!editionFilter) return true;
      const used = editionUsage[item.id];
      if (editionFilter === "unused") return !used || used.every((id) => id === NO_EDITION_TOKEN);
      return Boolean(used?.includes(editionFilter));
    })
    .sort((a, b) => {
      if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
      if (sort === "name") return displayName(a).localeCompare(displayName(b));
      if (sort === "size") return (b.file_size_bytes ?? 0) - (a.file_size_bytes ?? 0);
      return b.created_at.localeCompare(a.created_at);
    });

  async function onFileChosen(file: File | undefined) {
    setDuplicates([]);
    setAllowDuplicate(false);
    if (!file) return;
    const result = await findMediaDuplicatesAction([{ name: file.name, size: file.size }]);
    if (!result.error) setDuplicates(result.matches[0] ?? []);
  }

  const probableDuplicate = duplicates.some((match) => match.sameSize);

  function handleUpload(formData: FormData) {
    setUploadError(null);
    setNotice(null);
    const file = formData.get("file");
    if (probableDuplicate && !allowDuplicate) {
      setUploadError("This looks like a file that is already in the library. Tick “Upload anyway” if you want a second copy.");
      return;
    }
    const altText = String(formData.get("alt_text") ?? "");
    const caption = String(formData.get("caption") ?? "");
    startTransition(async () => {
      const result = await uploadMediaDirect(file instanceof File ? file : null, {
        altText,
        caption,
        bucket: "private",
        onStageChange: setUploadStage,
      });
      setUploadStage(null);
      if (result.error) {
        setUploadError(result.error);
        return;
      }
      if (result.media) {
        setMedia((prev) => [result.media!, ...prev]);
        setNotice({ tone: "success", text: "Uploaded. The image is private until an administrator promotes it." });
        setDuplicates([]);
        setAllowDuplicate(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  }

  function updateItem(next: AdminMediaRow) {
    setMedia((prev) => prev.map((item) => (item.id === next.id ? next : item)));
    setSelected(next);
  }

  function handleMetadataSave(id: string, alt_text: string, caption: string) {
    setNotice(null);
    startTransition(async () => {
      const result = await updateMediaAction(id, { alt_text: alt_text || null, caption: caption || null });
      if (result.error) {
        setNotice({ tone: "error", text: result.error });
        return;
      }
      setMedia((prev) => prev.map((item) => (item.id === id ? { ...item, alt_text: alt_text || null, caption: caption || null } : item)));
      setSelected(null);
      setNotice({ tone: "success", text: "Details saved." });
    });
  }

  function handlePromote(id: string) {
    setNotice(null);
    startTransition(async () => {
      const result = await promoteMediaAction(id);
      if (result.error) {
        setNotice({ tone: "error", text: result.error });
        return;
      }
      if (result.media) {
        updateItem(result.media);
        setNotice({ tone: "success", text: "Promoted. The image is now public." });
      }
    });
  }

  function handleReplace(id: string, formData: FormData) {
    setNotice(null);
    startTransition(async () => {
      const result = await replaceMediaAction(id, formData);
      if (result.error) {
        setNotice({ tone: "error", text: result.error });
        return;
      }
      if (result.media) {
        updateItem(result.media);
        setNotice({ tone: "success", text: "File replaced." });
      }
    });
  }

  function handleDelete(item: AdminMediaRow) {
    setNotice(null);
    startTransition(async () => {
      const result = await deleteMediaAction(item.id, item.bucket, item.storage_path);
      if (result.error) {
        setNotice({ tone: "error", text: result.error });
        return;
      }
      setMedia((prev) => prev.filter((existing) => existing.id !== item.id));
      setSelected(null);
      setNotice({ tone: "success", text: "Deleted." });
    });
  }

  const editionsInUse = new Set(Object.values(editionUsage).flat());

  return (
    <div>
      {notice && (
        <AdminNotice tone={notice.tone} className="mb-4">
          {notice.text}
        </AdminNotice>
      )}

      <form id="upload" action={handleUpload} className="mb-5 scroll-mt-4 border border-border bg-surface p-4">
        <h2 className="mb-3 font-display text-sm font-semibold text-foreground">Upload an image</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <AdminLabel htmlFor="upload-file">Image file (JPEG, PNG or WebP, up to 25 MB)</AdminLabel>
            <input
              id="upload-file"
              ref={fileInputRef}
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(event) => void onFileChosen(event.target.files?.[0])}
              className="font-body text-sm text-foreground"
            />
          </div>
          <div>
            <AdminLabel htmlFor="upload-alt">Alt text</AdminLabel>
            <AdminInput id="upload-alt" name="alt_text" placeholder="Describe the picture" className="w-56" />
          </div>
          <div>
            <AdminLabel htmlFor="upload-caption">Caption (optional)</AdminLabel>
            <AdminInput id="upload-caption" name="caption" className="w-56" />
          </div>
          <input type="hidden" name="bucket" value="private" />
          <AdminButton type="submit" disabled={pending}>
            {uploadStage ? STAGE_LABEL[uploadStage] : uploadError && isRetryableMediaUploadError(uploadError) ? "Try again" : "Upload"}
          </AdminButton>
        </div>
        <p className="mt-2 font-body text-xs text-foreground-muted">New uploads are private. Only an administrator can make an image public.</p>
        {duplicates.length > 0 && (
          <div className="mt-3 border border-border-strong bg-surface-raised p-3" role="status">
            <p className="font-body text-sm font-semibold text-foreground">
              {probableDuplicate ? "This looks like a duplicate." : "A file with this name is already in the library."}
            </p>
            <ul className="mt-1 list-inside list-disc font-body text-xs text-foreground-muted">
              {duplicates.map((match) => (
                <li key={match.id}>
                  {match.original_filename} · {match.bucket} · {new Date(match.created_at).toLocaleDateString("en-GB")}
                  {match.sameSize ? " · same size" : " · different size"}
                </li>
              ))}
            </ul>
            {probableDuplicate && (
              <label className="mt-2 flex items-center gap-2 font-body text-sm text-foreground">
                <input type="checkbox" checked={allowDuplicate} onChange={(event) => setAllowDuplicate(event.target.checked)} />
                Upload anyway
              </label>
            )}
          </div>
        )}
        {uploadError && (
          <p role="alert" className="mt-3 font-body text-sm text-danger">
            {uploadError}
          </p>
        )}
      </form>

      <div className="mb-4 grid grid-cols-1 items-end gap-3 border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(9rem,1fr))_auto]">
        <div>
          <AdminLabel htmlFor="media-search">Search</AdminLabel>
          <AdminInput id="media-search" type="search" placeholder="Filename, alt text or caption" value={query} onChange={(e) => runSearch(e.target.value)} />
        </div>
        <div>
          <AdminLabel htmlFor="media-visibility">Visibility</AdminLabel>
          <AdminSelect id="media-visibility" value={bucketFilter} onChange={(e) => runBucketFilter(e.target.value as "" | "public" | "private")}>
            <option value="">Public and private</option>
            <option value="public">Public only</option>
            <option value="private">Private only</option>
          </AdminSelect>
        </div>
        <div>
          <AdminLabel htmlFor="media-type">Type</AdminLabel>
          <AdminSelect id="media-type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {TYPE_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AdminSelect>
        </div>
        <div>
          <AdminLabel htmlFor="media-edition">Edition</AdminLabel>
          <AdminSelect id="media-edition" value={editionFilter} onChange={(e) => setEditionFilter(e.target.value)}>
            <option value="">All editions</option>
            {editions
              .filter((edition) => editionsInUse.has(edition.id))
              .map((edition) => (
                <option key={edition.id} value={edition.id}>
                  {edition.title}
                </option>
              ))}
            <option value="unused">Not used in an edition</option>
          </AdminSelect>
        </div>
        <div>
          <AdminLabel htmlFor="media-sort">Sort</AdminLabel>
          <AdminSelect id="media-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">File name</option>
            <option value="size">Largest first</option>
          </AdminSelect>
        </div>
        <div role="group" aria-label="View" className="flex">
          {(["grid", "list"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
              className={`border px-3 py-2 font-body text-sm font-medium first:border-r-0 ${view === mode ? "border-primary-500 bg-primary-500 text-white" : "border-border-strong bg-surface text-foreground hover:bg-surface-raised"}`}
            >
              {mode === "grid" ? "Grid" : "List"}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-2 font-body text-xs text-foreground-muted" role="status" aria-live="polite">
        {visibleMedia.length} {visibleMedia.length === 1 ? "image" : "images"}
        {pending ? " · updating…" : ""}
      </p>

      {visibleMedia.length === 0 ? (
        <AdminEmptyState title="No images match">Try a different search or clear a filter.</AdminEmptyState>
      ) : view === "grid" ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {visibleMedia.map((item) => {
            const orientation = orientationOf(item.width, item.height);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelected(item)}
                  aria-label={`Open ${displayName(item)}, ${item.bucket}`}
                  className="block w-full border border-border bg-surface text-left hover:border-primary-500"
                >
                  <div className="relative aspect-square overflow-hidden bg-surface-raised">
                    <MediaThumb item={item} previews={previews} onError={refreshPreview} sizes="200px" className="object-cover" />
                    <span className="absolute top-1 left-1">
                      <VisibilityBadge bucket={item.bucket} />
                    </span>
                  </div>
                  <div className="border-t border-border px-2 py-1.5">
                    <p className="truncate font-body text-xs font-medium text-foreground" title={displayName(item)}>
                      {displayName(item)}
                    </p>
                    <p className="font-body text-[11px] text-foreground-muted">
                      {orientation ? `${orientation} · ${item.width}×${item.height}` : "Size not recorded"}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="border border-border bg-surface">
          <div className="hidden grid-cols-[3.5rem_minmax(0,1fr)_6rem_11rem_5rem_minmax(0,10rem)] gap-3 border-b border-border bg-surface-raised px-3 py-2 font-body text-xs font-semibold tracking-wide text-foreground-muted uppercase md:grid">
            <span>
              <span className="sr-only">Preview</span>
            </span>
            <span>File</span>
            <span>Visibility</span>
            <span>Dimensions</span>
            <span>Size</span>
            <span>Editions</span>
          </div>
          <ul>
            {visibleMedia.map((item) => {
              const orientation = orientationOf(item.width, item.height);
              const used = editionUsage[item.id];
              return (
                <li key={item.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    aria-label={`Open ${displayName(item)}, ${item.bucket}`}
                    className="grid w-full grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 px-3 py-2 text-left hover:bg-surface-raised md:grid-cols-[3.5rem_minmax(0,1fr)_6rem_11rem_5rem_minmax(0,10rem)]"
                  >
                    <div className="relative h-12 w-14 overflow-hidden bg-surface-raised">
                      <MediaThumb item={item} previews={previews} onError={refreshPreview} sizes="56px" className="object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-body text-sm font-medium text-foreground">{displayName(item)}</p>
                      <p className="truncate font-body text-xs text-foreground-muted md:hidden">
                        {item.bucket === "public" ? "Public" : "Private"} · {orientation ?? "size not recorded"}
                      </p>
                    </div>
                    <span className="hidden md:block">
                      <VisibilityBadge bucket={item.bucket} />
                    </span>
                    <span className="hidden font-body text-xs text-foreground md:block">{orientation ? `${orientation} · ${item.width}×${item.height}` : "Not recorded"}</span>
                    <span className="hidden font-body text-xs text-foreground-muted md:block">{formatBytes(item.file_size_bytes)}</span>
                    <span className="hidden truncate font-body text-xs text-foreground-muted md:block">
                      {used ? used.map(editionTitle).join(", ") : "Not used"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {selected && (
        <MediaDetailDialog
          key={selected.id}
          item={selected}
          role={role}
          previewUrl={previews[selected.id] ?? null}
          editionLabels={(editionUsage[selected.id] ?? []).map(editionTitle)}
          onPreviewError={() => refreshPreview(selected.id)}
          onClose={() => setSelected(null)}
          onSave={handleMetadataSave}
          onDelete={() => handleDelete(selected)}
          onPromote={() => handlePromote(selected.id)}
          onReplace={(formData) => handleReplace(selected.id, formData)}
          pending={pending}
          error={notice?.tone === "error" ? notice.text : null}
        />
      )}
    </div>
  );
}

function MediaDetailDialog({
  item,
  role,
  previewUrl,
  editionLabels,
  onPreviewError,
  onClose,
  onSave,
  onDelete,
  onPromote,
  onReplace,
  pending,
  error,
}: {
  item: AdminMediaRow;
  role: AdminSession["role"];
  previewUrl: string | null;
  editionLabels: string[];
  onPreviewError: () => void;
  onClose: () => void;
  onSave: (id: string, altText: string, caption: string) => void;
  onDelete: () => void;
  onPromote: () => void;
  onReplace: (formData: FormData) => void;
  pending: boolean;
  error: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [altText, setAltText] = useState(item.alt_text ?? "");
  const [caption, setCaption] = useState(item.caption ?? "");
  const [usage, setUsage] = useState<MediaUsageRow[] | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Pixel size read from the loaded image, used only for display when the database has none recorded. Never saved.
  const [measured, setMeasured] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    getMediaUsageAction(item.id)
      .then((rows) => {
        if (!cancelled) setUsage(rows);
      })
      .catch(() => {
        if (!cancelled) setUsage([]);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  const width = item.width ?? measured?.w ?? null;
  const height = item.height ?? measured?.h ?? null;
  const orientation = orientationOf(width, height);
  const dirty = altText !== (item.alt_text ?? "") || caption !== (item.caption ?? "");
  const isAdmin = role === "admin";

  return (
    <dialog
      ref={ref}
      aria-labelledby="media-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto max-h-[92vh] w-[min(40rem,calc(100vw-1.5rem))] overflow-y-auto border border-border-strong bg-surface p-0 text-foreground backdrop:bg-[#1a0b3b]/60"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border bg-surface-raised px-5 py-3">
        <h2 id="media-dialog-title" className="min-w-0 truncate font-display text-base font-semibold" title={displayName(item)}>
          {displayName(item)}
        </h2>
        <AdminButton type="button" variant="secondary" onClick={onClose}>
          Close
        </AdminButton>
      </div>

      <div className="space-y-4 p-5">
        <div className="relative aspect-video overflow-hidden border border-border bg-surface-raised">
          {item.url ? (
            <Image src={item.url} alt={altText} fill sizes="640px" className="object-contain" onLoad={(e) => setMeasured({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
          ) : previewUrl ? (
            // Private preview via a short-lived signed URL — visible to signed-in staff only, not public.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={altText} onError={onPreviewError} onLoad={(e) => setMeasured({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-body text-sm text-foreground-muted">Private image: preview unavailable</div>
          )}
        </div>

        {error && <AdminNotice tone="error">{error}</AdminNotice>}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 font-body text-xs">
          <div>
            <dt className="font-semibold tracking-wide text-foreground-muted uppercase">Visibility</dt>
            <dd className="mt-0.5">
              <VisibilityBadge bucket={item.bucket} />
            </dd>
          </div>
          <div>
            <dt className="font-semibold tracking-wide text-foreground-muted uppercase">Shape</dt>
            <dd className="text-foreground">
              {orientation ? `${orientation} · ${width}×${height}` : "Not recorded"}
              {!item.width && measured ? " (read from the image)" : ""}
            </dd>
          </div>
          <div>
            <dt className="font-semibold tracking-wide text-foreground-muted uppercase">Type and size</dt>
            <dd className="text-foreground">
              {item.mime_type ?? "unknown"} · {formatBytes(item.file_size_bytes)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold tracking-wide text-foreground-muted uppercase">Uploaded</dt>
            <dd className="text-foreground">{new Date(item.created_at).toLocaleDateString("en-GB")}</dd>
          </div>
          <div className="col-span-2">
            <dt className="font-semibold tracking-wide text-foreground-muted uppercase">Used in editions</dt>
            <dd className="text-foreground">{editionLabels.length > 0 ? editionLabels.join(", ") : "Not used in any story yet"}</dd>
          </div>
        </dl>

        {item.bucket === "private" && (
          <div className="flex flex-wrap items-center justify-between gap-3 border border-border-strong bg-surface-raised px-3 py-2">
            <p className="font-body text-xs text-foreground">Private. Not visible on the public site until an administrator promotes it.</p>
            {isAdmin ? (
              <AdminButton type="button" variant="secondary" disabled={pending} onClick={onPromote}>
                {pending ? "Promoting…" : "Promote to public"}
              </AdminButton>
            ) : (
              <span className="font-body text-xs text-foreground-muted">Ask an administrator to promote it.</span>
            )}
          </div>
        )}

        <div>
          <p className="mb-1 font-body text-xs font-semibold tracking-wide text-foreground-muted uppercase">Where it is used</p>
          {usage === null ? (
            <p className="font-body text-sm text-foreground-muted">Checking…</p>
          ) : usage.length === 0 ? (
            <p className="font-body text-sm text-foreground-muted">Not used anywhere yet.</p>
          ) : (
            <ul className="list-inside list-disc font-body text-sm text-foreground">
              {usage.map((row, index) => (
                <li key={`${row.href}-${index}`}>
                  {row.type}:{" "}
                  <a href={row.href} className="text-primary-600 underline underline-offset-2">
                    {row.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <AdminLabel htmlFor="media-alt">Alt text</AdminLabel>
            <AdminInput id="media-alt" value={altText} onChange={(e) => setAltText(e.target.value)} aria-describedby="media-alt-help" />
            <p id="media-alt-help" className="mt-1 font-body text-xs text-foreground-muted">Describe the picture for readers who cannot see it.</p>
          </div>
          <div>
            <AdminLabel htmlFor="media-caption">Caption</AdminLabel>
            <AdminInput id="media-caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
          </div>
          <form action={(formData) => onReplace(formData)} className="flex flex-wrap items-end gap-2">
            <div>
              <AdminLabel htmlFor="media-replace">Replace the file (keeps every place it is used)</AdminLabel>
              <input id="media-replace" type="file" name="file" accept="image/jpeg,image/png,image/webp" required className="font-body text-xs text-foreground" />
            </div>
            <AdminButton type="submit" variant="secondary" disabled={pending}>
              {pending ? "Replacing…" : "Replace"}
            </AdminButton>
          </form>
        </div>

        {confirmingDelete && (
          <div className="border border-danger bg-danger/5 p-3" role="alert">
            <p className="font-body text-sm text-foreground">
              {usage && usage.length > 0
                ? `This image is used in ${usage.length} ${usage.length === 1 ? "place" : "places"}. Deleting removes it from all of them and cannot be undone.`
                : "Delete this image permanently? This cannot be undone."}
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <AdminButton type="button" variant="secondary" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </AdminButton>
              <AdminButton type="button" variant="danger" disabled={pending} onClick={onDelete}>
                {pending ? "Deleting…" : "Delete permanently"}
              </AdminButton>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-raised px-5 py-3">
        {isAdmin && !confirmingDelete ? (
          <AdminButton type="button" variant="danger" disabled={pending} onClick={() => setConfirmingDelete(true)}>
            Delete
          </AdminButton>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          {dirty && <span className="font-body text-xs font-semibold text-danger">Unsaved changes</span>}
          <AdminButton type="button" disabled={pending || !dirty} onClick={() => onSave(item.id, altText, caption)}>
            {pending ? "Saving…" : "Save details"}
          </AdminButton>
        </div>
      </div>
    </dialog>
  );
}
