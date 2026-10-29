# Springboard Reconstruction — Stage 1: Discovery, Assessment & Design Direction

Prepared 29 October 2026 on branch `feature/redesign-reconstruction`.
**Status: for review. No implementation has started.** Nothing in this stage
was merged, deployed, migrated, or written to any hosted database.

Each finding is marked:

- **[Verified]**: confirmed by reading the code or by running a command in this stage.
- **[Observed]**: seen on the live production site through a read-only, text-only page fetch (no screenshots were possible from this environment).
- **[Assumption]**: an inference, usually about what the client wants. It needs confirming before we design against it.

---

## 0. Baseline, environment and what was run

### 0.1 Branch baseline [Verified]

| Ref | Commit | Date | Notes |
|---|---|---|---|
| `main` | `33515f6` | 2026-09-25 | "fix(performance): optimize navigation and editorial image rendering". Presumed to be what production runs (not verifiable from here: no Vercel access). |
| `origin/feat/youtube-video-blocks-and-media-batch-import` | `e58550e` | 2026-10-29 | 2 commits ahead of `main`, unmerged. Adds YouTube video blocks (landscape + portrait/Shorts), private-media previews in admin, and a *temporary* admin-only batch image importer. |
| **`feature/redesign-reconstruction`** | branched from `e58550e` | 2026-10-29 | This branch. Upstream tracking was removed so it can never push onto the feature branch by accident. |

**Why it was cut from the feature branch, not `main`.** The brief requires
proper treatment of YouTube videos and portrait media. That block shape
(`provider`, `videoId`, `title`, `orientation`, `thumbnailMediaId`) only
exists on the feature branch. Building the new templates on `main` would
mean designing against a video model that is about to change. **If the
feature branch is changed or dropped in review, this branch must be rebased
onto whatever lands in `main`.** That is the first client/owner decision in §6.

### 0.2 Checks run in this stage

| Check | `main` | Feature/this branch | Notes |
|---|---|---|---|
| `npm ci` | ✅ | ✅ | |
| `npm run lint` | ✅ 0 problems | ✅ 0 problems | |
| `npm run typecheck` on a clean checkout | ❌ 2 errors | ❌ (same) | `LayoutProps` / `RouteContext` are undefined until Next generates route types. |
| `npx next typegen` then `npm run typecheck` | ✅ | ✅ | **CI must run `next typegen` (or `next build`) before `tsc`.** Otherwise a fresh CI checkout fails. |
| `npm run build` | ⚠️ see note | ⚠️ see note | Fails in this sandbox only because `fonts.googleapis.com` is blocked here (`next/font/google` fetches Syne at build time). |
| `next build` with Syne swapped to an identical local `.woff2` (throwaway copy outside the repo, not committed) | ✅ 50 routes | ✅ 51 routes | Shows the code compiles. The committed code was not modified. |
| `npm run test:youtube` (feature branch only) | n/a | ✅ 9/9 pass | The **only** automated test in the repository. |
| Playwright / RLS / end-to-end | ❌ not run | ❌ not run | The repo contains **no Playwright suite**. The "80" and "108" Playwright checks cited in `docs/architecture.md` and the Phase 4E report were never committed. A local Supabase stack could not be started here because the container registries are blocked, so no runtime, RLS or editorial-workflow test was run in this stage. |

### 0.3 Environment isolation [Verified and Unverified]

- **[Verified]** Nothing in the code tells Preview apart from Production
  (`VERCEL_ENV` is never read). Whichever Supabase project Vercel's
  **Preview** environment variables point at is what a preview deployment
  reads from and writes to.
- **[Verified]** `docs/development-workflow.md` says a staging Supabase
  project "does not exist yet".
- **[Unverified]** Whether Vercel's Preview scope currently points at
  production Supabase. This needs someone with access to the Vercel project.
  **Until that is checked, every preview deployment must be treated as
  connected to production data.** On preview, only read-only browsing is
  allowed: no log-ins that change anything, no uploads, no saves.
- **[Verified]** `docs/architecture.md` §8 still says "Not yet deployed / no
  hosted Supabase project". The live site at `springboard.phdnigeria.com`
  shows that is out of date. Other stale statements in the same file: the
  nav is described as code-managed (it is CMS-managed since `8b7372f`); the
  service-role key is said to be used only by the publish cron (it is also
  used by `/api/cron/cleanup-orphaned-media`); and there are 29 migrations,
  not 14 or 24.
- **[Verified]** No secrets were found in git history. Only `.env.local.example` is committed.

---

## 1. Current-state technical and design assessment

### 1.1 Stack [Verified]

Next.js 16.3 (App Router, Turbopack, `src/proxy.ts` session refresh) · React
19.2 · TypeScript · Tailwind CSS v4 (CSS-first `@theme` tokens) · Framer
Motion 13 · Supabase (Postgres + RLS, Auth, Storage) via `@supabase/ssr` ·
zod 4 · `marked` (admin user guide only). Vercel Cron declares two daily jobs
(`vercel.json`). About 14,700 lines in `src/` (excluding the generated
`types.ts`). There are 29 SQL migrations.

