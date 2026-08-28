"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import {
  searchMediaAction,
  updateMediaAction,
  deleteMediaAction,
  promoteMediaAction,
  replaceMediaAction,
  getMediaUsageAction,
  type MediaUsageRow,
} from "@/lib/admin/media-actions";
import { uploadMediaDirect, isRetryableMediaUploadError, type MediaUploadStage } from "@/lib/admin/media-upload-client";
import type { AdminMediaRow } from "@/lib/admin/queries";
import { AdminButton, AdminInput, AdminSelect } from "@/components/admin/ui";

const STAGE_LABEL: Record<MediaUploadStage, string> = {
  preparing: "Preparing…",
  uploading: "Uploading…",
  saving: "Saving…",
};

const TYPE_FILTERS = [
  { label: "All types", value: "" },
  { label: "JPEG", value: "image/jpeg" },
  { label: "PNG", value: "image/png" },
  { label: "WebP", value: "image/webp" },
];

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function displayName(item: AdminMediaRow): string {
  return item.original_filename ?? item.storage_path.split("/").pop() ?? item.storage_path;
}

export function MediaLibrary({ initialMedia }: { initialMedia: AdminMediaRow[] }) {
  const [media, setMedia] = useState(initialMedia);
  const [query, setQuery] = useState("");
  const [bucketFilter, setBucketFilter] = useState<"" | "public" | "private">("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selected, setSelected] = useState<AdminMediaRow | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadStage, setUploadStage] = useState<MediaUploadStage | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function refetch(nextQuery: string, nextBucket: "" | "public" | "private") {
    startTransition(async () => {
      setMedia(await searchMediaAction(nextQuery || undefined, nextBucket || undefined));
    });
  }

  function runSearch(next: string) {
    setQuery(next);
    refetch(next, bucketFilter);
  }

  function runBucketFilter(next: "" | "public" | "private") {
    setBucketFilter(next);
    refetch(query, next);
  }

  const visibleMedia = typeFilter ? media.filter((item) => item.mime_type === typeFilter) : media;

  function handleUpload(formData: FormData) {
    setUploadError(null);
    const file = formData.get("file");
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
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  }

  function updateItem(next: AdminMediaRow) {
    setMedia((prev) => prev.map((item) => (item.id === next.id ? next : item)));
    setSelected(next);
  }

  function handleMetadataSave(id: string, alt_text: string, caption: string) {
    startTransition(async () => {
      const result = await updateMediaAction(id, { alt_text: alt_text || null, caption: caption || null });
      if (result.error) return;
      setMedia((prev) => prev.map((item) => (item.id === id ? { ...item, alt_text, caption } : item)));
      setSelected(null);
    });
  }

  function handlePromote(id: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await promoteMediaAction(id);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      if (result.media) updateItem(result.media);
    });
  }

  function handleReplace(id: string, formData: FormData) {
    setActionError(null);
    startTransition(async () => {
      const result = await replaceMediaAction(id, formData);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      if (result.media) updateItem(result.media);
    });
  }

  function handleDelete(item: AdminMediaRow) {
    setActionError(null);
    startTransition(async () => {
      const result = await deleteMediaAction(item.id, item.bucket, item.storage_path);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      setMedia((prev) => prev.filter((existing) => existing.id !== item.id));
      setSelected(null);
    });
  }

  return (
    <div>
      <form action={handleUpload} className="mb-6 flex flex-wrap items-end gap-3 border border-border bg-surface p-4">
        <div>
          <label className="mb-1.5 block font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">
            Upload image (private until promoted)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp"
            required
            className="font-body text-sm text-foreground-muted"
          />
        </div>
        <AdminInput name="alt_text" placeholder="Alt text" className="max-w-[200px]" />
        <AdminInput name="caption" placeholder="Caption (optional)" className="max-w-[200px]" />
        <input type="hidden" name="bucket" value="private" />
        <AdminButton type="submit" disabled={pending}>
          {uploadStage ? STAGE_LABEL[uploadStage] : uploadError && isRetryableMediaUploadError(uploadError) ? "Try again" : "Upload"}
        </AdminButton>
        {uploadError && (
          <p role="alert" className="w-full font-body text-sm text-danger">
            {uploadError}
          </p>
        )}
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <AdminInput
          placeholder="Search by filename, alt text, or caption…"
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          className="max-w-sm"
        />
        <AdminSelect
          value={bucketFilter}
          onChange={(e) => runBucketFilter(e.target.value as "" | "public" | "private")}
          className="w-auto"
        >
          <option value="">All statuses</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </AdminSelect>
        <AdminSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-auto">
          {TYPE_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </AdminSelect>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {visibleMedia.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelected(item)}
            className="border border-border text-left hover:border-secondary-400"
          >
            <div className="relative aspect-square overflow-hidden bg-background">
              {item.url ? (
                <Image src={item.url} alt={item.alt_text ?? ""} fill sizes="180px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-body text-xs text-foreground-muted">
                  private
                </div>
              )}
            </div>
            <div className="border-t border-border px-2 py-1.5">
              <p className="truncate font-body text-xs text-foreground" title={displayName(item)}>
                {displayName(item)}
              </p>
              <p className="mt-0.5 font-body text-[10px] uppercase tracking-wide text-foreground-muted">
                {item.bucket} {item.width && item.height ? `· ${item.width}×${item.height}` : ""}
              </p>
            </div>
          </button>
        ))}
        {visibleMedia.length === 0 && <p className="col-span-full font-body text-sm text-foreground-muted">No media found.</p>}
      </div>

      {selected && (
        <MediaDetailPanel
          item={selected}
          onClose={() => {
            setSelected(null);
            setActionError(null);
          }}
          onSave={handleMetadataSave}
          onDelete={() => handleDelete(selected)}
          onPromote={() => handlePromote(selected.id)}
          onReplace={(formData) => handleReplace(selected.id, formData)}
          pending={pending}
          error={actionError}
        />
      )}
    </div>
  );
}

