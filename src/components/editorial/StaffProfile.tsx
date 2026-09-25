import Image from "next/image";
import Link from "next/link";
import type { Content } from "@/content-types/types";
import { getSpotlightDetail, getContentStaff, type PublicStaff } from "@/lib/content/queries";
import { MediaFallback, initialsFromName } from "@/components/editorial/MediaFallback";

/**
 * Card for STAFF_SPOTLIGHT and BIRTHDAY content, the registry's Card for
 * both (see content-types/registry.ts). Async because the person's actual
 * name/title lives in the `staff` table (via staff_spotlights or
 * content_staff, resolved by content.id), not in the content row itself:
 * a spotlight's own title is its headline ("Our Newest Addition to the
 * Team"), not the person's name, so ArticleCard's generic title/summary
 * rendering can't stand in for this. content.coverImageUrl is still used
 * directly for the photo (set to the staff member's own photo at creation
 * time) rather than re-resolved here, since that part's already correct on
 * the content row.
 */
export async function StaffProfile({
  content,
  resolvedStaff,
}: {
  content: Content;
  /**
   * Skips this component's own DB call when a caller already resolved the
   * staff record itself, e.g. CategoryLanding batch-fetching every BIRTHDAY
   * on /staff-news in one query instead of the 17 separate content_staff
   * round trips one-per-StaffProfile used to cost. `undefined` (the
   * default, every other caller) keeps the original self-fetching
   * behavior; pass `null` explicitly for "resolved, and there's no staff".
   */
  resolvedStaff?: PublicStaff | null;
}) {
  const staff =
    resolvedStaff !== undefined
      ? resolvedStaff
      : content.contentType === "STAFF_SPOTLIGHT"
        ? (await getSpotlightDetail(content.id))?.staff
        : (await getContentStaff(content.id))[0];

  const name = staff?.fullName ?? content.title;
  const subtitle = content.contentType === "BIRTHDAY" ? content.summary : staff?.title;
  const eyebrow = content.contentType === "STAFF_SPOTLIGHT" ? "Staff Spotlight" : "Staff News";
  const photoUrl = staff?.photoUrl ?? content.coverImageUrl;

  return (
    <Link href={content.href ?? "#"} className="group block text-center">
      <div className="relative mx-auto mb-4 aspect-square w-32 overflow-hidden rounded-full bg-surface">
        {photoUrl ? (
          <Image src={photoUrl} alt={name} fill sizes="128px" className="object-cover" />
        ) : (
          <MediaFallback seed={content.id} initials={initialsFromName(name)} className="rounded-full" />
        )}
      </div>
      <p className="mb-1 font-body text-xs font-medium tracking-wide text-foreground-muted uppercase">{eyebrow}</p>
      <h3 className="font-display text-lg font-medium text-foreground transition-colors duration-fast group-hover:text-secondary-400">
        {name}
      </h3>
      {subtitle && <p className="mt-1 font-body text-sm text-foreground-muted">{subtitle}</p>}
    </Link>
  );
}