### 1.2 Architecture strengths to preserve

1. **Content-type registry** (`src/content-types/registry.ts`). Each of the 8
   content types maps to `{Template, Card, metadataSchema}`. A redesign can
   swap templates without touching routing or queries. **This is the main
   seam for the reconstruction.**
2. **Versioned JSON block body** (`content.body = {version, blocks[]}`),
   validated with zod on both write and read. `BlockRenderer` dispatches to
   nine block components. Presentation can change completely without touching
   the data.
3. **Security lives in the database, not the UI.** RLS on every table, three
   `SECURITY DEFINER` role helpers, trigger guards
   (`prevent_role_self_escalation`, `prevent_media_bucket_change`), and
   admin mutations run through the cookie-scoped, RLS-subject client. A
   frontend rewrite cannot weaken permissions **as long as no new mutation
   uses `src/lib/supabase/admin.ts`**.
4. **Media lifecycle**: private-by-default uploads, admin-only promotion with
   copy-then-flip, replace-in-place keeping the same id, usage-checked
   deletion.
5. **Editorial governance**: draft → review → scheduled → published →
   archived; revisions (ARTICLE / COMPANY_NEWS only); best-effort audit log;
   last-admin protection.
6. **Design tokens in one file** (`src/design-system/tokens/theme.css`),
   consumed as Tailwind utilities. A visual identity change is mostly a token
   change plus a component restyle.

### 1.3 Current design patterns and their limitations [Verified in code]

| Pattern | Where | Limitation |
|---|---|---|
| **The canvas is effectively pure black.** `--color-background` = purple mixed 4% into black, which resolves to `rgb(0,0,0)`. Surfaces resolve to `rgb(0,0,1)` and `rgb(2,0,15)`. | `theme.css` | The PHD Purple identity is not visible except in the header and footer (`primary-900` ≈ `rgb(9,0,35)`, also near-black). The site reads as a generic dark template, not as PHD. |
| **Syne for everything**, including 18px long-form body copy. | `layout.tsx`, `theme.css` | Syne is a wide, quirky display face. It is hard to read for long articles and at small UI sizes (uppercase 12px labels). The code comment says this follows "the authoritative brand spec", so changing it is a **client/brand decision** (§6). |
| **One section idiom repeated**: small muted uppercase label, hairline rule, then a 3-column grid. | `page.tsx`, `CategoryLanding`, `ArticleTemplate`, contributor page, search | No rhythm or hierarchy between sections. Every page looks the same. Pillars (People & Culture vs Company & Business vs Engagement) have no visual identity of their own. |
| **Hero image boxed at 16:9 with `object-contain`.** | `Hero.tsx`, `FeaturedStory.tsx` (16:10) | Portrait photos are letterboxed in a black box instead of laid out as portraits. Root cause: **image width and height are never recorded at upload** (`media-actions.ts` writes `null`), so layouts cannot adapt to orientation. |
| Cards use `object-cover` at 4:3. Gallery uses a masonry column layout with hard-coded `1200×900` intrinsic size. | `ArticleCard`, `Gallery.tsx` | Portrait crops on cards are uncontrolled (there is no focal point). There is no gallery lightbox or captions-on-demand. "Photos of the Quarter" (a photo-led pillar) renders through the same article grid as everything else. |
| Lead content chosen by recency | homepage, category pages | On production the homepage lead is a *birthday notice* (§1.5). Content types with no natural "lead story" weight compete for the hero. |
| Nav group headings do not navigate (`href = ''`) | `Navigation.tsx` | Pillars have no landing pages. The desktop dropdown opens on hover and click, which is fine, but there is no Escape-to-close and no arrow-key handling. |
| Footer links are hard-coded `/#more-stories`, `/#people`, `/#news-bites` anchors | `Footer.tsx` | They do not match the CMS-managed nav IA. There are no About, Contact or Issues-archive links. |
| Developer copy shown to the public in empty states ("this page is fully data-driven and will populate automatically once Supabase has published content") | `page.tsx`, `CategoryLanding.tsx` | Unprofessional if a category is ever empty. |
| No `not-found.tsx`, `error.tsx` or `loading.tsx` anywhere | `src/app` | Visitors see unbranded Next.js 404 and 500 pages and no loading states. |
| `/staff/[staffSlug]` renders an unstyled `<h1>` and `<p>`, with no metadata | `src/app/staff/[staffSlug]/page.tsx` | Unfinished page that is publicly reachable. |
| `EVENT` metadata (date, location, RSVP) and `HEALTH_TIP` source are captured in admin but **never rendered** | `NewsTemplate`, `ArticleTemplate` | Captured data is silently invisible. |
| Evergreen content (`publication_id is null`) gets `href = undefined`, so cards link to `#` | `queries.ts:86` | `getEvergreenContentBySlug` exists, but no route uses it. Evergreen items are unreachable. |
| Category landing shows up to 30 items with no pagination | `CategoryLanding.tsx` | This will break down after a few quarterly issues. |
| No issues index (`/issues`) and no contributors index (`/contributors`) | `src/app` | There is no way to browse past issues. That is a core need for a quarterly publication. |

