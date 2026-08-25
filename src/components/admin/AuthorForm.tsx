"use client";

import { useActionState, useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAuthorAction, deleteAuthorAction, getAuthorUsageAction, type AuthorFormState } from "@/lib/admin/author-actions";
import { AdminButton, AdminInput, AdminLabel, AdminTextarea } from "@/components/admin/ui";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { SafeDeleteButton } from "@/components/admin/SafeDeleteButton";
import type { AdminAuthorRow } from "@/lib/admin/queries";

const initialState: AuthorFormState = { error: null };

export function AuthorForm({ author }: { author: AdminAuthorRow | null }) {
  const [state, formAction, pending] = useActionState(saveAuthorAction, initialState);
  const router = useRouter();
  const [deletePending, startDeleteTransition] = useTransition();
  const [avatar, setAvatar] = useState<{ id: string; url: string | null; alt_text: string | null } | null>(
    author?.avatar_media_id ? { id: author.avatar_media_id, url: author.avatarUrl, alt_text: author.name } : null
  );
  const [slug, setSlug] = useState(author?.slug ?? "");

  useEffect(() => {
    if (state.authorId && !pending) {
      router.push("/admin/contributors");
    }
  }, [state.authorId, pending, router]);

  function remove() {
    if (!author) return;
    startDeleteTransition(async () => {
      const result = await deleteAuthorAction(author.id);
      if (result.error) {
        window.alert(result.error);
        return;
      }
      router.push("/admin/contributors");
    });
  }

  const slugChanged = author !== null && slug !== author.slug;

  return (
    <form action={formAction} className="max-w-xl space-y-6">
      {author && <input type="hidden" name="id" value={author.id} />}
      <input type="hidden" name="avatar_media_id" value={avatar?.id ?? ""} />

      {state.error && (
        <p role="alert" className="border border-danger/50 bg-danger/10 px-4 py-3 font-body text-sm text-danger">
          {state.error}
        </p>
      )}

      <div>
        <AdminLabel htmlFor="name">Name</AdminLabel>
        <AdminInput id="name" name="name" defaultValue={author?.name ?? ""} required />
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
        {slugChanged && author.articleCount > 0 && (
          <p className="mt-1.5 font-body text-xs text-coral">
            This contributor has {author.articleCount} {author.articleCount === 1 ? "article" : "articles"} — changing
            the slug changes their public URL immediately, and there is no redirect from the old one.
          </p>
        )}
      </div>
      <div>
        <AdminLabel htmlFor="title">Title</AdminLabel>
        <AdminInput id="title" name="title" defaultValue={author?.title ?? ""} placeholder="e.g. Senior Strategist" />
      </div>
      <div>
        <AdminLabel htmlFor="bio">Bio</AdminLabel>
        <AdminTextarea id="bio" name="bio" rows={4} defaultValue={author?.bio ?? ""} />
      </div>
      <div>
        <AdminLabel>Portrait</AdminLabel>
        <MediaPicker
          selected={avatar}
          onSelect={(media) => setAvatar({ id: media.id, url: media.url, alt_text: media.alt_text })}
          onClear={() => setAvatar(null)}
        />
      </div>

      <div className="flex items-center gap-3">
        <AdminButton type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save contributor"}
        </AdminButton>
        {author && (
          <SafeDeleteButton
            itemLabel="contributor"
            checkUsage={async () => {
              const { count } = await getAuthorUsageAction(author.id);
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
