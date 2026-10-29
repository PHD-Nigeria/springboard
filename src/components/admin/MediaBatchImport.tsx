"use client";

import { useEffect, useRef, useState } from "react";
import { uploadMediaDirect, isRetryableMediaUploadError, type MediaUploadStage } from "@/lib/admin/media-upload-client";
import {
  findMediaDuplicatesAction,
  promoteMediaAction,
  updateMediaAction,
  type MediaDuplicateMatch,
} from "@/lib/admin/media-actions";
import type { AdminMediaRow } from "@/lib/admin/queries";
import {
  BATCH_MAX_FILES,
  buildCsv,
  duplicateKey,
  formatBytes,
  validateBatchFile,
  type BatchValidation,
} from "@/lib/admin/media-batch";
import { AdminButton, AdminInput } from "@/components/admin/ui";

/**
 * TEMPORARY one-time batch importer (admin-only page; delete with it when the
 * initial import is done). It is a thin orchestrator over the existing,
 * authorised workflow: every file goes through uploadMediaDirect() — the same
 * signed-URL upload, RLS checks, MIME/size validation, audit logging and
 * rollback as the Media Library's own uploader — into the PRIVATE bucket.
 * Nothing here talks to Storage or the database any other way, holds any
 * service-role credential, or overwrites anything: every upload mints a new
 * path and a new row. There is deliberately no "promote all": promotion is a
 * separate, per-image, two-step action.
 */

type ItemStatus = "ready" | "uploading" | "done" | "failed";

interface BatchItem {
  key: string;
  file: File;
  path: string;
  validation: BatchValidation;
  previewUrl: string | null;
  altText: string;
  include: boolean;
  batchDuplicateOf: string | null;
  libraryMatches: MediaDuplicateMatch[];
  status: ItemStatus;
  stage: MediaUploadStage | null;
  error: string | null;
  attempts: number;
  media: AdminMediaRow | null;
  note: string | null;
  altSave: "idle" | "saving" | "saved" | "error";
  promote: "idle" | "confirm" | "promoting" | "promoted" | "error";
  promoteError: string | null;
}

const STAGE_LABEL: Record<MediaUploadStage, string> = {
  preparing: "Preparing…",
  uploading: "Uploading…",
  saving: "Saving…",
};