### 1.4 Accessibility [Verified unless noted]

Contrast was computed from the resolved token values (Chromium-resolved
`color-mix`, WCAG 2.x formula):

| Pair | Ratio | Result |
|---|---|---|
| foreground on background | 19.8 : 1 | ✅ |
| foreground-muted on background | 12.1 : 1 | ✅ |
| lime / coral / lavender / pink on background | 14.3 / 8.0 / 7.1 / 8.9 | ✅ |
| `primary-400` on background. Used as **text** (EditorialBanner eyebrow, 12px), as the global focus ring, and as blockquote rules | 3.37 : 1 | ❌ as small text (needs 4.5). ⚠️ focus ring only just passes 3:1. |
| `danger` on background (admin errors, delete buttons) | 4.44 : 1 | ❌ small text |
| `border` / `border-strong` on background. These are the **only** outline of admin form fields and of the search field | 1.26 / 1.74 : 1 | ❌ WCAG 1.4.11 (non-text contrast needs 3:1) |
| PHD Purple `#3A008C` on the current black | 1.56 : 1 | ❌. Purple can never be text or a meaningful UI edge on this canvas. |

Other issues:

- Card images use `alt={content.title}` inside a link that already contains
  the title, so screen readers hear the title twice. These should be `alt=""`.
  The same applies to the Hero image on article pages.
- The search field removes its focus outline and signals focus only by
  changing a 12%-alpha border to lime. It is visible, but it relies on colour
  change alone.
- The desktop nav dropdown has no Escape-to-close and no focus return. The
  mobile menu button reads "Menu"/"Close" (fine), but focus is not moved
  into the opened menu.
- Every heading is Syne at weight 500. Hierarchy relies on size alone.
- No skip link on the public site.
- **[Not tested]** Screen-reader pass, zoom/reflow at 400%, and keyboard pass
  on the admin block editor. These belong in Stage 7 of the plan.

### 1.5 What production currently shows [Observed: text-only fetch of `/`, `/company-news` and one article]

- Nav: People & Culture (HR Corner, Staff Spotlight, Staff News,
  Healthline) · Company & Business (Company News, Articles) · Engagement &
  Community (Photos of the Quarter, Games) · Search. **Company News is
  configured to open in a new tab.** That looks like a CMS setting mistake
  (it is an internal link).
- The homepage lead story is a birthday notice ("Remilekun Dosumu"). Most of
  the homepage is Staff News birthday items. Real content is one quarterly
  issue, `springboard-q2-26`, dated 25 Sept 2026.
- Dates render inconsistently ("May 25 Sept 2026", and bare months such as
  "April" or "May"). Birthday summaries appear to be concatenated with the
  publish date.
- In the sampled article ("VST 2026: Aligning for the Future"), three images
  are stacked with no captions, there is no byline and no subtitle, and the
  body is three paragraphs. Real content is photo-heavy and text-light. The
  design must lead with images and stay graceful when bylines, subtitles and
  captions are missing.
- One contributor's slug is `games` (`/contributors/games`). It does not
  collide technically, but it is confusing and worth tidying in the CMS.
- **[Assumption]** The client's dissatisfaction is most likely driven by: the
  black, low-energy canvas; one repeated layout; Syne body copy; birthdays
  dominating the homepage; and letterboxed or uncaptioned photos. **This has
  not been confirmed with the client** (§6, Q1).

### 1.6 Technical debt and risks

