"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePublicationAction } from "@/lib/admin/taxonomy-actions";
import { AdminButton, AdminInput, AdminLabel, AdminNotice, AdminSelect } from "@/components/admin/ui";
import { MediaPicker } from "@/components/admin/MediaPicker";

export interface EditionFormValues {
  id?: string;
  title: string;
  slug: string;
  subtitle: string | null;
  status: string;
  cover: { id: string; url: string | null; alt_text: string | null } | null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Create or edit an edition. Saves through the existing savePublicationAction (RLS-checked); success is
 * reported only after that action returned without an error.
 */
export function EditionForm({
  initial,
  onDone,
  submitLabel = "Save edition",
  compact = false,
}: {
  initial?: EditionFormValues;
  onDone?: () => void;
  submitLabel?: string;
  /** Single column and no outer border, for use inside a side panel. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [cover, setCover] = useState(initial?.cover ?? null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await savePublicationAction(formData);
      if (result.error) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      setMessage({ tone: "success", text: "Edition saved." });
      router.refresh();
      onDone?.();
    });
  }

  return (
    <form action={submit} className={`grid grid-cols-1 gap-4 bg-surface p-4 ${compact ? "" : "border border-border md:grid-cols-2"}`}>
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="cover_media_id" value={cover?.id ?? ""} />
      <div>
        <AdminLabel htmlFor="edition-title">Title</AdminLabel>
        <AdminInput
          id="edition-title"
          name="title"
          value={title}
          required
          placeholder="e.g. July – September 2026"
          onChange={(event) => {
            setTitle(event.target.value);
            if (!slugTouched) setSlug(slugify(event.target.value));
          }}
        />
      </div>
      <div>
        <AdminLabel htmlFor="edition-slug">Web address</AdminLabel>
        <AdminInput
          id="edition-slug"
          name="slug"
          value={slug}
          required
          pattern="[a-z0-9\-]+"
          title="Lowercase letters, numbers and hyphens only"
          aria-describedby="edition-slug-help"
          onChange={(event) => {
            setSlug(event.target.value);
            setSlugTouched(true);
          }}
        />
        <p id="edition-slug-help" className="mt-1 font-body text-xs text-foreground-muted">
          Appears in every story link of this edition (/issues/{slug || "…"}/story). Changing it changes those links.
        </p>
      </div>
      <div>
        <AdminLabel htmlFor="edition-subtitle">Subtitle</AdminLabel>
        <AdminInput id="edition-subtitle" name="subtitle" defaultValue={initial?.subtitle ?? ""} />
      </div>
      <div>
        <AdminLabel htmlFor="edition-status">Status</AdminLabel>
        <AdminSelect id="edition-status" name="status" defaultValue={initial?.status ?? "draft"}>
          <option value="draft">Draft (not public)</option>
          <option value="published">Published (public)</option>
          <option value="archived">Archived</option>
        </AdminSelect>
      </div>
      <div className={compact ? "" : "md:col-span-2"}>
        <AdminLabel>Cover image</AdminLabel>
        <MediaPicker selected={cover} onSelect={(media) => setCover({ id: media.id, url: media.url, alt_text: media.alt_text })} onClear={() => setCover(null)} />
      </div>
      {message && (
        <AdminNotice tone={message.tone} className={compact ? "" : "md:col-span-2"}>
          {message.text}
        </AdminNotice>
      )}
      <div className={`flex gap-2 ${compact ? "" : "md:col-span-2"}`}>
        <AdminButton type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </AdminButton>
        {onDone && (
          <AdminButton type="button" variant="secondary" onClick={onDone}>
            Cancel
          </AdminButton>
        )}
      </div>
    </form>
  );
}
