"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { searchMediaAction, uploadMediaAction, promoteMediaAction } from "@/lib/admin/media-actions";
import type { AdminMediaRow } from "@/lib/admin/queries";
import { AdminButton, AdminInput } from "@/components/admin/ui";

interface MediaPickerProps {
  /** Currently selected media, if any — shown as a preview even before the panel opens. */
  selected: { id: string; url: string | null; alt_text: string | null } | null;
  onSelect: (media: AdminMediaRow) => void;
  onClear?: () => void;
}

/**
 * One reusable picker for every "choose an image" spot in the admin (cover
 * image, image blocks, gallery blocks, contributor portraits) — search the
 * existing media table or upload a new file, both against the same
 * media/Storage architecture the public site reads from. Never lists or
 * selects private-bucket media as if it were public: AdminMediaRow.url is
 * already null for those (see lib/admin/queries.ts), and this component
 * just reflects that rather than re-deriving bucket logic itself.
 */
export function MediaPicker({ selected, onSelect, onClear }: MediaPickerProps) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<AdminMediaRow[]>([]);
  const [query, setQuery] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const altTextRef = useRef<HTMLInputElement>(null);

  function promoteSelected() {
    if (!selected) return;
    setPromoteError(null);
    startTransition(async () => {
      const result = await promoteMediaAction(selected.id);
      if (result.error) {
        setPromoteError(result.error);
        return;
      }
      if (result.media) onSelect(result.media);
    });
  }

  function openPanel() {
    setOpen(true);
    startTransition(async () => {
      const rows = await searchMediaAction();
      setResults(rows);
    });
  }

  function runSearch(next: string) {
    setQuery(next);
    startTransition(async () => {
      const rows = await searchMediaAction(next || undefined);
      setResults(rows);
    });
  }

  // Deliberately not a <form> — MediaPicker is always embedded inside
  // another form (ContentForm's cover field, BlockEditor's image/gallery
  // blocks, AuthorForm's portrait, PublicationManager's cover), and nested
  // <form> elements are invalid HTML: the browser silently collapses the
  // inner one, so a submit button here would actually submit the OUTER
  // form instead of running this upload (confirmed empirically — the
  // portrait/cover upload path was silently submitting AuthorForm itself).
  // A plain button + manually-built FormData avoids the nesting entirely.
  function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadError("Choose a file to upload.");
      return;
    }
    setUploadError(null);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("alt_text", altTextRef.current?.value ?? "");
    formData.set("bucket", "private");
    startTransition(async () => {
      const result = await uploadMediaAction(formData);
      if (result.error) {
        setUploadError(result.error);
        return;
      }
      if (result.media) {
        onSelect(result.media);
        setOpen(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (altTextRef.current) altTextRef.current.value = "";
      }
    });
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden border border-border bg-background">
          {selected?.url ? (
            <Image src={selected.url} alt={selected.alt_text ?? ""} fill sizes="80px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-body text-[10px] text-foreground-muted">
              {selected ? "private" : "none"}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <AdminButton type="button" variant="secondary" onClick={openPanel}>
            {selected ? "Change image" : "Choose image"}
          </AdminButton>
          {selected && onClear && (
            <AdminButton type="button" variant="ghost" onClick={onClear}>
              Remove
            </AdminButton>
          )}
        </div>
      </div>

      {selected && !selected.url && (
        <div className="mt-2 flex items-center gap-3 border border-border bg-background px-3 py-2">
          <p className="font-body text-xs text-foreground-muted">
            This image is private and won&apos;t appear on the public site until it&apos;s promoted.
          </p>
          <AdminButton type="button" variant="secondary" disabled={pending} onClick={promoteSelected}>
            {pending ? "Promoting…" : "Promote to Public"}
          </AdminButton>
        </div>
      )}
      {promoteError && <p className="mt-2 font-body text-sm text-danger">{promoteError}</p>}

      {open && (
        <div className="mt-4 border border-border bg-background p-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <AdminInput
              placeholder="Search media…"
              value={query}
              onChange={(event) => runSearch(event.target.value)}
              className="max-w-xs"
            />
            <AdminButton type="button" variant="ghost" onClick={() => setOpen(false)}>
              Close
            </AdminButton>
          </div>

          <div className="mb-4 grid grid-cols-4 gap-2 md:grid-cols-6">
            {results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect(item);
                  setOpen(false);
                }}
                className="relative aspect-square overflow-hidden border border-border hover:border-secondary-400"
              >
                {item.url ? (
                  <Image src={item.url} alt={item.alt_text ?? ""} fill sizes="120px" className="object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-surface font-body text-[10px] text-foreground-muted">
                    private
                  </div>
                )}
              </button>
            ))}
            {results.length === 0 && !pending && (
              <p className="col-span-full font-body text-sm text-foreground-muted">No media found.</p>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-2 font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">
              Upload new (private until promoted)
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="font-body text-sm text-foreground-muted"
              />
              <AdminInput ref={altTextRef} placeholder="Alt text" className="max-w-[220px]" />
              <AdminButton type="button" disabled={pending} onClick={handleUpload}>
                {pending ? "Uploading…" : "Upload"}
              </AdminButton>
            </div>
            {uploadError && <p className="mt-2 font-body text-sm text-danger">{uploadError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