| # | Item | Severity | Notes |
|---|---|---|---|
| T1 | No automated UI, RLS or workflow tests in the repo. Only `test:youtube`. | High | The redesign touches every template. Without a committed suite, regressions in permissions-aware UI (e.g. buttons per role) cannot be detected. Stage 0 builds this. |
| T2 | Clean-checkout `typecheck` fails until `next typegen` runs | Medium | Fix the CI order or add a `pretypecheck` script. |
| T3 | `next/font/google` is fetched at build time | Low | Builds need Google Fonts reachable. Self-hosting through `next/font/local` removes that dependency. Worth doing in the redesign. |
| T4 | Media `width`/`height` are always null | High (for design) | This blocks orientation-aware layouts. Fix: read `naturalWidth`/`naturalHeight` in the browser before upload and send them in `completeMediaUploadAction`. Additive, no migration (the columns exist), plus a one-off backfill script for existing rows run **only after approval**. |
| T5 | No focal point for crops | Medium | An optional `focal_x`/`focal_y` would need a migration. Propose it as optional, needing approval, and avoid it if `object-position` presets are enough. |
| T6 | Preview/Production DB isolation unverified | **Critical for testing** | §0.3. Blocks every write test on Vercel Preview. |
| T7 | `images.dangerouslyAllowLocalIP: true` ships to production | Low | Needed only for local dev. Gate it with `NODE_ENV !== 'production'`. |
| T8 | Temporary batch importer route (`/admin/media/batch-import`) is documented as "delete after the initial import" | Low | Keep it out of the redesigned admin nav. Track its removal separately. |
| T9 | Audit log is best-effort, not transactional | Accepted | Already known. Unchanged by the redesign. |
| T10 | Review status has no queue, reviewer, notes or notifications | Medium | A UI-only review queue (filter `status=review`) needs no schema change. Comments or notifications would. |
| T11 | No slug redirects | Medium | **Reconstruction must keep every existing public URL**: `/issues/{pub}/{slug}`, `/contributors/{slug}`, the 8 category routes, `/search`. |
| T12 | Vercel Hobby plan: crons run daily only | Accepted | Visibility of scheduled content is correct without the cron (RLS). Only admin badges lag. |
| T13 | Docs drift (§0.3) | Low | Update `docs/architecture.md` when the redesign lands. |
| T14 | The 27 user-guide screenshots will all go stale with an admin redesign | Medium | Budget a recapture pass (Stage 7). |

### 1.7 Risks specific to reconstructing the frontend

1. **Silently breaking editorial capability.** Every admin button is tied to
   an `intent` value in `content-actions.ts`. A restyle that drops or renames
   an intent removes a workflow. *Mitigation:* the inventory in §2.4 becomes a
   checklist, and Playwright covers every intent per role.
2. **Introducing a service-role shortcut** to "simplify" a new admin
   screen. *Mitigation:* add a lint rule or test that fails if anything
   other than the two cron routes imports `lib/supabase/admin`.
3. **Breaking public URLs.** *Mitigation:* a route-preservation test listing
   every current public URL pattern.
4. **Testing against production data by accident** (T6).
5. **Brand overreach:** inventing logos, colours or photography the client
   has not approved. *Mitigation:* §6. The design directions in §4 use only
   the five supplied hexes and Syne, plus explicitly-flagged *proposals*.
6. **Merge drift.** Because the redesign is long-running, rebase weekly on
   `main` so hotfixes made on production are not lost.

---

## 2. Page and feature inventory [Verified]

### 2.1 Public routes (15 pages, plus robots, sitemap and 3 API routes)

| Route | Renders | Template / components | Notes |
|---|---|---|---|
| `/` | Home | `FeaturedStory`, `NewsCard`, `EditorialBanner`, `ContributorCard` | Featured pick, banner copy and featured contributors are CMS-configurable (`site_settings`) |
| `/issues/[publicationSlug]` | Issue (publication) | `Hero`, `EditorialSection` per section | |
| `/issues/[publicationSlug]/[contentSlug]` | Any content item | Registry `Template` | Canonical content URL |
| `/company-news` `/articles` `/hr-corner` `/staff-spotlight` `/staff-news` `/healthline` `/photos-of-the-quarter` `/games` | Category landing (8) | `CategoryLanding` | Birthday and Spotlight categories use a people grid |
| `/contributors/[authorSlug]` | Contributor profile | `ContributorImageReveal`, `ArticleCard` | |
| `/staff/[staffSlug]` | Staff page | none (unstyled stub) | |
| `/search` | Full-text search | `Search`, `ArticleCard` | `noindex` when a query is present |
| `/robots.txt`, `/sitemap.xml` | SEO | | Disallows `/admin` and `/api` |
| `/dev/block-fixture` | Dev fixture | | 404 outside development |
| `/api/cron/publish-scheduled`, `/api/cron/cleanup-orphaned-media` | Cron (bearer `CRON_SECRET`, service role) | | Do not change |
| `/api/revalidate` | Inert 501 stub | | |

**Missing, proposed:** `/issues` (archive), `/contributors` (index),
pillar landings, branded 404 and error pages, a real staff profile.

### 2.2 Admin routes (26 pages + 1 temporary)

Login, reset password · Dashboard · Content list / new / new birthday / new
spotlight / edit / preview · Media (+ temporary batch-import on feature branch) ·
Contributors list / new / edit · Staff list / new / edit · Categories ·
Sections · Publications · Navigation · Activity · Users · Settings ·
Settings → Site Assets · User Guide index / chapter / image route.

### 2.3 Content types and templates

