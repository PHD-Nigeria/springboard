"use client";

import { useEffect, useState, useTransition } from "react";
import { AdminButton, AdminInput, AdminLabel, AdminNotice, AdminTextarea } from "@/components/admin/ui";
import { getGalleryMetaAction, updateGalleryMetaAction, type GalleryMeta } from "@/lib/admin/gallery-meta-actions";

/** Public Gallery details for one image. Only meaningful for public images; private ones stay out of the Gallery until promoted. */
export function GalleryMetaFields({ mediaId, isPublic, canCurate }: { mediaId: string; isPublic: boolean; canCurate: boolean }) {
  const [meta, setMeta] = useState<GalleryMeta | null>(null);
  const [available, setAvailable] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getGalleryMetaAction(mediaId).then((r) => {
      if (cancelled) return;
      if (r.error) setLoadError(r.error);
      else if (r.available === false) setAvailable(false);
      else if (r.meta) setMeta(r.meta);
    });
    return () => {
      cancelled = true;
    };
  }, [mediaId]);

  if (!available) return <p className="font-body text-xs text-foreground-muted">Gallery details are not set up in this environment yet.</p>;
  if (loadError) return <AdminNotice tone="error">{loadError}</AdminNotice>;
  if (!meta) return <p className="font-body text-xs text-foreground-muted">Loading Gallery details…</p>;

  const set = (patch: Partial<GalleryMeta>) => setMeta({ ...meta, ...patch });

  return (
    <fieldset className="space-y-3 border border-border p-3" disabled={!canCurate || pending}>
      <legend className="px-1 font-body text-sm font-semibold text-foreground">Public Gallery</legend>
      {!isPublic && <p className="font-body text-xs text-foreground-muted">This image is private, so it is not in the Gallery. It joins automatically when an administrator promotes it.</p>}
      <label className="flex items-center gap-2 font-body text-sm text-foreground">
        <input type="checkbox" checked={meta.visible} onChange={(e) => set({ visible: e.target.checked })} />
        Show in the Gallery{isPublic ? "" : " (once public)"}
      </label>
      <div>
        <AdminLabel htmlFor={`g-desc-${mediaId}`}>Description</AdminLabel>
        <AdminTextarea id={`g-desc-${mediaId}`} rows={3} maxLength={1000} value={meta.description} onChange={(e) => set({ description: e.target.value })} />
      </div>
      <div>
        <AdminLabel htmlFor={`g-group-${mediaId}`}>Event or category</AdminLabel>
        <AdminInput id={`g-group-${mediaId}`} maxLength={120} value={meta.group} placeholder="Leave empty to group by month" onChange={(e) => set({ group: e.target.value })} />
      </div>
      <div>
        <AdminLabel htmlFor={`g-date-${mediaId}`}>Date taken</AdminLabel>
        <AdminInput id={`g-date-${mediaId}`} type="date" value={meta.takenOn} onChange={(e) => set({ takenOn: e.target.value })} />
      </div>
      {message && <AdminNotice tone={message.tone}>{message.text}</AdminNotice>}
      {canCurate ? (
        <AdminButton
          type="button"
          onClick={() =>
            startTransition(async () => {
              const r = await updateGalleryMetaAction(mediaId, meta);
              setMessage(r.error ? { tone: "error", text: r.error } : { tone: "success", text: "Gallery details saved." });
            })
          }
        >
          Save Gallery details
        </AdminButton>
      ) : (
        <p className="font-body text-xs text-foreground-muted">Only editors and administrators can change Gallery details.</p>
      )}
    </fieldset>
  );
}
