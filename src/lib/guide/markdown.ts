import { Marked, type RendererObject } from "marked";

/**
 * Renders the guide's own Markdown to HTML — the Markdown files under
 * docs/user-guide/ are the only content source (see that directory's
 * README); this module never holds or duplicates any of their wording,
 * only the three small rewrites needed to make relative references work
 * inside the app:
 *
 *  - a heading gets a GitHub-style `id` (docs/user-guide/README.md already
 *    links to one chapter's heading by anchor, e.g.
 *    `10-user-management.md#1-what-is-a-user-and-what-is-a-role` — this is
 *    what makes that anchor actually resolve once rendered in-app),
 *  - a relative link to another chapter file (`02-navigation.md`,
 *    optionally with a `#anchor`) is rewritten to that chapter's real
 *    in-app route, and a link to `README.md` to the guide's index route,
 *  - a relative image path (`images/foo.png`) is rewritten to the
 *    authenticated route that serves it (see
 *    src/app/admin/(protected)/guide/images/[...path]/route.ts).
 *
 * A link that isn't one of the two patterns above (e.g. README.md's two
 * links out to ../development-workflow.md and ../team-workflow.md, which
 * aren't part of this in-app guide) is left exactly as written — plain
 * text is never altered.
 */

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * GitHub's heading-slug algorithm (lowercase, strip punctuation, spaces to
 * hyphens) — close enough to match the one anchor link the guide's own
 * README relies on today. Not deduplicated against sibling headings on the
 * same page (GitHub's own algorithm appends `-1`, `-2`, ... for repeats);
 * every chapter's headings are unique per page, so this hasn't been needed.
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

const CHAPTER_LINK_RE = /^(\d{2}-[a-z0-9-]+)\.md(#.*)?$/i;

function rewriteHref(href: string): string {
  if (href === "README.md") return "/admin/guide";
  const match = href.match(CHAPTER_LINK_RE);
  if (!match) return href;
  const [, slug, hash = ""] = match;
  return `/admin/guide/${slug}${hash}`;
}

const IMAGE_RE = /^images\/([A-Za-z0-9_.-]+)$/;

function rewriteImageSrc(src: string): string {
  const match = src.match(IMAGE_RE);
  return match ? `/admin/guide/images/${match[1]}` : src;
}

const renderer: RendererObject = {
  heading({ tokens, depth, text }) {
    const id = slugifyHeading(text);
    return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
  },
  image({ href, title, text }) {
    const src = rewriteImageSrc(href);
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    // width/height are deliberately omitted — these are full-page screenshots
    // of very different aspect ratios (a short form vs. a 12,000px-tall
    // publication page); a fixed intrinsic size would either distort short
    // ones or force a giant reserved blank box for tall ones. CSS
    // (.guide-article img) makes them responsive instead — see guide.css.
    return `<img src="${src}" alt="${escapeHtml(text)}"${titleAttr} loading="lazy" class="guide-image" />`;
  },
  link({ href, title, tokens }) {
    const resolvedHref = rewriteHref(href);
    const isExternal = /^https?:\/\//i.test(href);
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    const externalAttrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${resolvedHref}"${titleAttr}${externalAttrs}>${this.parser.parseInline(tokens)}</a>`;
  },
};

// A dedicated instance (rather than the module-wide `marked` singleton) so
// these overrides can never leak into some unrelated future use of the
// `marked` package elsewhere in the app. GFM (tables, the permission
// matrices every chapter uses) is on by default — nothing to enable.
const guideMarked = new Marked({ renderer });

export function renderGuideMarkdown(markdown: string): string {
  const html = guideMarked.parse(markdown, { async: false });
  // Every chapter's permission matrix is a Markdown table — wrapped here
  // (rather than overriding the renderer's table method and reimplementing
  // its cell/alignment logic) so a wide one scrolls horizontally on a
  // narrow screen instead of ever overflowing the page. See .guide-table-scroll
  // in guide.css.
  return html.replaceAll("<table>", '<div class="guide-table-scroll"><table>').replaceAll("</table>", "</table></div>");
}