| Type | Template | Card | Type-specific data | Rendered publicly? |
|---|---|---|---|---|
| ARTICLE | ArticleTemplate | ArticleCard | none | ✅ (+ revisions) |
| EDITOR_NOTE | ArticleTemplate | ArticleCard | none | ✅ |
| HEALTH_TIP | ArticleTemplate | ArticleCard | `source`, `sourceUrl` | ⚠️ metadata not shown |
| COMPANY_NEWS | NewsTemplate | NewsCard | `announcementType` | ✅ (+ revisions) |
| EVENT | NewsTemplate | NewsCard | `eventDate`, `eventEndDate`, `location`, `rsvpUrl` | ⚠️ metadata not shown |
| GALLERY | NewsTemplate | NewsCard | none (images through gallery blocks) | ✅ but not photo-led |
| STAFF_SPOTLIGHT | SpotlightTemplate (Q&A from `spotlight_questions`) | StaffProfile | staff link | ✅ |
| BIRTHDAY | ArticleTemplate (fallback) | StaffProfile | `content_staff` link | ✅ grid; detail page generic |

### 2.4 Block types (9) and their current rendering

paragraph (`<p>`), heading h2–h4, image (+alt, caption), gallery (ordered
`mediaIds`, masonry, no lightbox), quote (+attribution, bare `<cite>`),
statistic (value / label / description), video (feature branch:
YouTube facade with `youtube-nocookie` iframe, landscape 16:9 or portrait
9:16, editor-chosen thumbnail, "Watch on YouTube" fallback; legacy public
`mediaId` gives a native `<video>`), callout (info / warning / success),
related-content (bare `<ul>` of links).

### 2.5 Editorial capabilities to preserve (checklist for every stage)

**Content intents** (`ContentForm` → `saveContentAction` /
`setContentStatusAction`): `save-draft`, `publish`, `submit-for-review`,
`schedule`, `cancel-schedule`, `unpublish`, `archive`, `back-to-draft`
(restore), preview from every state, revision list and restore.

**Permissions** (enforced by RLS, mirrored in UI):

| Capability | Contributor | Editor | Admin |
|---|---|---|---|
| Create / edit own draft or review | ✅ | ✅ | ✅ |
| Edit others' content; publish / schedule / unpublish / archive / restore | — | ✅ | ✅ |
| Submit for review | ✅ (own) | ✅ | ✅ |
| Hard delete content | — | — | ✅ |
| Upload media (lands private), edit alt/caption, replace | ✅ | ✅ | ✅ |
| Promote media to public; delete media | — | — | ✅ |
| Contributors, staff, categories, sections, publications, navigation | — | ✅ | ✅ |
| Activity log | — | ✅ (except USER/SETTINGS events) | ✅ |
| Users and roles (last-admin protected), settings, site assets, batch import | — | — | ✅ |

### 2.6 Reusable components (public)

Layout: `Navigation`, `Footer` · Editorial: `Hero`, `FeaturedStory`,
`ArticleCard`, `NewsCard`, `EditorialSection`, `EditorialBanner`,
`CategoryLanding`, `ContributorCard`, `StaffProfile`, `BirthdayGrid`
(unused), `Gallery`, `MediaFallback` · Motion: `PageTransition`,
`ScrollReveal`, `ContributorImageReveal` · Templates: `ArticleTemplate`,
`NewsTemplate`, `SpotlightTemplate` · Blocks: 9 + `YouTubeEmbed` · `Search`.

Admin (25 component files): `ui.tsx` primitives (Label, Input, Textarea, Select,
Button ×4 variants, Card, PageHeader, StatusBadge), `AdminNav`,
`ContentForm`, `BlockEditor`, `VideoBlockFields`, `MediaLibrary`,
`MediaPicker`, `MediaBatchImport`, `RevisionPanel`, `ContentRowActions`,
`SafeDeleteButton`, `ActivityTable`, managers (Category, Section,
Publication, Navigation, User), forms (Author, Staff, Spotlight, Birthday,
Settings, HomepageConfig, SiteAssets), and guide components.

### 2.7 Backend dependencies and integrations

Supabase Postgres (17 tables, including `nav_items`, `site_settings`,
`audit_log`, `content_revisions`), RLS policies and `SECURITY DEFINER`
functions (`list_profiles_with_email`, `list_actor_profiles`,
`extract_block_text`), Storage buckets `media-public` / `media-private`
(25 MiB; jpeg / png / webp / mp4 / webm; no SVG), Supabase Auth
(email/password, password recovery; redirect allow-list must include
`/admin/reset-password`), Vercel (hosting, image optimisation, 2 daily
crons), YouTube (oEmbed check, privacy-enhanced embed, feature branch),
Google Fonts (build time). **No analytics, no email or notification
provider, no CDN beyond Vercel.**

---

## 3. Proposed information architecture

Principles: **issue-led** (Springboard is a quarterly staff publication,
and every live item belongs to an issue); **three pillars** that already
exist in the CMS nav; keep every existing URL.

