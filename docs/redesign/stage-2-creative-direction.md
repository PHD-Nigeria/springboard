# Springboard Reconstruction — Stage 2: Creative Direction, Hero Prototype and Quarterly Editions

Prepared 29 October 2026 on `feature/redesign-reconstruction`.
**Status: for review. No application code has changed.** This stage adds
documentation, a standalone prototype, proposed (unapplied) SQL and a
read-only audit script. Nothing was merged, deployed or migrated, and
production was not contacted for testing.

Findings are marked as follows:

- **[Verified]**: confirmed from the code or by a test run in this stage.
- **[Observed]**: seen through a read-only, text-only fetch.
- **[Not observable]**: could not be seen from this environment.
- **[Proposal]**: needs approval before it is built.

---

## 0. Baseline

| Ref | Commit | State |
|---|---|---|
| `origin/main` | `33515f6` | Unchanged since Stage 1 |
| `origin/feat/youtube-video-blocks-and-media-batch-import` | `e58550e` | Unchanged. This is the parent of the reconstruction branch |
| `feature/redesign-reconstruction` | `c72f8d1` (Stage 1) → this commit | **Local only.** This session can read the repo but has no write credentials, so pushes are refused. Patches are supplied so the commits can be pushed from an authorised machine. |

---

## 1. Reference website — https://peterobi.online

**What could be inspected.** This environment's network proxy blocks the
host for the browser and for `curl`. The only access was a text-extraction
fetch of `/` and `/media`. That fetch returns rendered text and image
references. It does **not** return CSS, JavaScript, class names or anything
that moves.

**[Not observable] Motion, transitions, timing, easing, hover states,
scroll behaviour, fonts and colours.** The extraction showed no animation
libraries, and that only means none appeared in the text. It is not
evidence either way. **I have not recreated any effect "from the
reference"**, because I could not see any. The motion system in §4
implements the brief's own requirements.
*To close this gap:* a short screen recording of the reference, or a
session linked to a computer with a browser, would let me document its
real transitions.

**[Observed] Structural and editorial patterns worth adopting:**

| Observed on the reference | Springboard translation |
|---|---|
| Numbered primary navigation ("01. Story" … "10. 2027") | Numbered **chapters** in the edition contents (01 People & Culture, 02 Company & Business, 03 Engagement & Community). The CMS menu itself keeps its current labels. |
| Short editorial headings with a point of view ("Soft spoken, hard to move"; "Most weeks, a different state") | Section headings written as editorial lines, edited in the CMS. Section titles already come from `sections.title`. |
| Sequential chapters with year + label + thumbnail ("2006 Governor") | Edition archive: quarter code + title + cover per edition |
| Photo archive numbered 001–102 with subject filters (Portraits, With people, On the road …) and a viewer with Close / Source / ← → | "Photos of the Quarter" numbered in the editor's order, with a lightbox (Close, ← →, counter, caption, credit). Subject filters need tags we don't have; not proposed. |
| Descriptive alt text on every image; dedicated credits and licences section | Alt text required at upload (it already exists). **Proposal:** a photo credit field, and credits shown in captions and the lightbox |
| `.webp` photography, about 20 unique images on the homepage | Supports the image-led direction. Next/Image already serves modern formats. |
| `theme-color` `#0b0b0b` (near-black) | Not adopted. The brief asks for PHD Purple to be visibly present. |

---

## 2. Existing media assets

- **[Verified] Repository:** `public/dev-fixtures/placeholder.svg` and 27
  admin-guide screenshots (`docs/user-guide/images/`). There is **no
  editorial photography in git**, which is correct, because media lives in
  Supabase Storage.
- **[Not inspected] CMS media library.** Inspecting it needs either
  production credentials (out of bounds for testing) or a staging copy,
  which does not exist. The audit script (`docs/redesign/audit/edition-audit.sql`,
  query G) and a Media Library export would give the real inventory.
