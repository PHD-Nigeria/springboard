"use client";

import { useActionState, useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStaffAction, deleteStaffAction, getStaffUsageAction, type StaffFormState } from "@/lib/admin/staff-actions";
import { AdminButton, AdminInput, AdminLabel, AdminTextarea } from "@/components/admin/ui";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { SafeDeleteButton } from "@/components/admin/SafeDeleteButton";
import type { AdminStaffRow } from "@/lib/admin/queries";

const initialState: StaffFormState = { error: null };

/** Same shape as AuthorForm (src/components/admin/AuthorForm.tsx), `staff` is a separate directory from `authors` (bylines) because Staff Spotlight/Birthday reference real employees via staff_id, not everyone with a byline is staff and not every staff member ever writes. */
export function StaffForm({ staff }: { staff: AdminStaffRow | null }) {
  const [state, formAction, pending] = useActionState(saveStaffAction, initialState);
  const router = useRouter();
  const [deletePending, startDeleteTransition] = useTransition();
  const [photo, setPhoto] = useState<{ id: string; url: string | null; alt_text: string | null } | null>(
    staff?.photo_media_id ? { id: staff.photo_media_id, url: staff.photoUrl, alt_text: staff.full_name } : null
  );
  const [slug, setSlug] = useState(staff?.slug ?? "");

  useEffect(() => {
    if (state.staffId && !pending) {
      router.push("/admin/staff");
    }
  }, [state.staffId, pending, router]);

  function remove() {
    if (!staff) return;
    startDeleteTransition(async () => {
      const result = await deleteStaffAction(staff.id);
      if (result.error) {
        window.alert(result.error);
        return;
      }
      router.push("/admin/staff");
    });
  }

  const slugChanged = staff !== null && slug !== staff.slug;

  return (
    <form action={formAction} className="max-w-xl space-y-6">
      {staff && <input type="hidden" name="id" value={staff.id} />}
      <input type="hidden" name="photo_media_id" value={photo?.id ?? ""} />

      {state.error && (
        <p role="alert" className="border border-danger/50 bg-danger/10 px-4 py-3 font-body text-sm text-danger">
          {state.error}
        </p>
      )}

      <div>
        <AdminLabel htmlFor="full_name">Full name</AdminLabel>
        <AdminInput id="full_name" name="full_name" defaultValue={staff?.full_name ?? ""} required />
      </div>
      <div>
        <AdminLabel htmlFor="slug">Slug</AdminLabel>
        <AdminInput
          id="slug"
          name="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          pattern="[a-z0-9\-]+"
        />
        {slugChanged && staff.spotlightCount + staff.contentMentionCount > 0 && (
          <p className="mt-1.5 font-body text-xs text-coral">
            This person is referenced by {staff.spotlightCount + staff.contentMentionCount} piece
            {staff.spotlightCount + staff.contentMentionCount === 1 ? "" : "s"} of content, changing the slug
            changes their public profile URL immediately, and there is no redirect from the old one.
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <AdminLabel htmlFor="title">Job title</AdminLabel>
          <AdminInput id="title" name="title" defaultValue={staff?.title ?? ""} placeholder="e.g. Administrative Assistant" />
        </div>
        <div>
          <AdminLabel htmlFor="department">Department</AdminLabel>
          <AdminInput id="department" name="department" defaultValue={staff?.department ?? ""} />
        </div>
      </div>
      <div>
        <AdminLabel htmlFor="bio">Bio</AdminLabel>
        <AdminTextarea id="bio" name="bio" rows={3} defaultValue={staff?.bio ?? ""} />
      </div>
      <div>
        <AdminLabel>Photo</AdminLabel>
        <MediaPicker
          selected={photo}
          onSelect={(media) => setPhoto({ id: media.id, url: media.url, alt_text: media.alt_text })}
          onClear={() => setPhoto(null)}
        />
      </div>
      <label className="flex items-center gap-2 font-body text-sm text-foreground">
        <input type="checkbox" name="is_active" value="true" defaultChecked={staff?.is_active ?? true} />
        Active (inactive staff are hidden from public listings, per staff_select&rsquo;s RLS)
      </label>

      <div className="flex items-center gap-3">
        <AdminButton type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save staff member"}
        </AdminButton>
        {staff && (
          <SafeDeleteButton
            itemLabel="staff member"
            checkUsage={async () => {
              const { count } = await getStaffUsageAction(staff.id);
              return count > 0 ? `${count} piece${count === 1 ? "" : "s"} of content` : null;
            }}
            onConfirmDelete={remove}
          />
        )}
      </div>
      {deletePending && <p className="font-body text-xs text-foreground-muted">Deleting…</p>}
    </form>
  );
}
