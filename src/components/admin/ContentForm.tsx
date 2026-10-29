"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { saveContentAction, type ContentFormState, type ContentRevisionRow } from "@/lib/admin/content-actions";
import { CONTENT_TYPES, CONTENT_TYPE_LABELS } from "@/content-types/types";
import type { Block } from "@/content-types/blocks";
import { AdminButton, AdminInput, AdminLabel, AdminNotice, AdminSelect, AdminTextarea, StatusBadge } from "@/components/admin/ui";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { BlockEditor, blockProblem } from "@/components/admin/BlockEditor";
import { RevisionPanel } from "@/components/admin/RevisionPanel";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import type { AdminContentRow } from "@/lib/admin/queries";
import type { AdminSession } from "@/lib/auth/session";

/**
 * EVENT, STAFF_SPOTLIGHT, and BIRTHDAY are deliberately excluded: EVENT's
 * metadata schema requires an eventDate this generic form has no field for,
 * and STAFF_SPOTLIGHT/BIRTHDAY's real data lives in dedicated relational
 * tables (staff_spotlights/spotlight_questions, content_staff) this form
 * doesn't write to — see each schema's own comment in
 * src/content-types/schemas. HEALTH_TIP and GALLERY have no required
 * metadata fields (both schemas are either fully optional or empty), so
 * they're safe to create through this same generic form: a GALLERY's images
 * are added afterward as ordinary block-editor images/gallery blocks, same
 * as any other content's media.
 */
const CREATABLE_TYPES = CONTENT_TYPES.filter(
  (type) => type === "ARTICLE" || type === "COMPANY_NEWS" || type === "HEALTH_TIP" || type === "GALLERY"
);

interface Option {
  id: string;
  label: string;
}

interface ContentFormProps {
  content: AdminContentRow | null;
  role: AdminSession["role"];
  authors: Option[];
  categories: Option[];
  publications: Option[];
  sections: { id: string; label: string; publicationId: string }[];
  initialMediaById: Record<string, { url: string | null; alt_text: string | null }>;
  /** Resolved server-side (getPublicUrl needs a Supabase client, which this Client Component doesn't have) — see the content editor page. */
  initialCover: { id: string; url: string | null; alt_text: string | null } | null;
  /** The active edition (Site Settings default) — only applied to brand-new content, never overrides an existing row's actual edition. */
  defaultPublicationId?: string | null;
  /** ARTICLE/COMPANY_NEWS only (§11) — empty for other content types or brand-new content. */
  revisions?: ContentRevisionRow[];
}

const initialState: ContentFormState = { error: null };

type Intent =
  | "save-draft"
  | "submit-for-review"
  | "publish"
  | "schedule"
  | "cancel-schedule"
  | "unpublish"
  | "return-to-draft"
  | "archive"
  | "back-to-draft";

/** What each action says when it has actually succeeded. Shown only after the server action returned without an error. */
const SUCCESS_TEXT: Record<Intent, string> = {
  "save-draft": "Saved.",
  "submit-for-review": "Submitted for review. An editor will publish it, schedule it or send it back to you.",
  publish: "Published. The story is now live.",
  schedule: "Scheduled. It will publish automatically at the chosen time.",
  "cancel-schedule": "Schedule cancelled. The story is back to draft.",
  unpublish: "Unpublished. The story is back to draft and no longer public.",
  "return-to-draft": "Returned to draft.",
  archive: "Archived.",
  "back-to-draft": "Restored to draft.",
};

const CONFIRMS: Partial<Record<Intent, { title: string; description: string; confirmLabel: string }>> = {
  unpublish: {
    title: "Unpublish this story?",
    description: "It will disappear from the public site and return to draft. You can publish it again later.",
    confirmLabel: "Unpublish",
  },
  archive: {
    title: "Archive this story?",
    description: "It will be removed from the public site and kept in the archive. You can restore it later.",
    confirmLabel: "Archive",
  },
  "cancel-schedule": {
    title: "Cancel the schedule?",
    description: "The story will not publish automatically and will go back to draft.",
    confirmLabel: "Cancel schedule",
  },
  "return-to-draft": {
    title: "Return to draft?",
    description: "The story leaves the review queue so it can be changed.",
    confirmLabel: "Return to draft",
  },
};

/** `<input type="datetime-local">` wants "YYYY-MM-DDTHH:mm" in the viewer's local time, not the stored UTC ISO string. */
function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

