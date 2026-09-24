"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { saveBirthdayAction, type BirthdayFormState } from "@/lib/admin/birthday-actions";
import { AdminButton, AdminInput, AdminLabel, AdminSelect, StatusBadge } from "@/components/admin/ui";
import { MediaPicker } from "@/components/admin/MediaPicker";
import type { AdminContentRow, AdminStaffRow } from "@/lib/admin/queries";

const initialState: BirthdayFormState = { error: null };

interface BirthdayFormProps {
  content: AdminContentRow | null;
  staffOptions: AdminStaffRow[];
  categoryId: string | null;
  initialStaffId: string | null;
  initialCover: { id: string; url: string | null; alt_text: string | null } | null;
}

/**
 * One BIRTHDAY content row per person, same reasoning as
 * birthday-actions.ts's own comment. Deliberately no block editor, a
 * birthday card is a name, a photo, and (optionally) a month/date, not a
 * written piece, so this form only asks for what StaffProfile actually
 * renders.
 */
export function BirthdayForm({ content, staffOptions, categoryId, initialStaffId, initialCover }: BirthdayFormProps) {
  const [state, formAction, pending] = useActionState(saveBirthdayAction, initialState);
  const router = useRouter();
  const [cover, setCover] = useState(initialCover);
  const [staffId, setStaffId] = useState(initialStaffId ?? "");

  if (!content && state.contentId && !pending) {
    router.replace(`/admin/content/${state.contentId}`);
  }

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
    <form action={formAction} className="max-w-xl space-y-6">
      {content && <input type="hidden" name="id" value={content.id} />}
      <input type="hidden" name="category_id" value={categoryId ?? ""} />
      <input type="hidden" name="cover_media_id" value={cover?.id ?? ""} />

      {state.error && (
        <p role="alert" className="border border-danger/50 bg-danger/10 px-4 py-3 font-body text-sm text-danger">
          {state.error}
        </p>
      )}

      <div>
        <AdminLabel htmlFor="staff_id">Who&rsquo;s the birthday for?</AdminLabel>
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
          <p className="mt-1.5 font-body text-xs text-coral">No staff in the directory yet, add one at /admin/staff first.</p>
        )}
      </div>

      <div>
        <AdminLabel htmlFor="title">Card title</AdminLabel>
        <AdminInput id="title" name="title" defaultValue={content?.title ?? ""} placeholder="e.g. Emmanuel Olawepo" required />
      </div>
      <div>
        <AdminLabel htmlFor="slug">Slug</AdminLabel>
        <AdminInput id="slug" name="slug" defaultValue={content?.slug ?? ""} required pattern="[a-z0-9\-]+" />
      </div>
      <div>
        <AdminLabel htmlFor="summary">Month (shown as the card&rsquo;s subtitle, e.g. &ldquo;April&rdquo;)</AdminLabel>
        <AdminInput id="summary" name="summary" defaultValue={content?.summary ?? ""} />
      </div>

      <div>
        <AdminLabel>Photo</AdminLabel>
        <MediaPicker selected={cover} onSelect={(media) => setCover({ id: media.id, url: media.url, alt_text: media.alt_text })} onClear={() => setCover(null)} />
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