```
Springboard
├── Home ─ current issue cover · pillar highlights · people · celebrations
├── Issues  (/issues — NEW archive)
│   └── Issue (/issues/{issue}) ─ cover, editor's note, sections as chapters
│        └── Story (/issues/{issue}/{slug}) ─ unchanged URL
├── People & Culture   (pillar landing — NEW, nav heading becomes a link)
│   ├── Staff Spotlight   /staff-spotlight
│   ├── Staff News & Celebrations   /staff-news   (birthdays live here, not on the homepage lead)
│   ├── HR Corner   /hr-corner
│   └── Healthline   /healthline
├── Company & Business  (pillar landing — NEW)
│   ├── Company News   /company-news
│   └── Articles   /articles
├── Engagement & Community  (pillar landing — NEW)
│   ├── Photos of the Quarter   /photos-of-the-quarter   (gallery-led layout)
│   └── Games   /games
├── Contributors  (/contributors — NEW index) → /contributors/{slug}
└── Search  /search
```

Pillar landing URLs (e.g. `/people-and-culture`) are **new** routes. The
nav group headings would need an `href` set in `/admin/navigation`, which is
a CMS data change the client's admin makes, not a migration.

**Homepage content rules (proposal, needs approval):** the lead is the
admin's featured pick, otherwise the latest ARTICLE / COMPANY_NEWS /
EDITOR_NOTE. Birthdays and spotlights are never the hero. They get a
dedicated "Celebrations" band.

**Admin IA (proposal):** replace the 13-item wrapping top bar with a
grouped, role-aware sidebar:

- **Publish:** Dashboard · Content · Review queue (NEW view, `status=review`) · Media
- **Organise:** Issues (Publications) · Sections · Categories · Navigation
- **People:** Contributors · Staff
- **Admin:** Users · Activity · Settings · Site Assets
- **Help:** User Guide

Pages a role cannot write to are hidden from that role (today contributors
see Categories, Sections and Publications links they cannot use).

---

## 4. Visual design directions

All three use **only** the five supplied brand hexes (PHD Purple `#3A008C`,
Lime `#9FEA47`, Coral `#FF7373`, Lavender `#9B83FF`, Pink `#FF70F2`) and Syne.
Anything beyond that is a **proposal** listed in §6. All three fix the
shared defects in §1.3–1.4 (orientation-aware images, readable body copy,
contrast, branded empty, 404 and error states).

### Direction A — "House Paper" (light corporate editorial)

- **Idea:** a calm, light, print-like reading environment. Purple becomes
  *ink* (mastheads, headlines, rules) and lime becomes a highlighter mark used
  once per view.
- **Canvas:** warm off-white paper, near-white cards, deep-purple text.
  Pillars are tagged with coral, lavender and lime chips. Pink is reserved
  for celebrations.
- **Type:** Syne 700–800 for mastheads and headlines. Long-form body in a
  dedicated reading face (*proposal:* a humanist serif or sans; needs brand
  approval). The fallback is Syne at a larger size with generous leading.
- **Layout:** a 12-column editorial grid, a big lead story with a sidebar
  "In this issue" list, numbered sections, generous white space.
- **Strengths:** most "professional corporate communications". Best long-read
  legibility. Easiest to make accessible. Photos look best on light.
- **Risks:** furthest from the current dark build. Can feel conservative
  if under-designed.

### Direction B — "Purple Room" (energetic dark, made genuinely purple)

- **Idea:** keep the dark mood the client approved earlier, but make it
  *PHD Purple* instead of black. Colour-blocked pillar bands, bold
  full-bleed photography, lime for action.
- **Canvas:** a deep purple field derived from `#3A008C` (visibly purple,
  not black), lighter purple surfaces, lime CTAs and focus rings. Each pillar
  gets a full-width band in its accent.
- **Type:** Syne only (brand-safe, no new typeface needed), with real weight
  contrast (800 display vs 400 body) and body set larger.
- **Layout:** full-bleed hero, overlapping image and title cards, horizontal
  scrolling "Celebrations" rail.
- **Strengths:** smallest brand risk (same palette and font), most energy,
  closest to agency culture.
- **Risks:** dark long-reads are tiring. Coral, lavender and lime on purple
  need contrast checks (lime on purple passes easily; pink and coral need
  care). It could still read as "the same site, recoloured" if the layout
  work is not bold.

### Direction C — "Quarterly Edition" (issue-led magazine) — **recommended**

- **Idea:** treat Springboard as what it is: a quarterly *edition*. Each issue
  gets a cover: a full-bleed lead image with a big Syne issue title ("Q2 '26"),
  much like a print cover and the flipbook newsletter heritage. Inside, sections
  read as numbered chapters.
- **Canvas:** light paper for reading pages. A solid PHD Purple cover band
  and section openers. Each pillar owns one accent (People & Culture → coral,
  Company & Business → lavender, Engagement → lime). Pink is for
  celebrations.
- **Type:** Syne for covers, chapter numbers and headlines. A reading face
  for body (same proposal as A, Syne fallback).
- **Layout:** cover → "In this edition" contents → chapters. Orientation-aware
  story heroes (landscape full-bleed, portrait as a split image-and-text
  layout). Gallery-led "Photos of the Quarter" with a lightbox. A celebrations
  wall for birthdays.
