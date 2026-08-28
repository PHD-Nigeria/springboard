/**
 * Renders the guide's pre-converted HTML — a plain Server Component with
 * zero client JavaScript of its own. The click-to-enlarge behavior for
 * screenshots is handled by <GuideLightbox>, an ancestor client component
 * that wraps this one and every other chapter page as its `children` (see
 * the guide layout) — using React's own event delegation there, rather
 * than this component receiving the (possibly large) HTML string a second
 * time as a client-side prop, or wiring up its own per-page listener that
 * would need re-attaching on every chapter navigation.
 */
export function GuideArticle({ html }: { html: string }) {
  // The HTML here is server-rendered from Markdown committed to this repo
  // (docs/user-guide/) by renderGuideMarkdown — not user input at request
  // time — the same trust boundary as any other file already read into the
  // app at build/render time.
  return <article id="guide-article" className="guide-article" dangerouslySetInnerHTML={{ __html: html }} />;
}