function safeBlocks(body: unknown): Block[] {
  if (body && typeof body === "object" && "blocks" in body && Array.isArray((body as { blocks: unknown }).blocks)) {
    return (body as { blocks: Block[] }).blocks;
  }
  return [];
}

function Panel({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 border border-border bg-surface" aria-label={title}>
      <h2 className="border-b border-border bg-surface-raised px-4 py-2 font-display text-sm font-semibold text-foreground">{title}</h2>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  );
}

export function ContentForm({
  content,
  role,
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
  const formRef = useRef<HTMLFormElement>(null);

  const isStaff = role !== "contributor";
  const status = content?.status ?? "draft";

  const [title, setTitle] = useState(content?.title ?? "");
  const [slug, setSlug] = useState(content?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(content));
  const [publicationId, setPublicationId] = useState(content?.publication_id ?? defaultPublicationId ?? "");
  const [coverMedia, setCoverMedia] = useState(initialCover);
  const [summary, setSummary] = useState(content?.summary ?? "");
  const [publishAt, setPublishAt] = useState(toDatetimeLocalValue(content?.publish_at));
  const [blocks, setBlocks] = useState<Block[]>(() => safeBlocks(content?.body));

  // Unsaved-change tracking. `changes` counts edits; `savedAt` is the count at the last confirmed save.
  const [changes, setChanges] = useState(0);
  const [savedAt, setSavedAt] = useState(0);
  const [submitted, setSubmitted] = useState<{ intent: Intent; changes: number; time: string } | null>(null);
  const [confirmIntent, setConfirmIntent] = useState<Intent | null>(null);
  const [leaveHref, setLeaveHref] = useState<string | null>(null);
  const [seenState, setSeenState] = useState(state);
  const [feedback, setFeedback] = useState<{ intent: Intent; time: string } | null>(null);

  // Adjusting state while rendering (React's documented pattern) when a new server result arrives:
  // success clears the unsaved flag and shows the success message; failure shows state.error and keeps everything dirty.
  if (state !== seenState) {
    setSeenState(state);
    if (!state.error && submitted) {
      setSavedAt(submitted.changes);
      setFeedback({ intent: submitted.intent, time: submitted.time });
    } else {
      setFeedback(null);
    }
  }

  const dirty = changes > savedAt;
  const markDirty = () => setChanges((value) => value + 1);

  // On first save of brand-new content there's no [id] route to already be
  // on — move to the real edit URL once the server action hands one back.
  // Editing existing content deliberately stays put so the save reads as "saved in place".
  useEffect(() => {
    if (!content && state.contentId && !pending) {
      router.replace(`/admin/content/${state.contentId}`);
    }
  }, [content, state.contentId, pending, router]);

  // Browser close / reload / external navigation.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // In-app navigation (sidebar and other links) does not fire beforeunload, so intercept link clicks while there are unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
      if (anchor.pathname === window.location.pathname && anchor.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveHref(anchor.pathname + anchor.search + anchor.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty]);

  const availableSections = sections.filter((section) => !publicationId || section.publicationId === publicationId);

  const blocksComplete = blocks.every((block) => !blockProblem(block));
  const readiness = [
    { label: "Title", ok: title.trim().length > 0, required: true },
    { label: "At least one content block", ok: blocks.length > 0, required: true },
    { label: "Every block complete", ok: blocksComplete, required: true },
    { label: "Edition chosen", ok: publicationId !== "", required: true },
    { label: "Summary", ok: summary.trim().length > 0, required: false },
    { label: "Cover image", ok: Boolean(coverMedia), required: false },
  ];
  const missingRequired = readiness.filter((item) => item.required && !item.ok);
  const publishBlocked = missingRequired.length > 0;
  const publishAtIso = publishAt ? new Date(publishAt).toISOString() : "";

  /**
   * Submitted through our own function rather than `<form action={formAction}>` on purpose: React 19 resets every
   * uncontrolled field in a form after its `action` finishes — including when the server returned an error — so
   * a refused save (for example an incomplete block) wiped the title, slug, summary and selects of brand-new
   * content. Dispatching the same server action ourselves, with the same FormData, keeps everything the editor
   * typed and still shows `state.error`. The browser's own required/pattern validation still runs first, and the
   * server action and its checks are unchanged.
   */
  function send(intent: Intent) {
    const form = formRef.current;
    if (!form || pending) return;
    if (!form.reportValidity()) return;
    const formData = new FormData(form);
    formData.set("intent", intent);
    setSubmitted({ intent, changes, time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) });
    startTransition(() => formAction(formData));
  }

  function request(intent: Intent) {
    if (CONFIRMS[intent]) setConfirmIntent(intent);
    else send(intent);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Enter inside a text field saves the draft; every other action is an explicit button.
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    send((submitter?.value as Intent) || "save-draft");
  }

  function previewUrl() {
    return content ? `/admin/content/${content.id}/preview` : null;
  }

  const confirm = confirmIntent ? CONFIRMS[confirmIntent] : undefined;
  const saveLabel = status === "draft" ? "Save draft" : "Save changes";
  const scheduleWhen = content?.publish_at
    ? new Date(content.publish_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onChange={markDirty}
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
          event.preventDefault();
          if (status !== "archived") send("save-draft");
        }
      }}
      className="grid grid-cols-1 gap-6 pb-16 xl:grid-cols-[minmax(0,1fr)_21rem] xl:pb-0"
    >
      {content && <input type="hidden" name="id" value={content.id} />}
      {content && <input type="hidden" name="current_status" value={content.status} />}
      <input type="hidden" name="cover_media_id" value={coverMedia?.id ?? ""} />

      {/* ------------------------------------------------------------ writing area */}
      <div className="min-w-0 space-y-5">
        {state.error && !pending && <AdminNotice tone="error">{state.error}</AdminNotice>}
        {feedback && !state.error && !pending && (
          <AdminNotice tone="success">
            {SUCCESS_TEXT[feedback.intent]} <span className="text-foreground-muted">({feedback.time})</span>
          </AdminNotice>
        )}

        <div>
          <AdminLabel htmlFor="title">Title</AdminLabel>
          <AdminInput
            id="title"
            name="title"
            value={title}
            required
            placeholder="Story title"
            className="py-2.5 text-lg font-semibold"
            onChange={(event) => {
              setTitle(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label htmlFor="slug" className="font-body text-xs font-medium text-foreground-muted">
              Web address
            </label>
            <AdminInput
              id="slug"
              name="slug"
              value={slug}
              required
              pattern="[a-z0-9\-]+"
              title="Lowercase letters, numbers and hyphens only"
              className="max-w-xs py-1 text-xs"
              onChange={(event) => {
                setSlug(event.target.value);
                setSlugTouched(true);
              }}
            />
            {!slugTouched && <span className="font-body text-xs text-foreground-muted">Made from the title. Edit to change.</span>}
          </div>
        </div>

        <div>
          <AdminLabel htmlFor="subtitle">Subtitle</AdminLabel>
          <AdminInput id="subtitle" name="subtitle" defaultValue={content?.subtitle ?? ""} />
        </div>

        <div>
          <AdminLabel htmlFor="summary">Summary / excerpt</AdminLabel>
          <AdminTextarea id="summary" name="summary" rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} aria-describedby="summary-help" />
          <p id="summary-help" className="mt-1 font-body text-xs text-foreground-muted">
            Shown on cards and in search. One or two sentences.
          </p>
        </div>

        <div>
          <AdminLabel>Content</AdminLabel>
          <BlockEditor
            initialBlocks={safeBlocks(content?.body)}
            currentContentId={content?.id}
            initialMediaById={initialMediaById}
            onDirty={markDirty}
            onBlocksChange={setBlocks}
          />
        </div>

        {content && revisions && (
          <div className="border-t border-border pt-5">
            <AdminLabel>Revision history</AdminLabel>
            <RevisionPanel contentId={content.id} revisions={revisions} />
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------ side panels */}
      <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <Panel title="Publish" id="publish-panel">
          <div className="flex items-center justify-between gap-3">
            <span className="font-body text-xs font-medium text-foreground-muted">Status</span>
            <StatusBadge status={status} />
          </div>
          {status === "scheduled" && scheduleWhen && (
            <p className="font-body text-sm text-foreground">
              Scheduled for <strong>{scheduleWhen}</strong>.
            </p>
          )}
          {dirty ? (
            <p role="status" className="font-body text-xs font-semibold text-danger">
              You have unsaved changes.
            </p>
          ) : (
            content && <p className="font-body text-xs text-foreground-muted">All changes saved.</p>
          )}

          {status !== "archived" && (
            <div>
              <p className="mb-1 font-body text-xs font-medium text-foreground-muted">Ready to publish?</p>
              <ul className="space-y-0.5 font-body text-xs">
                {readiness.map((item) => (
                  <li key={item.label} className="flex gap-2 text-foreground">
                    <span aria-hidden="true" className="w-4 font-bold">{item.ok ? "✓" : item.required ? "✗" : "–"}</span>
                    <span>
                      {item.label}
                      <span className="sr-only">: {item.ok ? "done" : item.required ? "needed" : "optional, not set"}</span>
                      {!item.required && !item.ok && <span className="text-foreground-muted"> (optional)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isStaff && status !== "published" && status !== "archived" && (
            <div>
              <AdminLabel htmlFor="publish_at">Publish date and time</AdminLabel>
              {/* `datetime-local`'s value is timezone-naive ("2026-08-15T17:59", no offset); the hidden field converts it
                  through `new Date(...)`, which parses a date-time with no offset as the viewer's local time, so
                  `.toISOString()` is the correct absolute instant to submit. */}
              <AdminInput id="publish_at" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
              <p className="mt-1 font-body text-xs text-foreground-muted">Only used by Schedule.</p>
            </div>
          )}
          <input type="hidden" name="publish_at" value={publishAtIso} />

          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {status === "archived" ? (
              isStaff ? (
                <AdminButton type="button" disabled={pending} onClick={() => request("back-to-draft")}>
                  {pending ? "Restoring…" : "Restore to draft"}
                </AdminButton>
              ) : (
                <p className="font-body text-sm text-foreground-muted">This story is archived. Ask an editor to restore it.</p>
              )
            ) : (
              <>
                {isStaff && (status === "draft" || status === "review") && (
                  <AdminButton type="button" disabled={pending || publishBlocked} onClick={() => request("publish")}>
                    {pending && submitted?.intent === "publish" ? "Publishing…" : "Publish now"}
                  </AdminButton>
                )}
                {isStaff && (status === "draft" || status === "review") && (
                  <AdminButton type="button" variant="secondary" disabled={pending || publishBlocked || !publishAt} onClick={() => request("schedule")}>
                    Schedule
                  </AdminButton>
                )}
                {status === "draft" && (
                  <AdminButton type="button" variant={isStaff ? "secondary" : "primary"} disabled={pending} onClick={() => request("submit-for-review")}>
                    Submit for review
                  </AdminButton>
                )}
                <AdminButton type="submit" name="intent" value="save-draft" variant="secondary" disabled={pending}>
                  {pending && submitted?.intent === "save-draft" ? "Saving…" : saveLabel}
                </AdminButton>
                {status === "review" && (
                  <AdminButton type="button" variant="secondary" disabled={pending} onClick={() => request("return-to-draft")}>
                    Return to draft
                  </AdminButton>
                )}
                {isStaff && status === "scheduled" && (
                  <AdminButton type="button" variant="secondary" disabled={pending} onClick={() => request("cancel-schedule")}>
                    Cancel schedule
                  </AdminButton>
                )}
                {isStaff && status === "published" && (
                  <AdminButton type="button" variant="secondary" disabled={pending} onClick={() => request("unpublish")}>
                    Unpublish
                  </AdminButton>
                )}
              </>
            )}
          </div>
          {isStaff && (status === "draft" || status === "review") && publishBlocked && (
            <p className="font-body text-xs text-foreground-muted">
              Publish and Schedule unlock when the required items above are done: {missingRequired.map((item) => item.label.toLowerCase()).join(", ")}.
            </p>
          )}
          {isStaff && (status === "draft" || status === "review") && !publishAt && !publishBlocked && (
            <p className="font-body text-xs text-foreground-muted">Choose a date and time to enable Schedule.</p>
          )}
          {!isStaff && status === "draft" && (
            <p className="font-body text-xs text-foreground-muted">Submit for review when you are ready. An editor publishes the story.</p>
          )}
          {!isStaff && status === "review" && (
            <p className="font-body text-xs text-foreground-muted">Waiting for an editor. You can still edit it or return it to draft.</p>
          )}

          {content && (
            <div className="border-t border-border pt-3">
              <p className="mb-1 font-body text-xs font-medium text-foreground-muted">Preview</p>
              <div className="flex flex-wrap gap-2">
                <a href={previewUrl()!} target="_blank" rel="noopener noreferrer" className="border border-border bg-surface px-3 py-1.5 font-body text-xs font-medium text-foreground hover:border-border-strong">
                  Desktop<span className="sr-only"> preview (new tab)</span>
                </a>
                <button
                  type="button"
                  onClick={() => window.open(previewUrl()!, "springboard-preview-phone", "popup=yes,width=400,height=820")}
                  className="border border-border bg-surface px-3 py-1.5 font-body text-xs font-medium text-foreground hover:border-border-strong"
                >
                  Phone size<span className="sr-only"> preview (new window)</span>
                </button>
              </div>
              {dirty && <p className="mt-1 font-body text-xs text-foreground-muted">The preview shows the last saved version. Save first to see your latest edits.</p>}
            </div>
          )}

          {isStaff && content && status !== "archived" && (
            <div className="border-t border-border pt-3">
              <button type="button" disabled={pending} onClick={() => request("archive")} className="font-body text-xs text-danger underline underline-offset-2">
                Archive this story
              </button>
            </div>
          )}
        </Panel>

        <Panel title="Story details">
          <div>
            <AdminLabel htmlFor="content_type">Content type</AdminLabel>
            <AdminSelect id="content_type" name="content_type" defaultValue={content?.content_type ?? "ARTICLE"} required>
              {CREATABLE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CONTENT_TYPE_LABELS[type]}
                </option>
              ))}
            </AdminSelect>
          </div>
          <div>
            <AdminLabel htmlFor="publication_id">Edition (quarter)</AdminLabel>
            <AdminSelect id="publication_id" name="publication_id" value={publicationId} onChange={(e) => setPublicationId(e.target.value)} aria-describedby="edition-help">
              <option value="">Not assigned to an edition</option>
              {publications.map((publication) => (
                <option key={publication.id} value={publication.id}>
                  {publication.label}
                  {publication.id === defaultPublicationId ? " (active edition)" : ""}
                </option>
              ))}
            </AdminSelect>
            <p id="edition-help" className="mt-1 font-body text-xs text-foreground-muted">
              A story needs an edition before it can be published. {defaultPublicationId && !content ? "The active edition is pre-selected for new stories." : ""}
            </p>
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
        </Panel>

        <Panel title="Cover image">
          <MediaPicker
            selected={coverMedia}
            onSelect={(media) => {
              setCoverMedia({ id: media.id, url: media.url, alt_text: media.alt_text });
              markDirty();
            }}
            onClear={() => {
              setCoverMedia(null);
              markDirty();
            }}
          />
        </Panel>
      </div>

      {/* Small screens: the publishing panel sits below the writing area, so keep Save and a jump link within reach. */}
      {status !== "archived" && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-border-strong bg-surface px-4 py-2 xl:hidden">
          <span className={`font-body text-xs ${dirty ? "font-semibold text-danger" : "text-foreground-muted"}`}>{dirty ? "Unsaved changes" : "Saved"}</span>
          <div className="flex items-center gap-3">
            <a href="#publish-panel" className="font-body text-sm text-primary-600 underline underline-offset-2">
              Publish options
            </a>
            <AdminButton type="submit" name="intent" value="save-draft" disabled={pending}>
              {pending && submitted?.intent === "save-draft" ? "Saving…" : saveLabel}
            </AdminButton>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmIntent !== null}
        pending={pending}
        destructive={confirmIntent === "archive" || confirmIntent === "unpublish"}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        confirmLabel={confirm?.confirmLabel ?? "Confirm"}
        onCancel={() => setConfirmIntent(null)}
        onConfirm={() => {
          if (!confirmIntent) return;
          const intent = confirmIntent;
          setConfirmIntent(null);
          send(intent);
        }}
      />
      <ConfirmDialog
        open={leaveHref !== null}
        title="Leave without saving?"
        description={`You have unsaved changes to "${title || "this story"}". If you leave now they will be lost.`}
        confirmLabel="Leave without saving"
        destructive
        onCancel={() => setLeaveHref(null)}
        onConfirm={() => {
          const href = leaveHref;
          setLeaveHref(null);
          if (href) {
            setSavedAt(changes); // the user chose to discard; do not warn again on the way out
            router.push(href);
          }
        }}
      />
    </form>
  );
}
