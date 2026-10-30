// End-to-end check that content is publicly DISCOVERABLE only when both the story and its edition are public.
//
// LOCAL ONLY. It creates clearly labelled fictional editions and stories in a throwaway local Supabase, looks at what an
// anonymous visitor can find through the running app, and removes everything it created. It refuses to run against
// anything that is not localhost / 127.0.0.1 — it must never be pointed at a hosted project.
//
//   npm run build && npm start        (or `npm run dev`) with the app's env pointing at the LOCAL Supabase, then:
//   APP_URL=http://localhost:3000 SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<local key> \
//     SUPABASE_ANON_KEY=<local anon key> npm run test:visibility:integration
//
// Surfaces checked: homepage videos, search, a category landing page, an article's "Related content" block, the sitemap.
// Only Node's built-in fetch is used — no test dependencies.

const APP = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SB = (process.env.SUPABASE_URL ?? "http://127.0.0.1:54321").replace(/\/$/, "");
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY;

const isLocal = (u) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(u).hostname);
if (!isLocal(APP) || !isLocal(SB)) {
  console.error(`Refusing to run: APP_URL (${APP}) and SUPABASE_URL (${SB}) must both be localhost / 127.0.0.1.`);
  process.exit(2);
}
if (!SERVICE) {
  console.error("SUPABASE_SERVICE_ROLE_KEY (the LOCAL stack's key) is required to create the fixtures.");
  process.exit(2);
}

const TOKEN = "qv" + Math.random().toString(16).slice(2, 7).padEnd(5, "0"); // 7 chars; used in titles, slugs and video ids
const HOUR = 3600 * 1000;
const iso = (offset) => new Date(Date.now() + offset).toISOString();

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