function relativePath(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

function statusLabel(item: BatchItem): string {
  if (!item.validation.ok) return "Can't upload";
  if (item.promote === "promoted") return "Saved · now public";
  if (item.status === "done") return "Saved · private";
  if (item.status === "uploading") return item.stage ? STAGE_LABEL[item.stage] : "Uploading…";
  if (item.status === "failed") return "Failed";
  return item.include ? "Ready" : "Skipped";
}

export function MediaBatchImport() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [libraryCheck, setLibraryCheck] = useState<"idle" | "checking" | "done" | "failed">("idle");
  const [libraryCheckError, setLibraryCheckError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ index: number; total: number; name: string } | null>(null);

  const itemsRef = useRef<BatchItem[]>([]);
  const stopRef = useRef(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Release the local object URLs used for previews when the page is left.
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  function patch(key: string, changes: Partial<BatchItem>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...changes } : item)));
  }

  async function handleFolder(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = ""; // lets the same folder be chosen again later; the File objects stay valid
    if (picked.length === 0) return;

    setSelectionError(null);
    if (picked.length > BATCH_MAX_FILES) {
      setSelectionError(`That folder has ${picked.length} files — this importer handles up to ${BATCH_MAX_FILES} at a time.`);
      return;
    }

    itemsRef.current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));

    const sorted = [...picked].sort((a, b) => relativePath(a).localeCompare(relativePath(b), undefined, { numeric: true }));
    const firstSeen = new Map<string, string>();
    const built: BatchItem[] = sorted.map((file, index) => {
      const validation = validateBatchFile(file);
      const path = relativePath(file);
      let batchDuplicateOf: string | null = null;
      if (validation.ok) {
        const key = duplicateKey(file.name, file.size);
        const earlier = firstSeen.get(key);
        if (earlier) batchDuplicateOf = earlier;
        else firstSeen.set(key, path);
      }
      return {
        key: `${index}:${path}`,
        file,
        path,
        validation,
        previewUrl: validation.ok ? URL.createObjectURL(file) : null,
        altText: "",
        include: validation.ok && !batchDuplicateOf,
        batchDuplicateOf,
        libraryMatches: [],
        status: "ready",
        stage: null,
        error: null,
        attempts: 0,
        media: null,
        note: null,
        altSave: "idle",
        promote: "idle",
        promoteError: null,
      };
    });

    setFolderName(sorted[0] ? (relativePath(sorted[0]).split("/")[0] ?? null) : null);
    setItems(built);
    itemsRef.current = built;

    // Compare against what is already in the Media Library (read-only, RLS-scoped).
    const checkable = built.filter((item) => item.validation.ok);
    if (checkable.length === 0) {
      setLibraryCheck("done");
      return;
    }
    setLibraryCheck("checking");
    setLibraryCheckError(null);
    const result = await findMediaDuplicatesAction(checkable.map((item) => ({ name: item.file.name, size: item.file.size })));
    if (result.error) {
      setLibraryCheck("failed");
      setLibraryCheckError(result.error);
      return;
    }
    const matchesByKey = new Map(checkable.map((item, index) => [item.key, result.matches[index] ?? []]));
    setItems((prev) =>
      prev.map((item) => {
        const matches = matchesByKey.get(item.key);
        if (!matches || matches.length === 0) return item;
        return { ...item, libraryMatches: matches, include: item.include && !matches.some((match) => match.sameSize) };
      })
    );
    setLibraryCheck("done");
  }

  /**
   * Before RE-trying a file, find out whether an earlier attempt actually got
   * saved (the response can be lost after the row was written). An exact
   * filename+size match that was NOT in the Library when this folder was
   * checked, and isn't another item's row, can only have come from this import.
   */
  async function findEarlierSuccess(item: BatchItem): Promise<MediaDuplicateMatch | null | "error"> {
    const result = await findMediaDuplicatesAction([{ name: item.file.name, size: item.file.size }]);
    if (result.error) return "error";
    const knownBefore = new Set(item.libraryMatches.map((match) => match.id));
    const claimedElsewhere = new Set(
      itemsRef.current.filter((other) => other.key !== item.key && other.media).map((other) => other.media!.id)
    );
    return (result.matches[0] ?? []).find((match) => match.sameSize && !knownBefore.has(match.id) && !claimedElsewhere.has(match.id)) ?? null;
  }

  async function processKeys(keys: string[]) {
    stopRef.current = false;
    setRunning(true);
    const total = keys.length;

    for (let position = 0; position < keys.length; position++) {
      if (stopRef.current) break;
      const item = itemsRef.current.find((candidate) => candidate.key === keys[position]);
      if (!item || item.status === "done") continue;

      setProgress({ index: position + 1, total, name: item.file.name });
      patch(item.key, { status: "uploading", stage: "preparing", error: null, note: null, attempts: item.attempts + 1 });

      if (item.attempts > 0) {
        const earlier = await findEarlierSuccess(item);
        if (earlier === "error") {
          patch(item.key, {
            status: "failed",
            stage: null,
            error: "Couldn't confirm whether an earlier attempt already saved this file. Check the Media Library, then try again.",
          });
          continue;
        }
        if (earlier) {
          patch(item.key, {
            status: "done",
            stage: null,
            note: "Already saved by an earlier attempt — not uploaded again.",
            media: {
              id: earlier.id,
              bucket: earlier.bucket,
              storage_path: "",
              original_filename: earlier.original_filename,
              alt_text: null,
              caption: null,
              mime_type: item.file.type,
              width: null,
              height: null,
              file_size_bytes: earlier.file_size_bytes,
              created_at: earlier.created_at,
              url: null,
            },
          });
          continue;
        }
      }

      const result = await uploadMediaDirect(item.file, {
        altText: itemsRef.current.find((candidate) => candidate.key === item.key)?.altText ?? item.altText,
        bucket: "private",
        onStageChange: (stage) => patch(item.key, { stage }),
      });

      if (result.error || !result.media) {
        patch(item.key, { status: "failed", stage: null, error: result.error ?? "Something went wrong while uploading this file." });
      } else {
        patch(item.key, { status: "done", stage: null, media: result.media, error: null });
      }
    }

    setProgress(null);
    setRunning(false);
  }

  const importable = (item: BatchItem) => item.validation.ok && item.include;
  const readyKeys = items.filter((item) => importable(item) && item.status === "ready").map((item) => item.key);
  const failedKeys = items.filter((item) => importable(item) && item.status === "failed").map((item) => item.key);
  const doneCount = items.filter((item) => item.status === "done").length;
  const failedCount = items.filter((item) => item.status === "failed").length;
  const invalidCount = items.filter((item) => !item.validation.ok).length;
  const canStart = !running && libraryCheck === "done";

  async function saveAltText(item: BatchItem) {
    if (!item.media) return;
    patch(item.key, { altSave: "saving" });
    const result = await updateMediaAction(item.media.id, { alt_text: item.altText.trim() || null });
    patch(item.key, { altSave: result.error ? "error" : "saved" });
  }

  async function promote(item: BatchItem) {
    if (!item.media) return;
    patch(item.key, { promote: "promoting", promoteError: null });
    const result = await promoteMediaAction(item.media.id);
    if (result.error) {
      patch(item.key, { promote: "error", promoteError: result.error });
    } else {
      patch(item.key, { promote: "promoted", media: result.media ?? item.media });
    }
  }

  function describeDuplicates(item: BatchItem): string[] {
    const notes: string[] = [];
    if (item.batchDuplicateOf) notes.push(`Same name and size as ${item.batchDuplicateOf} in this folder.`);
    for (const match of item.libraryMatches) {
      const when = new Date(match.created_at).toLocaleDateString("en-GB");
      notes.push(
        match.sameSize
          ? `Looks like a duplicate of “${match.original_filename}” already in the Media Library (${match.bucket}, added ${when}).`
          : `A different file named “${match.original_filename}” (${match.file_size_bytes ? formatBytes(match.file_size_bytes) : "unknown size"}) is already in the Library.`
      );
    }
    return notes;
  }

  function downloadReport() {
    const header = [
      "relative_path",
      "filename",
      "mime_type",
      "size_bytes",
      "validation",
      "duplicate_notes",
      "included",
      "status",
      "media_id",
      "bucket",
      "alt_text",
      "error",
      "note",
    ];
    const rows = items.map((item) => [
      item.path,
      item.file.name,
      item.file.type,
      item.file.size,
      item.validation.ok ? "ok" : item.validation.reason,
      describeDuplicates(item).join(" | "),
      item.include ? "yes" : "no",
      !item.validation.ok ? "not uploadable" : item.status === "done" ? (item.promote === "promoted" ? "saved (public)" : "saved (private)") : item.status === "ready" && !item.include ? "skipped" : item.status,
      item.media?.id ?? "",
      item.media?.bucket ?? "",
      item.altText,
      item.error ?? "",
      item.note ?? "",
    ]);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
    const blob = new Blob([buildCsv(header, rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `springboard-image-import-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-6 border border-border bg-surface p-4">
        <label htmlFor="batch-folder" className="mb-1.5 block font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">
          Choose a folder of images
        </label>
        <input
          id="batch-folder"
          type="file"
          // Folder picker: not in React's typings, but supported by Chrome, Edge, Firefox and Safari.
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          multiple
          onChange={handleFolder}
          disabled={running}
          className="font-body text-sm text-foreground-muted"
        />
        <p className="mt-2 font-body text-xs text-foreground-muted">
          JPEG, PNG and WebP up to 25 MiB each. Files are only read from your computer — originals are never changed. Everything uploads as
          private; nothing is promoted automatically.
        </p>
        {selectionError && (
          <p role="alert" className="mt-2 font-body text-sm text-danger">
            {selectionError}
          </p>
        )}
      </div>

      {items.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 border border-border bg-surface p-4">
            <p className="font-body text-sm text-foreground">
              <strong>{folderName ?? "Folder"}</strong>: {items.length} files · {items.length - invalidCount} valid · {readyKeys.length} selected
              to upload · {doneCount} saved · {failedCount} failed
            </p>
            <div className="ml-auto flex flex-wrap gap-2">
              <AdminButton type="button" disabled={!canStart || readyKeys.length === 0} onClick={() => processKeys(readyKeys)}>
                Upload {readyKeys.length} selected
              </AdminButton>
              <AdminButton type="button" variant="secondary" disabled={!canStart || failedKeys.length === 0} onClick={() => processKeys(failedKeys)}>
                Retry failed ({failedKeys.length})
              </AdminButton>
              {running && (
                <AdminButton type="button" variant="danger" onClick={() => (stopRef.current = true)}>
                  Stop after this file
                </AdminButton>
              )}
              <AdminButton type="button" variant="secondary" onClick={downloadReport}>
                Download CSV report
              </AdminButton>
            </div>
            <div aria-live="polite" className="w-full font-body text-sm text-foreground-muted">
              {libraryCheck === "checking" && "Checking the Media Library for existing copies…"}
              {libraryCheck === "failed" && (
                <span className="text-danger">
                  {libraryCheckError} Uploading is disabled until duplicates can be checked — choose the folder again to retry.
                </span>
              )}
              {progress && `Uploading ${progress.index} of ${progress.total}: ${progress.name}`}
            </div>
          </div>

          <div className="overflow-x-auto border border-border">
            <table className="w-full min-w-[56rem] border-collapse text-left font-body text-sm">
              <thead className="bg-surface text-xs tracking-wide text-foreground-muted uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">Include</th>
                  <th className="px-3 py-2 font-medium">Preview</th>
                  <th className="px-3 py-2 font-medium">File</th>
                  <th className="px-3 py-2 font-medium">Checks</th>
                  <th className="px-3 py-2 font-medium">Alt text (editorial)</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const notes = describeDuplicates(item);
                  const locked = running || item.status === "done" || item.status === "uploading";
                  return (
                    <tr key={item.key} className="border-t border-border align-top">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Include ${item.file.name}`}
                          checked={item.include && item.validation.ok}
                          disabled={!item.validation.ok || locked}
                          onChange={(event) => patch(item.key, { include: event.target.checked })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        {item.previewUrl ? (
                          // Local object URL of the user's own file — nothing is uploaded for the preview.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.previewUrl} alt="" loading="lazy" decoding="async" className="h-16 w-16 object-cover" />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center border border-border text-[10px] text-foreground-muted">
                            none
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <p className="max-w-[16rem] break-all text-foreground">{item.path}</p>
                        <p className="text-xs text-foreground-muted">
                          {item.file.type || "unknown type"} · {formatBytes(item.file.size)}
                        </p>
                      </td>
                      <td className="max-w-[20rem] px-3 py-2 text-xs">
                        {!item.validation.ok ? (
                          <p className="text-danger">{item.validation.reason}</p>
                        ) : notes.length === 0 ? (
                          <p className="text-foreground-muted">Valid · no duplicates found</p>
                        ) : (
                          notes.map((note) => (
                            <p key={note} className="text-danger">
                              ⚠ {note}
                            </p>
                          ))
                        )}
                        {item.validation.ok && !item.include && item.status === "ready" && notes.length > 0 && (
                          <p className="mt-1 text-foreground-muted">Skipped by default — tick Include to upload it anyway.</p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {item.validation.ok && (
                          <div className="flex items-center gap-2">
                            <AdminInput
                              aria-label={`Alt text for ${item.file.name}`}
                              placeholder="Describe the image (leave blank if unsure)"
                              value={item.altText}
                              onChange={(event) => patch(item.key, { altText: event.target.value, altSave: "idle" })}
                              disabled={item.status === "uploading"}
                              className="min-w-[14rem]"
                            />
                            {item.status === "done" && item.media && (
                              <AdminButton
                                type="button"
                                variant="secondary"
                                disabled={item.altSave === "saving"}
                                onClick={() => saveAltText(item)}
                              >
                                {item.altSave === "saving" ? "Saving…" : item.altSave === "saved" ? "Saved" : "Save alt"}
                              </AdminButton>
                            )}
                          </div>
                        )}
                        {item.altSave === "error" && <p className="mt-1 text-xs text-danger">Couldn&apos;t save alt text.</p>}
                      </td>
                      <td className="px-3 py-2">
                        <p
                          className={
                            item.status === "failed" || !item.validation.ok
                              ? "text-danger"
                              : item.status === "done"
                                ? "text-primary-600"
                                : "text-foreground"
                          }
                        >
                          {statusLabel(item)}
                        </p>
                        {item.note && <p className="mt-1 text-xs text-foreground-muted">{item.note}</p>}
                        {item.error && (
                          <p role="alert" className="mt-1 text-xs text-danger">
                            {item.error}
                            {isRetryableMediaUploadError(item.error) ? " Use “Retry failed” to try again." : ""}
                          </p>
                        )}
                        {item.status === "done" && item.media && item.promote !== "promoted" && item.media.bucket === "private" && (
                          <div className="mt-2">
                            {item.promote === "confirm" || item.promote === "promoting" ? (
                              <div className="space-y-1">
                                <p className="text-xs text-foreground">Make this image public on the website?</p>
                                <div className="flex gap-2">
                                  <AdminButton type="button" disabled={item.promote === "promoting"} onClick={() => promote(item)}>
                                    {item.promote === "promoting" ? "Promoting…" : "Yes, promote"}
                                  </AdminButton>
                                  <AdminButton
                                    type="button"
                                    variant="ghost"
                                    disabled={item.promote === "promoting"}
                                    onClick={() => patch(item.key, { promote: "idle" })}
                                  >
                                    Cancel
                                  </AdminButton>
                                </div>
                              </div>
                            ) : (
                              <AdminButton type="button" variant="secondary" onClick={() => patch(item.key, { promote: "confirm" })}>
                                Promote to public…
                              </AdminButton>
                            )}
                            {item.promoteError && <p className="mt-1 text-xs text-danger">{item.promoteError}</p>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
