/**
 * What "publicly visible" means for an edition (a row in `publications`) — in ONE place, dependency-free and
 * written in erasable TypeScript only so scripts/test-edition-visibility.mjs can import it directly.
 *
 * Why this exists: row-level security already hides unpublished content from anonymous visitors, but it does not tie a
 * story's visibility to its EDITION's. A story that is `published` inside an edition that is still a `draft` (an embargoed
 * edition) is readable through the API, and `publications` is readable by every signed-in contributor, so "the edition
 * came back null" is not a reliable test either. Every public list therefore constrains the edition explicitly, using the
 * rule below, so no public surface depends on who is looking.
 *
 * The rule mirrors the public branch of the `publications_select` policy:
 *   published, or scheduled with a publish time that has passed.
 * Content with NO edition (evergreen) is unaffected by it and stays discoverable as before.
 */

export interface EditionVisibilityFields {
  status: string;
  publish_at: string | null;
}

export function isEditionPubliclyVisible(edition: EditionVisibilityFields, now: Date = new Date()): boolean {
  if (edition.status === "published") return true;
  if (edition.status === "scheduled" && edition.publish_at) {
    const when = new Date(edition.publish_at).getTime();
    return !Number.isNaN(when) && when <= now.getTime();
  }
  return false; // draft, archived, anything else, or a scheduled edition with no/invalid time
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A PostgREST `or` expression that keeps a content row only if it has no edition at all, or its edition is one of
 * `visibleEditionIds`. Ids are re-validated as UUIDs here so nothing but a UUID can ever be placed in the filter string.
 */
export function publicEditionOrFilter(visibleEditionIds: readonly string[]): string {
  const ids = visibleEditionIds.filter((id) => UUID.test(id));
  return ids.length > 0 ? `publication_id.is.null,publication_id.in.(${ids.join(",")})` : "publication_id.is.null";
}
