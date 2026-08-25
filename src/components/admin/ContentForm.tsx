"use client";

import { useActionState, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveContentAction, type ContentFormState, type ContentRevisionRow } from "@/lib/admin/content-actions";
import { CONTENT_TYPES } from "@/content-types/types";
import { AdminButton, AdminInput, AdminLabel, AdminSelect, AdminTextarea, StatusBadge } from "@/components/admin/ui";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { BlockEditor } from "@/components/admin/BlockEditor";
import { RevisionPanel } from "@/components/admin/RevisionPanel";
import type { AdminContentRow } from "@/lib/admin/queries";

const CREATABLE_TYPES = CONTENT_TYPES.filter((type) => type === "ARTICLE" || type === "COMPANY_NEWS");

interface Option {
  id: string;
  label: string;
}

interface ContentFormProps {
  content: AdminContentRow | null;
  authors: Option[];
  categories: Option[];
  publications: Option[];
  sections: { id: string; label: string; publicationId: string }[];
  initialMediaById: Record<string, { url: string | null; alt_text: string | null }>;
  /** Resolved server-side (getPublicUrl needs a Supabase client, which this Client Component doesn't have) — see the content editor page. */
  initialCover: { id: string; url: string | null; alt_text: string | null } | null;
  /** Settings' default publication (§Settings, Phase 4C) — only applied to brand-new content, never overrides an existing row's actual publication. */
  defaultPublicationId?: string | null;
  /** ARTICLE/COMPANY_NEWS only (§11) — empty for other content types or brand-new content. */
  revisions?: ContentRevisionRow[];
}

const initialState: ContentFormState = { error: null };