function MediaDetailPanel({
  item,
  onClose,
  onSave,
  onDelete,
  onPromote,
  onReplace,
  pending,
  error,
}: {
  item: AdminMediaRow;
  onClose: () => void;
  onSave: (id: string, altText: string, caption: string) => void;
  onDelete: () => void;
  onPromote: () => void;
  onReplace: (formData: FormData) => void;
  pending: boolean;
  error: string | null;
}) {
  const [altText, setAltText] = useState(item.alt_text ?? "");
  const [caption, setCaption] = useState(item.caption ?? "");
  const [usage, setUsage] = useState<MediaUsageRow[] | null>(null);
  const [checkingUsage, setCheckingUsage] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function requestDelete() {
    setConfirmingDelete(true);
    setCheckingUsage(true);
    getMediaUsageAction(item.id)
      .then(setUsage)
      .finally(() => setCheckingUsage(false));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-border bg-surface p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative mb-4 aspect-video overflow-hidden border border-border bg-background">
          {item.url ? (
            <Image src={item.url} alt={altText} fill sizes="512px" className="object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-body text-sm text-foreground-muted">
              Private bucket — not publicly viewable
            </div>
          )}
        </div>

        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 font-body text-xs text-foreground-muted">
          <div>
            <dt className="uppercase tracking-wide">Filename</dt>
            <dd className="truncate text-foreground">{displayName(item)}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide">Status</dt>
            <dd className="text-foreground">{item.bucket === "public" ? "Public" : "Private"}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide">Type</dt>
            <dd className="text-foreground">{item.mime_type ?? "unknown"}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide">Size</dt>
            <dd className="text-foreground">
              {item.width && item.height ? `${item.width}×${item.height} · ` : ""}
              {formatBytes(item.file_size_bytes)}
            </dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide">Uploaded</dt>
            <dd className="text-foreground">{new Date(item.created_at).toLocaleDateString("en-GB")}</dd>
          </div>
        </dl>

        {error && <p className="mb-4 font-body text-sm text-danger">{error}</p>}

        {item.bucket === "private" && (
          <div className="mb-4 flex items-center justify-between border border-border bg-background px-3 py-2">
            <p className="font-body text-xs text-foreground-muted">Not visible on the public site yet.</p>
            <AdminButton type="button" variant="secondary" disabled={pending} onClick={onPromote}>
              {pending ? "Promoting…" : "Promote to Public"}
            </AdminButton>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">
              Alt text
            </label>
            <AdminInput value={altText} onChange={(e) => setAltText(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">
              Caption
            </label>
            <AdminInput value={caption} onChange={(e) => setCaption(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">
              Replace file
            </label>
            <form
              action={(formData) => onReplace(formData)}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                type="file"
                name="file"
                accept="image/jpeg,image/png,image/webp"
                required
                className="font-body text-xs text-foreground-muted"
              />
              <AdminButton type="submit" variant="secondary" disabled={pending}>
                {pending ? "Replacing…" : "Replace"}
              </AdminButton>
            </form>
          </div>
        </div>

        {confirmingDelete && (
          <div className="mt-4 border border-danger bg-danger/5 p-3">
            {checkingUsage ? (
              <p className="font-body text-sm text-foreground-muted">Checking where this is used…</p>
            ) : usage && usage.length > 0 ? (
              <div>
                <p className="mb-2 font-body text-sm text-foreground">
                  This image is currently used by {usage.length} {usage.length === 1 ? "item" : "items"}:
                </p>
                <ul className="mb-3 list-inside list-disc font-body text-xs text-foreground-muted">
                  {usage.map((row, index) => (
                    <li key={`${row.href}-${index}`}>
                      {row.type}: {row.title}
                    </li>
                  ))}
                </ul>
                <p className="mb-3 font-body text-xs text-foreground-muted">
                  Deleting will remove this image from those references.
                </p>
              </div>
            ) : (
              <p className="mb-3 font-body text-sm text-foreground-muted">This image isn&apos;t currently used anywhere.</p>
            )}
            <div className="flex justify-end gap-2">
              <AdminButton type="button" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </AdminButton>
              <AdminButton type="button" variant="danger" disabled={pending || checkingUsage} onClick={onDelete}>
                Delete anyway
              </AdminButton>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          {!confirmingDelete && (
            <AdminButton type="button" variant="danger" disabled={pending} onClick={requestDelete}>
              Delete
            </AdminButton>
          )}
          <div className="ml-auto flex gap-2">
            <AdminButton type="button" variant="ghost" onClick={onClose}>
              Close
            </AdminButton>
            <AdminButton type="button" disabled={pending} onClick={() => onSave(item.id, altText, caption)}>
              Save
            </AdminButton>
          </div>
        </div>
      </div>
    </div>
  );
}