- **Strengths:** a distinctive idea, not a template. Matches the data model
  exactly (publication → sections → content). Gives each quarter a sense of
  occasion. Combines A's legibility with B's colour.
- **Risks:** needs a strong cover image each quarter (an editorial process
  dependency, §6). It is slightly more design effort.

**Recommendation:** Direction C. Fall back to A if the client wants a
quieter corporate tone, or to B if the client wants to stay dark and avoid a
second typeface. **This is a recommendation, not a known client preference.**

### Shared component treatments (all directions)

| Element | Treatment |
|---|---|
| Landscape cover | Full-bleed or wide 16:9 / 3:2 hero, `object-cover`, optional caption |
| Portrait cover | Split layout: image at its native ratio (≤ 4:5) beside the title block on desktop; stacked on mobile. **No letterboxing.** Needs T4 (dimensions). |
| Cards | Fixed ratio per card size (4:3 standard, 1:1 compact), `object-cover`, centre or focal crop, `alt=""` (title already in link) |
| Inline image | Native ratio, max height ~80svh for portraits, caption and credit line |
| Gallery block / GALLERY type | Justified rows or 2–3 column grid at native ratios. Click opens an accessible lightbox (focus trap, Esc, arrows, captions, counter) |
| YouTube | Feature-branch facade kept. Restyled: 16:9 for landscape, 9:16 centred with max-height for Shorts, title + caption + "Watch on YouTube" |
| Quote / statistic / callout | Pillar-accent rules, large Syne numerals, accessible callout colours (≥ 4.5:1 text) |
| Event | Date block, time, location, RSVP button (renders existing metadata) |
| Health tip | "Source" footnote with link (renders existing metadata) |
| Spotlight | Portrait-led profile header, Q&A as alternating editorial pull-outs |
| Birthday | Celebrations wall: circular portraits or initials, name, date. Consistent date format |
| Empty / 404 / error | Branded and human ("Nothing here yet — see the latest edition"), never developer copy |

### Admin and editorial experience (all directions)

A light, neutral, high-contrast admin theme (form borders ≥ 3:1, errors ≥
4.5:1). Grouped sidebar (§3). The content editor gets a two-column layout
(fields left, sticky "Status & Publishing" panel right with only the actions
the role and status allow). The block editor gets a visual block picker and
inline media previews. A review queue. Status shown as a consistent badge
plus timeline. **Same Server Actions, same intents, same RLS: no new write
path.**

---

## 5. Page-by-page reconstruction plan

| # | Page / template | Change | Backend impact |
|---|---|---|---|
| 1 | Global shell: header, footer, skip link, 404, error, loading | Rebuild. Nav keeps CMS-driven items, adds keyboard support, pillar links and mobile drawer. Footer gets IA-based links, issues archive and (if supplied) social links | None (a social-links field would be a migration, so only if requested) |
| 2 | Design tokens and type | New `theme.css` values per chosen direction. Self-host fonts | None |
| 3 | Home | Cover (current issue) → contents → pillar highlights → celebrations → contributors | None (uses existing queries and settings) |
| 4 | Issue page | Cover, "In this edition" contents, numbered chapters | None |
| 5 | Issues archive `/issues` (new) | Grid of past covers | New read-only query on `publications` (RLS-scoped) |
| 6 | Story: ARTICLE / EDITOR_NOTE | Orientation-aware hero, reading measure, block restyle, prev/next, related | Needs T4 dimensions |
| 7 | Story: COMPANY_NEWS / EVENT / HEALTH_TIP | News template. Event and health metadata panels | None |
| 8 | GALLERY + Photos of the Quarter | Photo-led template and lightbox | None |
| 9 | STAFF_SPOTLIGHT | Profile-led Q&A | None |
| 10 | BIRTHDAY + Staff News | Celebrations wall, fixed date formatting | None |
| 11 | Category landings (8) | Pillar-accented header, lead plus grid, pagination | Add `offset` to `getContentByCategoryId` |
| 12 | Pillar landings (3, new) | Overview of child categories | New routes. Nav hrefs set in CMS |
| 13 | Contributors index (new) and profile | Directory plus profile restyle | New read-only query |
| 14 | Staff profile `/staff/[slug]` | Finish it or `notFound()` it (decision Q11) | None |
| 15 | Search | Restyle, type filters, result count | None |
| 16 | Admin shell and primitives | Sidebar, light theme, accessible fields | None |
| 17 | Admin content editor and block editor | Layout, publishing panel, block picker | None (same actions) |
| 18 | Admin review queue (new view) | Filtered content list | None |
| 19 | Media library | Grid with orientation badges, private/public clarity | T4 dimensions capture |
| 20 | User guide | Recapture 27 screenshots, update copy | Docs only |

---

## 6. Client decisions, missing assets and open questions