/** `<input type="datetime-local">` wants "YYYY-MM-DDTHH:mm" in the viewer's local time, not the stored UTC ISO string. */
function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ContentForm({
  content,
  authors,
  categories,
  publications,
  sections,
  initialMediaById,
  initialCover,
  defaultPublicationId,
  revisions,
}: ContentFormProps) {
  const [state, formAction, pending] = useActionState(saveContentAction, initialState);
  const router = useRouter();

  const [publicationId, setPublicationId] = useState(content?.publication_id ?? defaultPublicationId ?? "");
  const [coverMedia, setCoverMedia] = useState(initialCover);
  const [publishAt, setPublishAt] = useState(toDatetimeLocalValue(content?.publish_at));

  // On first save of brand-new content there's no [id] route to already be
  // on — move to the real edit URL once the server action hands one back,
  // the same way AuthorForm does. Editing existing content deliberately
  // stays put so the save reads as "saved in place," not a redirect.
  useEffect(() => {
    if (!content && state.contentId && !pending) {
      router.replace(`/admin/content/${state.contentId}`);
    }
  }, [content, state.contentId, pending, router]);

  const availableSections = sections.filter((section) => !publicationId || section.publicationId === publicationId);

  return (
    <form action={formAction} className="space-y-8">
      {content && <input type="hidden" name="id" value={content.id} />}
      {content && <input type="hidden" name="current_status" value={content.status} />}
      <input type="hidden" name="cover_media_id" value={coverMedia?.id ?? ""} />

      {state.error && (
        <p role="alert" className="border border-danger/50 bg-danger/10 px-4 py-3 font-body text-sm text-danger">
          {state.error}
        </p>
      )}
      {content && !state.error && state.contentId && !pending && (
        <p role="status" className="border border-secondary-400/50 bg-secondary-400/10 px-4 py-3 font-body text-sm text-secondary-400">
          Saved.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <AdminLabel htmlFor="title">Title</AdminLabel>
          <AdminInput id="title" name="title" defaultValue={content?.title ?? ""} required />
        </div>
        <div>
          <AdminLabel htmlFor="slug">Slug</AdminLabel>
          <AdminInput id="slug" name="slug" defaultValue={content?.slug ?? ""} required pattern="[a-z0-9\-]+" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <AdminLabel htmlFor="subtitle">Subtitle</AdminLabel>
          <AdminInput id="subtitle" name="subtitle" defaultValue={content?.subtitle ?? ""} />
        </div>
        <div>
          <AdminLabel htmlFor="content_type">Content type</AdminLabel>
          <AdminSelect id="content_type" name="content_type" defaultValue={content?.content_type ?? "ARTICLE"} required>
            {CREATABLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </AdminSelect>
        </div>
      </div>

      <div>
        <AdminLabel htmlFor="summary">Summary / excerpt</AdminLabel>
        <AdminTextarea id="summary" name="summary" rows={3} defaultValue={content?.summary ?? ""} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <AdminLabel htmlFor="author_id">Author</AdminLabel>
          <AdminSelect id="author_id" name="author_id" defaultValue={content?.author_id ?? ""}>
            <option value="">No author</option>
            {authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.label}
              </option>
            ))}
          </AdminSelect>
        </div>
        <div>
          <AdminLabel htmlFor="category_id">Category</AdminLabel>
          <AdminSelect id="category_id" name="category_id" defaultValue={content?.category_id ?? ""}>
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </AdminSelect>
        </div>
        <div>
          <AdminLabel htmlFor="publication_id">Publication</AdminLabel>
          <AdminSelect
            id="publication_id"
            name="publication_id"
            value={publicationId}
            onChange={(e) => setPublicationId(e.target.value)}
          >
            <option value="">No publication</option>
            {publications.map((publication) => (
              <option key={publication.id} value={publication.id}>
                {publication.label}
              </option>
            ))}
          </AdminSelect>
        </div>
        <div>
          <AdminLabel htmlFor="section_id">Section</AdminLabel>
          <AdminSelect id="section_id" name="section_id" defaultValue={content?.section_id ?? ""}>
            <option value="">No section</option>
            {availableSections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </AdminSelect>
        </div>
      </div>

      <div className="border border-border bg-surface p-4">
        <div className="mb-3 flex items-center gap-3">
          <AdminLabel className="mb-0">Publishing</AdminLabel>
          {content && <StatusBadge status={content.status} />}
        </div>
        {content?.status === "scheduled" && content.publish_at && (
          <p className="mb-3 font-body text-sm text-coral">
            Scheduled for{" "}
            {new Date(content.publish_at).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            .
          </p>
        )}
        {(content?.status ?? "draft") !== "published" && (content?.status ?? "draft") !== "archived" && (
          <div className="max-w-xs">
            <AdminLabel htmlFor="publish_at">Publication date/time</AdminLabel>
            {/* `datetime-local`'s value is timezone-naive ("2026-08-15T17:59",
                no offset) — sent as-is, Postgres has no way to know it means
                the *browser's* local time and would store it as UTC instead,
                silently drifting by the viewer's UTC offset. Not submitted
                directly: the hidden field below converts it through `new
                Date(...)`, which — for a date-TIME string with no offset —
                the spec defines as local-time parsing, so `.toISOString()`
                yields the correct absolute instant to actually submit. */}
            <AdminInput
              id="publish_at"
              type="datetime-local"
              value={publishAt}
              onChange={(e) => setPublishAt(e.target.value)}
            />
            <input type="hidden" name="publish_at" value={publishAt ? new Date(publishAt).toISOString() : ""} />
          </div>
        )}
      </div>

      <div>
        <AdminLabel>Cover image</AdminLabel>
        <MediaPicker
          selected={coverMedia}
          onSelect={(media) => setCoverMedia({ id: media.id, url: media.url, alt_text: media.alt_text })}
          onClear={() => setCoverMedia(null)}
        />
      </div>

      <div>
        <AdminLabel>Content blocks</AdminLabel>
        <BlockEditor
          initialBlocks={content?.body ? safeBlocks(content.body) : []}
          currentContentId={content?.id}
          initialMediaById={initialMediaById}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        {content?.status === "archived" ? (
          <>
            <p className="w-full font-body text-sm text-foreground-muted">
              This content is archived. Restore it to draft before making further changes.
            </p>
            <AdminButton type="submit" name="intent" value="back-to-draft" disabled={pending}>
              {pending ? "Restoring…" : "Restore to draft"}
            </AdminButton>
            <AdminButton
              type="button"
              variant="ghost"
              onClick={() => router.push(`/admin/content/${content.id}/preview`)}
            >
              Preview
            </AdminButton>
          </>
        ) : content?.status === "scheduled" ? (
          <>
            <AdminButton type="submit" name="intent" value="save-draft" disabled={pending} variant="secondary">
              {pending ? "Saving…" : "Save changes"}
            </AdminButton>
            <AdminButton type="submit" name="intent" value="cancel-schedule" disabled={pending} variant="secondary">
              Cancel schedule
            </AdminButton>
            <AdminButton type="button" variant="ghost" onClick={() => router.push(`/admin/content/${content.id}/preview`)}>
              Preview
            </AdminButton>
          </>
        ) : (
          <>
            <AdminButton type="submit" name="intent" value="save-draft" disabled={pending} variant="secondary">
              {pending ? "Saving…" : content?.status === "published" ? "Save changes" : "Save draft"}
            </AdminButton>
            {content?.status !== "published" && (
              <AdminButton type="submit" name="intent" value="publish" disabled={pending}>
                Publish
              </AdminButton>
            )}
            {(content?.status ?? "draft") === "draft" && (
              <AdminButton type="submit" name="intent" value="submit-for-review" disabled={pending} variant="secondary">
                Submit for review
              </AdminButton>
            )}
            {content?.status !== "published" && (
              <AdminButton type="submit" name="intent" value="schedule" disabled={pending} variant="secondary">
                Schedule
              </AdminButton>
            )}
            {content?.status === "published" && (
              <AdminButton type="submit" name="intent" value="unpublish" disabled={pending} variant="secondary">
                Unpublish
              </AdminButton>
            )}
            {content && (
              <AdminButton type="submit" name="intent" value="archive" disabled={pending} variant="secondary">
                Archive
              </AdminButton>
            )}
            {content && (
              <AdminButton
                type="button"
                variant="ghost"
                onClick={() => router.push(`/admin/content/${content.id}/preview`)}
              >
                Preview
              </AdminButton>
            )}
          </>
        )}
      </div>

      {content && revisions && (
        <div className="border-t border-border pt-6">
          <AdminLabel>Revision history</AdminLabel>
          <RevisionPanel contentId={content.id} revisions={revisions} />
        </div>
      )}
    </form>
  );
}

function safeBlocks(body: unknown): import("@/content-types/blocks").Block[] {
  if (body && typeof body === "object" && "blocks" in body && Array.isArray((body as { blocks: unknown }).blocks)) {
    return (body as { blocks: import("@/content-types/blocks").Block[] }).blocks;
  }
  return [];
}
