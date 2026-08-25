"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePublicationAction, deletePublicationAction, getPublicationUsageAction } from "@/lib/admin/taxonomy-actions";
import { AdminButton, AdminInput, AdminLabel, AdminSelect, StatusBadge } from "@/components/admin/ui";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { SafeDeleteButton } from "@/components/admin/SafeDeleteButton";

interface Publication {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  status: string;
  cover_media_id: string | null;
  coverUrl: string | null;
  coverAltText: string | null;
  sectionCount: number;
  contentCount: number;
}

export function PublicationManager({ initialPublications }: { initialPublications: Publication[] }) {
  const [editing, setEditing] = useState<Publication | "new" | null>(null);
  const [cover, setCover] = useState<{ id: string; url: string | null; alt_text: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function beginEdit(publication: Publication | "new") {
    setEditing(publication);
    setCover(
      publication !== "new" && publication.cover_media_id
        ? { id: publication.cover_media_id, url: publication.coverUrl, alt_text: publication.coverAltText }
        : null
    );
  }

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await savePublicationAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deletePublicationAction(id);
      if (result.error) window.alert(result.error);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <AdminButton type="button" onClick={() => beginEdit("new")}>
          New publication
        </AdminButton>
      </div>

      {editing && (
        <form action={submit} className="mb-6 grid grid-cols-1 gap-4 border border-border bg-surface p-4 md:grid-cols-4">
          {editing !== "new" && <input type="hidden" name="id" value={editing.id} />}
          <input type="hidden" name="cover_media_id" value={cover?.id ?? ""} />
          <div>
            <AdminLabel htmlFor="title">Title</AdminLabel>
            <AdminInput id="title" name="title" defaultValue={editing !== "new" ? editing.title : ""} required />
          </div>
          <div>
            <AdminLabel htmlFor="slug">Slug</AdminLabel>
            <AdminInput id="slug" name="slug" defaultValue={editing !== "new" ? editing.slug : ""} required pattern="[a-z0-9\-]+" />
          </div>
          <div>
            <AdminLabel htmlFor="subtitle">Subtitle</AdminLabel>
            <AdminInput id="subtitle" name="subtitle" defaultValue={editing !== "new" ? (editing.subtitle ?? "") : ""} />
          </div>
          <div>
            <AdminLabel htmlFor="status">Status</AdminLabel>
            <AdminSelect id="status" name="status" defaultValue={editing !== "new" ? editing.status : "draft"}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </AdminSelect>
          </div>
          <div className="md:col-span-4">
            <AdminLabel>Cover image</AdminLabel>
            <MediaPicker
              selected={cover}
              onSelect={(media) => setCover({ id: media.id, url: media.url, alt_text: media.alt_text })}
              onClear={() => setCover(null)}
            />
          </div>
          {error && <p className="font-body text-sm text-danger md:col-span-4">{error}</p>}
          <div className="flex gap-2 md:col-span-4">
            <AdminButton type="submit" disabled={pending}>
              Save
            </AdminButton>
            <AdminButton type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </AdminButton>
          </div>
        </form>
      )}

      <div className="border border-border">
        {initialPublications.map((publication) => (
          <div
            key={publication.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="truncate font-body text-sm text-foreground">{publication.title}</p>
              <p className="truncate font-body text-xs text-foreground-muted">/{publication.slug}</p>
              <p className="mt-0.5 flex gap-3 font-body text-xs text-foreground-muted">
                <Link href={`/admin/sections?publication_id=${publication.id}`} className="hover:text-secondary-400">
                  {publication.sectionCount} {publication.sectionCount === 1 ? "section" : "sections"}
                </Link>
                <Link href={`/admin/content?publication_id=${publication.id}`} className="hover:text-secondary-400">
                  {publication.contentCount} {publication.contentCount === 1 ? "item" : "items"}
                </Link>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <StatusBadge status={publication.status} />
              <AdminButton type="button" variant="secondary" onClick={() => beginEdit(publication)}>
                Edit
              </AdminButton>
              <SafeDeleteButton
                itemLabel="publication"
                checkUsage={async () => {
                  const { sectionCount, contentCount } = await getPublicationUsageAction(publication.id);
                  if (sectionCount === 0 && contentCount === 0) return null;
                  const parts = [];
                  if (sectionCount > 0) parts.push(`${sectionCount} section${sectionCount === 1 ? "" : "s"}`);
                  if (contentCount > 0) parts.push(`${contentCount} piece${contentCount === 1 ? "" : "s"} of content`);
                  return parts.join(" and ");
                }}
                onConfirmDelete={() => remove(publication.id)}
              />
            </div>
          </div>
        ))}
        {initialPublications.length === 0 && <p className="p-6 font-body text-sm text-foreground-muted">No publications yet.</p>}
      </div>
    </div>
  );
}
