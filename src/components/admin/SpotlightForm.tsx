"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSpotlightAction, type SpotlightFormState } from "@/lib/admin/spotlight-actions";
import { AdminButton, AdminInput, AdminLabel, AdminSelect, AdminTextarea, StatusBadge } from "@/components/admin/ui";
import { MediaPicker } from "@/components/admin/MediaPicker";
import type { AdminContentRow, AdminStaffRow } from "@/lib/admin/queries";

interface QAPair {
  key: string;
  question: string;
  answer: string;
}

let keyCounter = 0;
function newKey() {
  keyCounter += 1;
  return `qa-${keyCounter}`;
}

const initialState: SpotlightFormState = { error: null };

interface SpotlightFormProps {
  content: AdminContentRow | null;
  staffOptions: AdminStaffRow[];
  categoryId: string | null;
  initialStaffId: string | null;
  initialQuestions: { question: string; answer: string }[];
  initialCover: { id: string; url: string | null; alt_text: string | null } | null;
}

/**
 * Dedicated Staff Spotlight builder, not a variant of ContentForm. A
 * spotlight's real editable data is "who, and what did they say" (staff_id
 * + ordered Q&A), not the block-editor body every other creatable type
 * uses, so this form's shape reflects that directly rather than bolting
 * Q&A fields onto the generic form.
 */
export function SpotlightForm({ content, staffOptions, categoryId, initialStaffId, initialQuestions, initialCover }: SpotlightFormProps) {
  const [state, formAction, pending] = useActionState(saveSpotlightAction, initialState);
  const router = useRouter();
  const [cover, setCover] = useState(initialCover);
  const [staffId, setStaffId] = useState(initialStaffId ?? "");
  const [pairs, setPairs] = useState<QAPair[]>(
    initialQuestions.length > 0
      ? initialQuestions.map((q) => ({ key: newKey(), question: q.question, answer: q.answer }))
      : [{ key: newKey(), question: "", answer: "" }]
  );

  if (!content && state.contentId && !pending) {
    router.replace(`/admin/content/${state.contentId}`);
  }

  function updatePair(key: string, field: "question" | "answer", value: string) {
    setPairs((current) => current.map((p) => (p.key === key ? { ...p, [field]: value } : p)));
  }

  function addPair() {
    setPairs((current) => [...current, { key: newKey(), question: "", answer: "" }]);
  }

  function removePair(key: string) {
    setPairs((current) => (current.length > 1 ? current.filter((p) => p.key !== key) : current));
  }

  // When a staff member is picked and no cover has been set yet, default
  // the spotlight's cover to their directory photo, the same photo shown
  // on /admin/staff, so the two stay visually consistent unless an editor
  // deliberately picks something else via MediaPicker below.
  function handleStaffChange(id: string) {
    setStaffId(id);
    if (!cover) {
      const person = staffOptions.find((s) => s.id === id);
      if (person?.photo_media_id && person.photoUrl) {
        setCover({ id: person.photo_media_id, url: person.photoUrl, alt_text: person.full_name });
      }
    }
  }

  return (
    <form action={formAction} className="max-w-2xl space-y-8">
      {content && <input type="hidden" name="id" value={content.id} />}
      <input type="hidden" name="category_id" value={categoryId ?? ""} />
      <input type="hidden" name="cover_media_id" value={cover?.id ?? ""} />

      {state.error && (
        <p role="alert" className="border border-danger/50 bg-danger/10 px-4 py-3 font-body text-sm text-danger">
          {state.error}
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

      <div>
        <AdminLabel htmlFor="staff_id">Who is this about?</AdminLabel>
        <AdminSelect id="staff_id" name="staff_id" value={staffId} onChange={(e) => handleStaffChange(e.target.value)} required>
          <option value="">Choose a staff member…</option>
          {staffOptions.map((person) => (
            <option key={person.id} value={person.id}>
              {person.full_name}
              {person.title ? ` (${person.title})` : ""}
            </option>
          ))}
        </AdminSelect>
        {staffOptions.length === 0 && (
          <p className="mt-1.5 font-body text-xs text-coral">
            No staff in the directory yet, add one at /admin/staff first.
          </p>
        )}
      </div>

      <div>
        <AdminLabel>Photo</AdminLabel>
        <MediaPicker selected={cover} onSelect={(media) => setCover({ id: media.id, url: media.url, alt_text: media.alt_text })} onClear={() => setCover(null)} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <AdminLabel className="mb-0">Questions &amp; answers</AdminLabel>
          <AdminButton type="button" variant="secondary" onClick={addPair}>
            Add question
          </AdminButton>
        </div>
        <div className="space-y-4">
          {pairs.map((pair, index) => (
            <div key={pair.key} className="border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <AdminLabel htmlFor={`q-${pair.key}`} className="mb-0">
                  Question {index + 1}
                </AdminLabel>
                {pairs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePair(pair.key)}
                    className="font-body text-xs text-foreground-muted hover:text-danger"
                  >
                    Remove
                  </button>
                )}
              </div>
              <AdminInput
                id={`q-${pair.key}`}
                name="question"
                value={pair.question}
                onChange={(e) => updatePair(pair.key, "question", e.target.value)}
                placeholder="e.g. What made you say yes to PHD?"
                className="mb-2"
              />
              <AdminLabel htmlFor={`a-${pair.key}`}>Answer</AdminLabel>
              <AdminTextarea
                id={`a-${pair.key}`}
                name="answer"
                rows={2}
                value={pair.answer}
                onChange={(e) => updatePair(pair.key, "answer", e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        {content && <StatusBadge status={content.status} />}
        <AdminButton type="submit" name="intent" value="save-draft" disabled={pending} variant="secondary">
          {pending ? "Saving…" : content?.status === "published" ? "Save changes" : "Save draft"}
        </AdminButton>
        {content?.status !== "published" && (
          <AdminButton type="submit" name="intent" value="publish" disabled={pending}>
            Publish
          </AdminButton>
        )}
      </div>
    </form>
  );
}