async function rest(method, path, body, headers = {}) {
  const res = await fetch(`${SB}/rest/v1/${path}`, {
    method,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}
const page = async (path) => (await fetch(`${APP}${path}`, { redirect: "manual" }));
const html = async (path) => (await page(path)).text();

// Editions (publications) and stories to create. `visible` is the expected answer for an anonymous visitor.
const EDITIONS = {
  published: { status: "published", published_at: iso(-HOUR) },
  draft: { status: "draft" },
  scheduledFuture: { status: "scheduled", publish_at: iso(24 * HOUR) },
  scheduledPast: { status: "scheduled", publish_at: iso(-HOUR) },
};
const STORIES = [
  { n: 1, label: "published story in a published edition", edition: "published", status: "published", visible: true },
  { n: 2, label: "published story in a DRAFT edition", edition: "draft", status: "published", visible: false },
  { n: 3, label: "draft story in a published edition", edition: "published", status: "draft", visible: false },
  { n: 4, label: "scheduled-for-later story in a published edition", edition: "published", status: "scheduled", publish_at: iso(24 * HOUR), visible: false },
  { n: 5, label: "scheduled-and-due story in a published edition", edition: "published", status: "scheduled", publish_at: iso(-HOUR), visible: true },
  { n: 6, label: "archived story in a published edition", edition: "published", status: "archived", visible: false },
  { n: 7, label: "published story with no edition (evergreen)", edition: null, status: "published", visible: true },
  { n: 8, label: "published story in a scheduled-for-later edition", edition: "scheduledFuture", status: "published", visible: false },
  { n: 9, label: "published story in a scheduled-and-due edition", edition: "scheduledPast", status: "published", visible: true },
];

const createdContent = [];
const createdEditions = [];

async function main() {
  const [category] = await rest("GET", "categories?slug=eq.company-news&select=id");
  const editionIds = {};
  for (const [key, fields] of Object.entries(EDITIONS)) {
    const [row] = await rest("POST", "publications", { slug: `${TOKEN}-${key.toLowerCase()}`, title: `${TOKEN} edition ${key}`, ...fields });
    editionIds[key] = row.id;
    createdEditions.push(row.id);
  }
  const bySlug = {};
  for (const s of STORIES) {
    const slug = `${TOKEN}-${s.n}`;
    const videoId = `VIS${TOKEN}${s.n}`; // 3 + 7 + 1 = 11 characters
    const published = s.status === "published" || (s.status === "scheduled" && new Date(s.publish_at) < new Date());
    const [row] = await rest("POST", "content", {
      content_type: "COMPANY_NEWS",
      slug,
      title: `${TOKEN} case ${s.n} ${s.label}`,
      summary: `${TOKEN} fictional visibility fixture`,
      category_id: category?.id ?? null,
      publication_id: s.edition ? editionIds[s.edition] : null,
      status: s.status,
      publish_at: s.publish_at ?? null,
      published_at: published ? iso(-s.n * 1000) : null,
      body: { version: 1, blocks: [{ type: "paragraph", text: `${TOKEN} fixture body` }, { type: "video", provider: "youtube", videoId, title: `${TOKEN} video ${s.n}`, orientation: "landscape" }] },
    });
    createdContent.push(row.id);
    bySlug[s.n] = { ...s, id: row.id, slug, videoId, title: row.title };
  }
  // A host article (published, in a published edition) whose "Related content" block points at every fixture.
  const [host] = await rest("POST", "content", {
    content_type: "ARTICLE", slug: `${TOKEN}-host`, title: `${TOKEN} host article`, publication_id: editionIds.published, status: "published", published_at: iso(-HOUR),
    body: { version: 1, blocks: [{ type: "paragraph", text: "host" }, { type: "related-content", contentIds: STORIES.map((s) => bySlug[s.n].id) }] },
  });
  createdContent.push(host.id);

  const all = Object.values(bySlug);
  const visibleOnes = all.filter((s) => s.visible);
  const hiddenOnes = all.filter((s) => !s.visible);

  // ---- control: the leak is REAL at the database level, so the app-level filter is what is being tested
  if (ANON) {
    const res = await fetch(`${SB}/rest/v1/content?slug=eq.${bySlug[2].slug}&select=id`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
    const rows = await res.json();
    check("control: the anonymous API itself DOES return a published story from a draft edition (so only the app filter protects it)", Array.isArray(rows) && rows.length === 1);
  } else console.log("SKIP  control (set SUPABASE_ANON_KEY to include it)");

  // ---- homepage videos
  const home = await html("/");
  for (const s of visibleOnes) check(`home: ${s.label} → its video is offered`, home.includes(s.videoId));
  for (const s of hiddenOnes) check(`home: ${s.label} → NOT offered (no video id, no title)`, !home.includes(s.videoId) && !home.includes(s.title));

  // ---- search
  const search = await html(`/search?q=${TOKEN}`);
  for (const s of visibleOnes) check(`search: ${s.label} → listed`, search.includes(s.title));
  for (const s of hiddenOnes) check(`search: ${s.label} → NOT listed`, !search.includes(s.title));

  // ---- category landing page
  const landing = await html("/company-news");
  const shown = visibleOnes.filter((s) => landing.includes(s.title)).length;
  check("category page: at least one visible fixture is listed (so the page is really reading these rows)", shown > 0, `${shown}/${visibleOnes.length} listed`);
  for (const s of hiddenOnes) check(`category page: ${s.label} → NOT listed`, !landing.includes(s.title));

  // ---- an article's Related content block
  const related = await html(`/issues/${TOKEN}-published/${TOKEN}-host`);
  check("related-content: the host article renders", related.includes(`${TOKEN} host article`));
  for (const s of visibleOnes) check(`related-content: ${s.label} → listed`, related.includes(s.title));
  for (const s of hiddenOnes) check(`related-content: ${s.label} → NOT listed`, !related.includes(s.title));

  // ---- the stories' own pages
  for (const s of all.filter((x) => x.edition)) {
    const edSlug = `${TOKEN}-${s.edition.toLowerCase()}`;
    const status = (await page(`/issues/${edSlug}/${s.slug}`)).status;
    check(`own page: ${s.label} → ${s.visible ? "served (200)" : "not served (404)"}`, s.visible ? status === 200 : status === 404, `status ${status}`);
  }

  // ---- sitemap (only meaningful when the app has NEXT_PUBLIC_SITE_URL set)
  const sitemap = await html("/sitemap.xml");
  if (sitemap.includes("<url>") && sitemap.includes("/search")) {
    for (const s of all.filter((x) => x.edition)) {
      const present = sitemap.includes(`/${s.slug}`);
      check(`sitemap: ${s.label} → ${s.visible ? "listed" : "NOT listed"}`, s.visible ? present : !present);
    }
  } else console.log("SKIP  sitemap (start the app with NEXT_PUBLIC_SITE_URL set to include it)");
}

async function cleanup() {
  for (const id of createdContent) await rest("DELETE", `content?id=eq.${id}`).catch(() => {});
  for (const id of createdEditions) await rest("DELETE", `publications?id=eq.${id}`).catch(() => {});
}

try {
  await main();
} catch (error) {
  check("test run completed without an error", false, String(error.message ?? error));
} finally {
  await cleanup();
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed${failed ? ` — ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