- **[Observed in Stage 1]** The Q2 '26 article sampled had three uncaptioned
  images. Production images record **no width or height**
  (`media-actions.ts` writes `null`), so orientation-aware layout needs
  dimension capture (Stage 1, T4).

### Placeholder strategy (prototype only)

All prototype photographs are **CSS-generated duotone panels** in
desaturated tints of the five brand colours, with film grain and a visible
label giving the intended **ratio and subject** (e.g. "Placeholder · 4:5 ·
portrait, single subject"). They make no network requests, use no stock
images and invent no URLs. A review toggle hides the labels for a cleaner
look at the composition. Every placeholder is replaced by CMS media in the
real build.

### Photography needed for launch (per edition)

| Use | Count | Orientation / ratio | Notes |
|---|---|---|---|
| Hero ribbon | 10–14 | Mixed: about 40% portrait (4:5, 2:3, 3:4), 40% landscape (3:2, 16:9), 20% square | ≥ 2000 px long edge; varied scale (wide group → detail); people and place; no text in image |
| Edition cover | 1 | Landscape 3:2 (desktop) that survives a 3:4 crop (archive card) | Strongest image of the quarter |
| Story covers | 1 per story | Any. The layout adapts once dimensions are recorded | Caption and credit |
| Staff Spotlight portraits | 1 per spotlight | Portrait 4:5 | Plain background preferred |
| Celebrations | 1 per person, optional | Square crop-safe | Initials fallback already exists |
| Photos of the Quarter | 12–40 | Native | Caption and credit each |

**Data protection (NDPA 2023).** Staff photographs and birthdays are
personal data. Before staff photos are used in a looping homepage hero,
confirm the consent basis and an opt-out route. This is a DPO decision,
listed in §9.

### Brand assets still missing (unchanged from Stage 1)

Official PHD Nigeria logo (SVG, light and dark), any Springboard wordmark,
favicon set, default social share image, brand guidelines, and footer
links. The prototype uses a typographic "SPRINGBOARD / PHD Nigeria"
wordmark as a stand-in.

---

## 3. Prototype

`springboard-motion-prototype.html`, published as a private review page. It
contains six views: **Home · Editions archive · Edition · Story ·
Gallery · Admin sketch**. It is a standalone design prototype, not
application code. In the real build every element below becomes a
component reading existing queries.

### 3.1 Homepage hero

- **Composition:** a PHD Purple stage. The headline is the **existing CMS
  default banner copy** ("Where PHD Nigeria's people, ideas, and culture
  come together." and "A space for the stories, insights, and voices that
  shape how we work." from `src/app/page.tsx`), so no new copy was
  invented. A **Latest Edition** card (cover, quarter, date range, "Open the
  edition", "Browse all editions") sits beside it. The photographic ribbon
  runs full-width below. Text never sits on moving photography, so it is
  always readable.
- **Seamless loop:** the track holds two identical sets and translates by
  exactly −50%. JavaScript rounds one set to a whole pixel width, so the
  loop point lands on an identical raster. **[Verified]**: a pixel
  comparison of the first and last frame of the loop at 1440 × 360 px found
  **0 differing pixels**.
- **Speed:** a constant 38 px/s (≈ 100–120 s per loop, depending on
  viewport). This is a slow drift, not a slideshow. On hover it eases to 30%
  speed instead of stopping abruptly.
- **Variation:** 10 frames across 7 ratios, 4 heights (100 / 86 / 80 / 72%)
  and alternating top, centre and bottom alignment. Each frame has a small
  pillar + quarter caption and a subtle bottom gradient so the captions
  stay legible.
- **Performance:** compositor-only `transform` animation. `contain:
  layout paint` on the ribbon. Fixed row height and `aspect-ratio` boxes,
  so there is no layout shift. **[Verified]**: CLS 0.0000 over 5 s.
  Paused when off-screen (IntersectionObserver) and when the tab is hidden.
  **[Verified]**. In the real build, frames are `next/image` with explicit
  `sizes`, the first visible frames eager-loaded and the rest lazy.
- **Control and accessibility:** a visible "Pause motion" button (WCAG
  2.2.2), the duplicate set `aria-hidden`, and the ribbon labelled as a
  moving photo strip.
- **Reduced motion:** with `prefers-reduced-motion`, the ribbon stops,
  the duplicate is removed, and the strip becomes a horizontally scrollable
  row. The headline renders at rest. **[Verified]**
- **Without JavaScript:** the loop is pure CSS, so it still runs. *Prototype
  caveat:* the prototype builds its frames with JavaScript, so with JS off
  it shows the headline and card but no frames. In the real build both sets
  are server-rendered, so no-JS shows the full ribbon.

### 3.2 Navigation

- **CMS-managed:** the prototype renders the exact `nav_items` hierarchy
  seeded by migration `20260924000000`: People & Culture (HR Corner, Staff
  Spotlight, Staff News, Healthline) · Company & Business (Company News,
  Articles) · Engagement & Community (Photos of the Quarter, Games) · Search.
  In the build it continues to come from `getPublicNavItems()`. Nothing is
  hard-coded and no URL changes. **[Verified]**: all 4 top-level items and
  all 8 category links present.
- **Behaviour:** this is the disclosure pattern (not an ARIA menu). Click
  or hover (mouse only, with a 160 ms close delay) opens a group. ArrowDown
  opens the group and focuses its first link. Arrow keys move within the
  group. Escape closes it and returns focus to the trigger. Focus leaving
  the group closes it. **[Verified]** by keyboard automation.
- **Panel motion:** 240 ms opacity + 6 px rise. Each link shows a pillar
  colour dot, and an arrow slides in on hover or focus.
- **Header surfaces:** *overlay* on pages that open on purple or on a
  photo with a top scrim; *solid purple* on light-topped pages and after
  24 px of scroll (it compacts from 76 to 62 px). **[Verified]**
- **Latest edition pill:** a separate, data-driven link (from the latest
  published edition), **not** a nav item. Adding "Editions" to the menu
  itself is a CMS row an admin can add at `/admin/navigation` (decision Q9).
- **Mobile:** a full-screen purple drawer with a clip-path reveal, accordion
  groups, a focus trap, Escape to close, focus returned to the Menu button,
  and body scroll lock. **[Verified]** at 768 and 390 px.
- *Note:* production currently opens "Company News" in a new tab (a CMS
  setting on that row). It is an internal link. Recommend switching that off.

---

## 4. Motion system

| Token | Value | Used for |
|---|---|---|
| `--d-micro` | 160 ms | link arrows, button press |
| `--d-ui` | 240 ms | dropdowns, header state, chips, accordion |
| `--d-reveal` | 720 ms | headline words, scroll entrances, image clips |
| `--d-page` | 560 ms | page curtain, mobile drawer |
| ribbon | 38 px/s | hero drift (time derived from width) |
| `--e-out` | `cubic-bezier(.16,1,.3,1)` | all entrances (already `--ease-editorial-in` in `theme.css`) |
| `--e-std` | `cubic-bezier(.4,0,.2,1)` | colour/state changes (already `--ease-standard`) |

**Hierarchy, one moment per surface:**

1. **Page:** a purple curtain wipes up, the view swaps, and the curtain
   wipes off the top. In the build this is a `PageTransition` rewrite. It is
   Framer Motion-capable, but the prototype uses CSS clip-path with no
   library.
2. **Headline:** a word-by-word rise (45 ms stagger), clipped per word.
3. **Imagery:** a hero settle (scale 1.08 → 1 over 1.6 s). Edition covers
   clip-reveal from the top. Scroll entrances use transform and clip only.
   **The resting state is always visible**, so nothing waits at opacity 0
   for an observer.
4. **Micro:** image scale 1.045 on hover over 1 s, link underline wipes,
   and a 0.97 button press.

No new animation library is needed. Everything is CSS plus small observers,
and Framer Motion (already installed) stays available for layout transitions
if they are wanted later.

---

## 5. Colour roles and contrast

The five brand hexes are used **exactly**. The neutrals are mixes of PHD
Purple, not new hues: `#24005A` deep, `#1A0B3B` ink, `#F6F3FA` paper,
`#5B4F72` muted on paper, `#D9CCF5` muted on purple, and `#8E83A6` for UI
edges on paper.

| Role | Colour |
|---|---|
| Brand stage: hero, covers, page heads, header, story bands | PHD Purple `#3A008C` |
| Action and current-edition signal: pill, edition labels on purple, focus ring on purple | Lime `#9FEA47` |
| Pillar: People & Culture | Coral `#FF7373` |
| Pillar: Company & Business | Lavender `#9B83FF` |
| Pillar: Engagement & Community | Lime `#9FEA47` |
| Celebrations | Pink `#FF70F2` |
| Reading surface | Paper `#F6F3FA` / ink `#1A0B3B` |

Contrast was computed with the WCAG 2.x formula:

| Pair | Ratio | Allowed use |
|---|---|---|
| White on Purple | 13.47 | all text |
| Muted `#D9CCF5` on Purple | 8.92 | all text |
| Lime on Purple | 9.20 | all text, focus ring |
| Pink / Coral on Purple | 5.68 / 5.10 | text |
| Lavender on Purple | 4.55 | large text only (just passes AA normal; avoid for small text) |
| Purple on Paper | 12.27 | all text, focus ring on paper |
| Ink on Paper | 16.55 | body |
| Muted `#5B4F72` on Paper | 6.81 | captions, meta |
| Ink on Lime / Coral / Lavender / Pink | 12.41 / 6.89 / 6.13 / 7.66 | accent chips and badges |
| Lime / Coral / Lavender on Paper | 1.33 / 2.40 / 2.70 | **never as text or meaningful edges.** Fills only, with ink text. |
| UI edge `#8E83A6` on Paper | 3.3 | form fields, chips (WCAG 1.4.11) |

**[Verified]** axe-core found **0 violations** on all six prototype views.
An earlier run caught brand-coloured chapter numerals on paper (1.33–2.69).
They were fixed by placing ink numerals on accent blocks.

---

## 6. Typography

| Level | Face | Treatment |
|---|---|---|
| Hero / cover headline | Syne 800 | 2.3–5.4 rem, −0.03 em, word-rise entrance |
| Edition numeral ("Q2 '26") | Syne 800 | up to 14 rem on the cover; 3.4 rem on archive cards |
| Section and chapter titles | Syne 800 / 700 | 2–3.8 rem; chapter numbers 01–03 on accent blocks |
| Labels (edition, pillar, kicker) | Syne 700 | 0.68–0.74 rem caps, +0.12–0.18 em tracking |
| Standfirst / summary | Body face | 1.15–1.35 rem, muted |
| Article body | **Body face** | 1.16 rem at 1.72 line-height, about 65 characters |
| Captions, credits, dates | Syne 500 / 700 | 0.84 rem muted. Credit in bold |
| Navigation and admin | Syne 600 / 700 | 0.86–0.92 rem |

**Body face: decision needed.** The prototype defaults to Syne, the current
brand face. A review toggle shows **Newsreader** (Google Fonts, OFL) for
long-form text as a *proposal only*. I have not assumed client approval. If
a second face is rejected, the Syne fallback is already specified.

**Dates:** one format everywhere, `25 September 2026`. Birthday summaries
stay separate from the publish date, which fixes the "May 25 Sept 2026"
issue.

---

## 7. How the direction carries to the other templates

| Template | Treatment (in the prototype where marked ✓) |
|---|---|
| **Edition landing** ✓ | Purple cover: giant quarter numeral, period, publish date, story count, clip-revealed 3:2 cover. Then a numbered **Contents** list of sections. Then **All stories** with pillar filter chips. Shows only that edition's content. |
| **Editions archive** ✓ | Cover cards generated from publication records, published only, newest first, with a "Latest" flag. **[Verified]**: the fixture draft quarter is excluded. |
| **Article / editor's note** ✓ | *Landscape cover:* full-bleed hero with top scrim; the title panel overlaps the image on paper. *Portrait cover:* split layout with purple title panel and native 4:5 image (no letterbox). Edition + pillar label, consistent date, reading time. Landscape inline images can break out wider than the text; portraits are capped at 80% viewport height. Pull quote with pillar rule. |
| **Company News / Event** ✓ | Same story shell. EVENT shows a date block + When / Where / RSVP from the existing `metadata`. |
| **Health tip** ✓ | Source footnote from `metadata.source` / `sourceUrl`. |
| **YouTube block** ✓ | The feature branch's click-to-play facade, restyled. Lime play button, 16:9 or 9:16. |
| **Photos of the Quarter / gallery** ✓ | Justified rows by native ratio. Numbered 001…. Lightbox with Close, ← →, keyboard, counter, caption, credit, and focus return. **[Verified]** |
| **Staff Spotlight** | Portrait-led split hero (as above). Q&A as alternating pull-outs. |
| **Staff News / birthdays** ✓ (home band) | Celebrations rail with pink-ringed portraits or initials. Never the homepage lead. |
| **Category landings** | Pillar-accent header. Edition filter (latest by default, "all editions" option). Pagination. |
| **Contributor profile** | Portrait split hero, then stories grouped by edition. |
| **Search** | Purple page head, results labelled with edition, type filter. |
| **Empty / 404 / error / loading** | Branded purple head with human copy and a link to the latest edition. Skeletons use fixed ratios (no shift). |
| **Admin** ✓ (sketch) | Light theme. Grouped sidebar. Edition filter and edition selector (§8.4). |

---

## 8. Quarterly editions — data model and workflow

### 8.1 What exists today [Verified from migrations and code]

- **`publications` already models an edition:** `slug` (URL
  `/issues/{slug}`), `title`, `subtitle`, `cover_media_id`, its own
  `status` / `publish_at` / `published_at`, and `sections`
  (`sections.publication_id NOT NULL`, ordered). It is reused as the
  edition. No parallel table is needed.
- **`content.publication_id`** is nullable, with `on delete set null`.
  Slugs are unique per publication, plus a partial unique index for null
  publication.
- **Gaps:**
  1. No stable quarter identifier, period dates or ordering. The only
     clue is the slug (`springboard-q2-26`).
  2. `publication_id IS NULL` means both "evergreen" and "not decided",
     which is ambiguous.
  3. Deleting a publication **silently** turns its content into "no edition".
  4. Nothing stops `section_id` pointing at another edition's section.
  5. "Submit for review" does not require a publication. Publish and
     schedule do (`mustStayPublishReady`).
  6. There is **no route for edition-less content** (href is `undefined`,
     so cards link to `#`), and no `/issues` archive.
  7. **Edition embargo gap.** `content_select_public` checks only the
     content's own status. Listing queries (`getRecentContent`,
     `getNewsBites`, category landings, search) do not require the edition
     to be visible. The sitemap is already safe: it drops rows whose
     edition join comes back empty. So a published story inside a **draft** edition
     appears on the homepage and in search, with its title, summary and
     cover, linking to `#`. Only the story URL itself 404s. **[Verified]**
     under the real RLS policies, in an offline Postgres (§10.2).
  8. `site_settings.default_publication_id` already exists and pre-selects
     a publication for new content. It becomes the **active edition**, with
     no schema change.
  9. Media has no edition link. `media.content_id` is `on delete cascade`,
     so deleting a gallery item deletes its media rows. That matters for
     reuse. Worth reviewing, but unchanged here.

### 8.2 Proposed schema (in `docs/redesign/proposed-migrations/`, **not applied**)

**M1 — additive, backward-compatible** (`M1_editions_additive.sql`):

- `publications.edition_year`, `edition_quarter` (nullable, range-checked,
  both-or-neither). `edition_code` (e.g. `2026-Q2`), `period_start` and
  `period_end` are **generated** from them, so they can never be typed
  inconsistently. A partial unique index enforces one edition per quarter.
  An ordering index serves the archive and "latest".
- `content.is_evergreen boolean not null default false`, checked so it can
  never be combined with a `publication_id`. This makes evergreen an
  explicit choice. **Existing rows are not reclassified.**
- `public.media_edition_usage`: a `security_invoker` view deriving each
  media file's edition(s) from where it is used (covers, gallery
  attachments, image, gallery and video-thumbnail blocks, edition covers).
  Reuse across editions needs no duplicate upload, and there are no stale
  hand-typed quarter tags. Uses a small `try_uuid()` helper, because block
  JSON is validated by the app, not the database.
- No RLS, auth, role, cron or existing-column change.

**M2 — backfill. Written only after the audit**, row by row from editorial
decisions. **Not written and not run.**

**M3 — enforcement, after M2** (`M3_editions_enforcement.sql`):

- A trigger that blocks `review`, `scheduled` or `published` when there is
  no edition and no explicit evergreen choice. Drafts stay unrestricted.
- A trigger that enforces section ∈ the content's edition.
- Changing `content.publication_id` from `on delete set null` to `on delete
  restrict`. Editions are archived, not deleted.
  *Side effect:* the admin's "Delete anyway" on a publication that has
  content will start failing. That UI must change to "archive" in the same
  release.

### 8.3 Application changes (Stage-3 work, after approval)

| Area | Change |
|---|---|
| Queries | `getLatestEdition()`: published, ordered by `edition_year desc, edition_quarter desc, published_at desc`, with fallback to `published_at` until backfill. `listEditions()` for the archive. **Embargo fix:** listing queries use an inner join on a visible publication for edition content, plus explicit evergreen rows. This needs **no RLS change** (verified, §10.2). An optional RLS hardening can follow as a separate approval. |
| Routes | **New** `/issues` (archive). It coexists with `/issues/[publicationSlug]` and `/issues/[publicationSlug]/[contentSlug]`, which are unchanged. **New** route for evergreen content, e.g. `/stories/[slug]`. It only resolves `is_evergreen` rows, so it does not collide. Category pages get an `?edition=2026-Q2` filter. |
| Labels | `EditionLabel` component: quarter code/short name from the joined publication. Never from free text. Shows "Evergreen" when that is set. |
| Admin: content form | Edition radio group: **Active edition** (default from `default_publication_id`) · Another edition · **Evergreen** · Not decided yet. The Section list is filtered to the chosen edition. |
| Admin: validation | `submit-for-review` joins publish/schedule in requiring edition-or-evergreen. Same Server Action, one more check, no permission change. |
| Admin: content list | Edition filter (all / each edition / evergreen / not assigned) and an edition column. A review queue that can be filtered by edition. |
| Admin: editions | The Publications manager is renamed "Editions" in the UI, with year/quarter fields. The code, dates and slug suggestion are derived. Creating a new quarter only inserts a row and never touches other editions' content. **[Verified]** in §10.2. |
| Admin: media | "Used in" filter by edition via `media_edition_usage`. |
| Governance | Edition status and story status stay independent. Publishing a story never publishes its edition, and publishing an edition never publishes its stories. **[Verified]** for the first, in §10.2. Public visibility = story visible **and** edition visible (or evergreen). Staff can preview an unpublished edition. |

### 8.4 Existing content: audit before anything moves

`docs/redesign/audit/edition-audit.sql` contains 7 **SELECT-only**
queries for the project owner to run against production (preferably as a
read-only role):

- **A:** publications with a *suggested* quarter parsed from slug/title,
  for an editor to confirm.
- **B:** content with no edition. Each row needs an edition or evergreen
  decision.
- **C:** section/edition mismatches.
- **D:** edition content with no section.
- **E:** the embargo gap (public stories in non-public editions).
- **F:** publish-date spread per edition.
- **G:** media reused across editions.

Classification rules for the review:

- **Map safely:** a publication with a confirmed quarter, and content in it
  whose section belongs to the same edition.
- **Needs editorial confirmation:** any publication without a clear
  quarter; any row from queries C, D or E; any published row from B.
- **Candidate evergreen:** HR policies, Healthline explainers and other
  content from B that is not time-bound. These are **proposed to the
  editor, never set automatically**.

### 8.5 Acceptance criteria: where each is met

| # | Criterion | Met by |
|---|---|---|
| 1 | Latest quarter from the homepage, immediately | Hero Latest Edition card + header pill (prototype ✓) |
| 2 | Archive of previous editions | `/issues` archive from records (prototype ✓) |
| 3 | Every published quarter item has its correct edition | M3 trigger + audit/M2 (validated offline ✓) |
| 4 | Edition shows only its content, subject to visibility | Edition-scoped query + embargo fix (validated offline ✓) |
| 5 | Editors filter, create and review by quarter | Admin selector, filter and review queue (sketch ✓) |
| 6 | New quarter doesn't overwrite or misclassify old ones | Unique quarter, derived codes, no cascade (validated offline ✓) |
| 7 | No review without an edition | App check + M3 trigger (validated offline ✓) |
| 8 | URLs, permissions and workflows unchanged | Additive routes only, same Server Actions and RLS (to be covered by the Stage 0 Playwright suite) |
| 9 | Isolated testing; production unchanged | Everything here ran offline. Writes need a verified staging project. |

---

## 9. Decisions and inputs needed

1. Approve the creative direction (hero, nav, colour roles, motion) as
   prototyped, or give changes.
2. **Body typeface:** Syne only, or an approved reading face (Newsreader is
   proposed)?
3. **Reference motion:** please supply a screen recording of
   peterobi.online (or link a computer) if specific transitions must be
   matched.
4. **Approve M1** for a staging trial, and identify who runs the read-only
   audit on production.
5. Confirm the quarter for each existing publication (audit A), and an
   edition or evergreen decision for each row the audit flags.
6. **Staging Supabase project** (or approval to run the Stage 0 suite
   against a local stack on a Docker-capable machine). This is still
   required before any write testing.
7. **DPO / consent** for staff photographs in the homepage hero and for
   birthday listings.
8. Photography and brand assets from §2.
9. Should the CMS menu gain an "Editions" item (a CMS row), or is the
   header pill enough?
10. Evergreen URL pattern: `/stories/{slug}` or another?
11. Keep or remove the temporary batch importer before launch?
12. Turn off "open in new tab" on the Company News menu item?

---

## 10. Test results (as run)

### 10.1 Prototype: 48 / 48 automated checks pass

Run with Playwright (Chromium) + axe-core 4.10.2 against the local
prototype file. **Google Fonts is blocked in this environment, so the
checks ran with fallback fonts.** Real Syne is wider, and line-breaks will
differ in the published page.

- **Ribbon:** two identical sets; loop distance exactly 50%; one set wider
  than the viewport; **seam pixel-identical (0 px differ)**; loop ≥ 60 s;
  pause button works; pauses off-screen.
- **Header:** solid purple after scroll; solid on light-topped views.
- **Keyboard nav:** ArrowDown opens and focuses; arrows move; Escape closes
  and returns focus. All CMS groups and all 8 category links present.
- **Mobile drawer** at 768 / 390: opens, focuses Close, Escape returns
  focus.
- **No horizontal overflow** on 6 views × 3 widths (1440 / 768 / 390).
- **Archive** is published-only and newest-first. **Lightbox** arrows,
  Escape and focus return work. **Story** portrait/landscape switch works.
  **Admin sketch:** edition filter works, and unassigned content is blocked
  from review while evergreen is allowed.
- **axe-core:** 0 violations on all 6 views.
- **CLS:** 0.0000 over 5 s on load.
- **Reduced motion:** static ribbon, duplicate hidden, scrollable,
  headline at rest. **No JS:** headline renders and the CSS loop is
  declared.
- **No script errors.** The only console errors were the blocked font
  requests.
- Bugs this suite caught and fixed: contrast of brand-coloured numerals;
  heading order; an unlabeled scroll region; a mobile header overflow
  (15 px at 390); and the hero pushing the ribbon below the fold at
  1440 × 900.

**Visual review (manual, not automated):** I inspected screenshots of
home, story (both orientations), edition, gallery, drawer and admin. I
fixed the issues found: nav legibility over a light portrait image (added
top scrims), placeholder labels colliding with the header, and the portrait
headline size.

**Not done:**
- **Browsers:** Safari, Firefox and real devices were not tested.
- **Screen readers:** no NVDA or VoiceOver pass.
- **CPU profiling:** none was measured. The design is compositor-only,
  pauses off-screen, and makes no network requests, but that is a design
  argument, not a measurement.
- **Real photography:** none was available, so the image treatments are
  untested with real photos.

### 10.2 Proposed SQL: 27 / 27 checks pass (offline PGlite)

All **29 existing migrations** were applied to an in-memory Postgres
(PGlite 0.2.17), with minimal stubs for Supabase's `auth` and `storage`
schemas and the `anon` / `authenticated` roles. Then M1, the audit queries
and M3 were applied. All fixtures were fictional.

- **M1:** applies cleanly and changes no existing content values; no row
  becomes evergreen.
- **Derived values:** code and dates derive correctly (2026-Q2 →
  2026-04-01 … 2026-06-30).
- **Rejected as intended:** a duplicate quarter, quarter 5, a year without
  a quarter, and a hand-typed code.
- **Evergreen:** cannot be combined with an edition.
- **Media:** the usage view derives editions per use and ignores malformed
  block ids.
- **Latest edition** resolves from the data.
- **Audit:** all 7 queries run and are SELECT-only. Query E detects the
  embargo gap and query C detects a section mismatch.
- **Embargo gap reproduced under the real RLS as anon**, and the app-level
  inner-join fix hides it with no RLS change.
- **M3:** applies after clean-up. Unassigned content cannot enter review;
  evergreen can; drafts are unaffected; a cross-edition section is
  rejected; deleting an edition that has content is blocked; publishing a
  story leaves its edition's status unchanged.
- Bugs this suite caught and fixed in the proposal:
  - An out-of-range quarter failed inside `make_date()` instead of on the
    named CHECK.
  - The media view crashed on a malformed uuid in block JSON, because the
    planner evaluated the cast before the WHERE filter.

**Caveats:**
- **Roles and data:** PGlite is not Supabase. Most checks ran as superuser;
  only the embargo check ran under the `anon` role, and the auth and
  storage stubs are minimal.
- **Production:** behaviour against production data is unknown until the
  audit runs.
- **Staging:** the migrations still need a staging trial before
  production.

---

## 11. Next stages (after approval)

0. **Safeguards:** verify preview isolation; set up a staging project or a
   local Docker stack; commit the Playwright + axe suite against the current
   site. M1 trial on staging.
1. **Tokens and type:** `theme.css` rewrite per §5–6; self-hosted fonts.
2. **Global shell:** header and nav, drawer, footer, page transition, skip
   link, 404, error, loading.
3. **Homepage hero:** a server-rendered `HeroRibbon` fed by the latest
   edition's public media with recorded dimensions, falling back to a static
   cover when there are too few images. Latest Edition card.
4. **Editions:** archive, edition landing, labels, embargo fix, evergreen
   route.
5. **Story, gallery, people and category templates.**
6. **Admin:** edition selector, filters, review gate, review queue, media
   "used in".
7. **QA and UAT** on an isolated environment.

Release (merge and production) is done by the project owner.