### Decisions needed before design work starts

1. **What exactly does the client dislike?** Please share their actual
   feedback or examples of sites they like. Today this is an assumption (§1.5).
2. **Which direction: A, B or C** (or a mix)?
3. **Typography:** is Syne-only mandatory, or may long-form body use a
   second, approved reading typeface? If a second face is allowed, which
   (licensed or approved by PHD brand)?
4. **Light or dark** reading surfaces? (A and C are light, B is dark.)
5. **Pillar colours:** may coral, lavender and lime be assigned one per pillar?
6. **Homepage rules:** may birthdays and spotlights be kept out of the lead
   slot?
7. **Baseline:** will `feat/youtube-video-blocks-and-media-batch-import` be
   merged as-is? (The branch is based on it.)

### Missing assets (blocking polish, not structure)

8. Official **PHD Nigeria logo** files (SVG, light and dark variants) and any
   **Springboard wordmark**. The header currently uses plain text. The Site
   Assets slots exist but production values are unknown here.
9. **Favicon**, **apple-touch icon**, default **social share image**.
10. **Brand guidelines** document (clear space, logo usage, photography style,
    tone of voice), if one exists beyond the five hexes.
11. **Cover photography** for each issue (needed for Direction C), plus photo
    credits policy.
12. **Footer content:** approved social links, contact email, legal or
    privacy text (NDPA privacy notice link?).

### Open technical and governance questions

13. **Is Vercel Preview pointed at production Supabase?** (T6) Who can check?
14. Can we create a **staging Supabase project** for write testing, or must
    all write testing run on a local stack (needs a machine with Docker)?
15. May we add **image dimension capture** (T4)? It is additive and has no
    migration, but backfilling existing rows writes to production `media`
    rows. That needs explicit approval and would run as a separate,
    reviewed step.
16. Do we want **focal points** (T5, needs a migration) or are crop presets
    enough?
17. Should `/staff/[slug]` become a real public staff profile or be removed
    (staff data is personal data, so a DPO view applies)?
18. Is a **review queue with comments or notifications** wanted (schema
    and email provider), or is a filtered view enough?
19. Should **Games** have interactive content (embeds?) or stay article-based?
20. Who signs off: client contact, PHD brand owner, and the editorial team
    for UAT?

---

## 7. Staged implementation and testing plan

Each stage is its own PR **into this branch** (never `main`). Nothing merges
to `main` until the client approves the whole redesign on a preview whose
database isolation has been verified.

| Stage | Scope | Exit criteria / tests |
|---|---|---|
| **0. Safeguards and harness** | Verify Preview env isolation (T6). Add a visible "PREVIEW — not production" banner keyed on `VERCEL_ENV`. Fix CI order (`next typegen` before `tsc`). Self-host fonts. Commit a **Playwright suite** that runs against a local Supabase stack with fictional fixture data: public routes, every content intent per role, media promote/delete permissions, RLS denial checks. Add **axe-core** checks and screenshot baselines of the *current* site at 390 / 768 / 1280 / 1440 widths. Add a test that blocks `lib/supabase/admin` imports outside the cron routes. | Suite green on the current UI (so it can catch regressions). Isolation documented. |
| **1. Tokens and primitives** | New `theme.css` for the chosen direction. Type scale. Button, field, badge, card and link primitives. A style-guide route (dev-only, `noindex`). | Contrast table re-computed, all ✅. Client review of the style guide. |
| **2. Shell** | Header and nav (keyboard), footer, skip link, 404, error, loading. | axe clean. Keyboard walkthrough. |
| **3. Story templates** | Article, news, event, health tip, spotlight, birthday, gallery. Restyled blocks. Lightbox. YouTube. | Visual tests with landscape, portrait, missing-image, no-byline and no-caption fixtures. |
| **4. Landing pages** | Home, issue, issues archive, pillars, categories (paginated), contributors, search. | Route-preservation test (every current URL still resolves). |
| **5. Media** | Dimension capture on upload (T4). Orientation-aware layouts switched on. (Backfill script prepared, **not run** without approval.) | Upload tests (local stack). |
| **6. Admin** | Shell, editor layout, publishing panel, review queue, media grid. | Per-role intent matrix green. Zero changes to Server Action signatures, or each change documented. |
| **7. QA** | Full a11y (axe, keyboard, NVDA/VoiceOver spot checks, 400% zoom), performance (LCP and CLS on preview), cross-browser, guide screenshot recapture, docs update (T13). | Report with results as actually measured. |
| **8. UAT and release readiness** | Editorial team UAT on an **isolated** preview. Release checklist. Rollback plan (Vercel instant rollback; there is no DB change unless T4 or T5 is approved). | Client sign-off. **Merge and production promotion done by the project owner, not by this workstream.** |

**Explicitly out of scope unless approved:** schema migrations (T5,
review comments, social links), backfills, changes to RLS, Auth or cron,
removing any existing feature or route.
