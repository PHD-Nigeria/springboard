"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveHomepageConfigAction } from "@/lib/admin/taxonomy-actions";
import { AdminButton, AdminCard, AdminInput, AdminLabel, AdminSelect, AdminTextarea } from "@/components/admin/ui";
import { ContentPicker } from "@/components/admin/ContentPicker";

const CONTRIBUTOR_SLOTS = 4;

/**
 * The CMS controls WHICH content/contributors/copy lead the homepage; the
 * existing FeaturedStory/ContributorCard/EditorialBanner components still
 * control HOW that renders — nothing here is a layout or ordering control.
 * Every field is optional: leaving it unset preserves the pre-existing
 * automatic behavior (most-recently-published content, alphabetically-
 * first contributors, the original hardcoded banner copy).
 */
export function HomepageConfigForm({
  featuredContentId,
  featuredContentTitle,
  featuredAuthorNames,
  bannerTitle,
  bannerDescription,
  siteTitle,
  seoDefaultDescription,
  authors,
  isAdmin,
}: {
  featuredContentId: string | null;
  featuredContentTitle: string | null;
  featuredAuthorNames: { id: string; name: string }[];
  bannerTitle: string | null;
  bannerDescription: string | null;
  siteTitle: string | null;
  seoDefaultDescription: string | null;
  authors: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const [featuredIds, setFeaturedIds] = useState<string[]>(featuredContentId ? [featuredContentId] : []);
  const initialSlots = Array.from({ length: CONTRIBUTOR_SLOTS }, (_, i) => featuredAuthorNames[i]?.id ?? "");
  const [slots, setSlots] = useState<string[]>(initialSlots);

  function submit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveHomepageConfigAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <AdminCard className="max-w-2xl">
      <p className="font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">Homepage &amp; SEO</p>
      <form action={submit} className="mt-3 space-y-6">
        <input type="hidden" name="featured_content_id" value={featuredIds[0] ?? ""} />

        <div>
          <AdminLabel>Featured story</AdminLabel>
          <p className="mb-2 font-body text-xs text-foreground-muted">
            Leads the homepage. Leave unset to automatically show the most recently published piece.
            {featuredContentTitle && !isAdmin && <> Currently: <strong className="text-foreground">{featuredContentTitle}</strong>.</>}
          </p>
          {isAdmin ? (
            <ContentPicker
              selectedIds={featuredIds}
              onChange={(ids) => setFeaturedIds(ids.length > 0 ? [ids[ids.length - 1]] : [])}
            />
          ) : (
            <p className="font-body text-sm text-foreground">{featuredContentTitle ?? "None set — most recent is shown."}</p>
          )}
        </div>

        <div>
          <AdminLabel>Featured contributors</AdminLabel>
          <p className="mb-2 font-body text-xs text-foreground-muted">
            Up to {CONTRIBUTOR_SLOTS} people shown in the homepage&rsquo;s People section, in this order. Leave a slot as
            &ldquo;None&rdquo; to fall back to alphabetical.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {slots.map((value, index) => (
              <div key={index}>
                <AdminLabel htmlFor={`featured_author_slot_${index}`}>Slot {index + 1}</AdminLabel>
                <AdminSelect
                  id={`featured_author_slot_${index}`}
                  value={value}
                  disabled={!isAdmin}
                  onChange={(e) => setSlots((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))}
                >
                  <option value="">None</option>
                  {authors.map((author) => (
                    <option key={author.id} value={author.id}>
                      {author.name}
                    </option>
                  ))}
                </AdminSelect>
              </div>
            ))}
          </div>
          {slots.filter(Boolean).map((id) => (
            <input key={id} type="hidden" name="featured_author_id" value={id} />
          ))}
        </div>

        <div>
          <AdminLabel htmlFor="banner_title">Editorial banner title</AdminLabel>
          <AdminInput
            id="banner_title"
            name="banner_title"
            defaultValue={bannerTitle ?? ""}
            disabled={!isAdmin}
            placeholder="Where PHD Nigeria's people, ideas, and culture come together."
          />
        </div>
        <div>
          <AdminLabel htmlFor="banner_description">Editorial banner description</AdminLabel>
          <AdminTextarea
            id="banner_description"
            name="banner_description"
            rows={2}
            defaultValue={bannerDescription ?? ""}
            disabled={!isAdmin}
            placeholder="A space for the stories, insights, and voices that shape how we work."
          />
        </div>

        <div>
          <AdminLabel htmlFor="site_title">Site title</AdminLabel>
          <AdminInput id="site_title" name="site_title" defaultValue={siteTitle ?? ""} disabled={!isAdmin} placeholder="Springboard | PHD Nigeria" />
        </div>
        <div>
          <AdminLabel htmlFor="seo_default_description">Default SEO description</AdminLabel>
          <AdminTextarea
            id="seo_default_description"
            name="seo_default_description"
            rows={2}
            defaultValue={seoDefaultDescription ?? ""}
            disabled={!isAdmin}
            placeholder="PHD Nigeria Springboard — digital editorial platform."
          />
        </div>

        {!isAdmin && <p className="font-body text-xs text-foreground-muted">Only admins can change this.</p>}
        {error && <p className="font-body text-sm text-danger">{error}</p>}
        {saved && !error && <p className="font-body text-sm text-secondary-400">Saved.</p>}
        {isAdmin && (
          <AdminButton type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </AdminButton>
        )}
      </form>
    </AdminCard>
  );
}
