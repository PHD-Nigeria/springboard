"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSiteAssetsAction } from "@/lib/admin/taxonomy-actions";
import { AdminButton, AdminCard, AdminLabel } from "@/components/admin/ui";
import { MediaPicker } from "@/components/admin/MediaPicker";

type Slot = { mediaId: string | null; url: string | null };
type Selected = { id: string; url: string | null; alt_text: string | null } | null;

/**
 * Site Asset -> Media record -> Storage -> Site configuration reference
 * (§11) — every slot below is just a MediaPicker, the same component
 * ContentForm/AuthorForm/PublicationManager already use. No second media
 * system, no raw image binaries stored in the database, just a media id
 * reference per named slot.
 */
export function SiteAssetsForm({
  logoPhd,
  logoSpringboard,
  favicon,
  ogImage,
  homepageArtwork,
}: {
  logoPhd: Slot;
  logoSpringboard: Slot;
  favicon: Slot;
  ogImage: Slot;
  homepageArtwork: Slot;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const [phd, setPhd] = useState<Selected>(logoPhd.mediaId ? { id: logoPhd.mediaId, url: logoPhd.url, alt_text: "PHD logo" } : null);
  const [springboard, setSpringboard] = useState<Selected>(
    logoSpringboard.mediaId ? { id: logoSpringboard.mediaId, url: logoSpringboard.url, alt_text: "Springboard wordmark" } : null
  );
  const [fav, setFav] = useState<Selected>(favicon.mediaId ? { id: favicon.mediaId, url: favicon.url, alt_text: "Favicon" } : null);
  const [og, setOg] = useState<Selected>(
    ogImage.mediaId ? { id: ogImage.mediaId, url: ogImage.url, alt_text: "Default share image" } : null
  );
  const [artwork, setArtwork] = useState<Selected>(
    homepageArtwork.mediaId ? { id: homepageArtwork.mediaId, url: homepageArtwork.url, alt_text: "Homepage artwork" } : null
  );

  function submit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveSiteAssetsAction(formData);
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
      <form action={submit} className="space-y-6">
        <input type="hidden" name="logo_phd_media_id" value={phd?.id ?? ""} />
        <input type="hidden" name="logo_springboard_media_id" value={springboard?.id ?? ""} />
        <input type="hidden" name="favicon_media_id" value={fav?.id ?? ""} />
        <input type="hidden" name="og_image_media_id" value={og?.id ?? ""} />
        <input type="hidden" name="homepage_artwork_media_id" value={artwork?.id ?? ""} />

        <div>
          <AdminLabel>PHD logo</AdminLabel>
          <MediaPicker selected={phd} onSelect={(m) => setPhd({ id: m.id, url: m.url, alt_text: m.alt_text })} onClear={() => setPhd(null)} />
        </div>
        <div>
          <AdminLabel>Springboard logo / wordmark</AdminLabel>
          <MediaPicker
            selected={springboard}
            onSelect={(m) => setSpringboard({ id: m.id, url: m.url, alt_text: m.alt_text })}
            onClear={() => setSpringboard(null)}
          />
        </div>
        <div>
          <AdminLabel>Favicon</AdminLabel>
          <MediaPicker selected={fav} onSelect={(m) => setFav({ id: m.id, url: m.url, alt_text: m.alt_text })} onClear={() => setFav(null)} />
          <p className="mt-1.5 font-body text-xs text-foreground-muted">Must be promoted to public to take effect — the browser tab icon is a public request, not an authenticated one.</p>
        </div>
        <div>
          <AdminLabel>Default social share image</AdminLabel>
          <MediaPicker selected={og} onSelect={(m) => setOg({ id: m.id, url: m.url, alt_text: m.alt_text })} onClear={() => setOg(null)} />
          <p className="mt-1.5 font-body text-xs text-foreground-muted">Used when a page has no cover image of its own — home, search, a contributor with no portrait.</p>
        </div>
        <div>
          <AdminLabel>Approved homepage artwork</AdminLabel>
          <MediaPicker
            selected={artwork}
            onSelect={(m) => setArtwork({ id: m.id, url: m.url, alt_text: m.alt_text })}
            onClear={() => setArtwork(null)}
          />
          <p className="mt-1.5 font-body text-xs text-foreground-muted">
            Staged for future use — the homepage has no dedicated artwork placement yet. Reference is saved here so the file is ready the moment a placement decision is made, rather than re-uploading later.
          </p>
        </div>

        {error && <p className="font-body text-sm text-danger">{error}</p>}
        {saved && !error && <p className="font-body text-sm text-secondary-400">Saved.</p>}
        <AdminButton type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </AdminButton>
      </form>
    </AdminCard>
  );
}
