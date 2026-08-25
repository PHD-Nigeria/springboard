import Image from "next/image";
import Link from "next/link";
import type { Author } from "@/content-types/types";
import { MediaFallback, initialsFromName } from "@/components/editorial/MediaFallback";

/**
 * Author preview card for the homepage's People section. Operates on an
 * `Author` row (a proper content entity via authors.id / content.author_id),
 * not a content row — distinct from StaffProfile, which is the content-type
 * registry's Card for STAFF_SPOTLIGHT/BIRTHDAY content.
 */
export function ContributorCard({ author }: { author: Author }) {
  return (
    <Link href={`/contributors/${author.slug}`} className="group block text-center">
      <div className="relative mx-auto aspect-square w-32 overflow-hidden rounded-full bg-surface">
        {author.avatarUrl ? (
          <Image
            src={author.avatarUrl}
            alt={author.name}
            fill
            sizes="128px"
            className="object-cover transition-transform duration-base ease-out group-hover:scale-105"
          />
        ) : (
          <MediaFallback seed={author.id} initials={initialsFromName(author.name)} />
        )}
      </div>
      <p className="mt-4 font-display text-lg font-medium text-foreground transition-colors duration-fast group-hover:text-secondary-400">
        {author.name}
      </p>
      {author.title && <p className="mt-1 font-body text-sm text-foreground-muted">{author.title}</p>}
    </Link>
  );
}
