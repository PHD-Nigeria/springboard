# Admin reconstruction: audit and screen inventory

Branch: `feature/redesign-reconstruction`. Nothing here is merged, deployed, migrated or tested against Preview or production. Findings come from reading the code and the 29 migrations; "verified" means a command was run and its output seen.

## 1. Roles and what the database actually allows

Roles: `contributor`, `editor`, `admin` (a `viewer` profile cannot enter `/admin`). The `(protected)` layout redirects on no session, `getAdminSession()` reads the role through the cookie-scoped client, and RLS is the real boundary.

| Capability | Contributor | Editor | Admin |
|---|---|---|---|
| Create content | own, status `draft` only | any status | any status |
| Edit content | own rows while `draft` or `review` | all | all |
| Move to scheduled / published / archived | no | yes | yes |
| Hard delete content | no | no | yes |
| Media upload and edit | yes (media_write) | yes | yes |
| Promote private to public, delete media | no | no | admin only |
| Taxonomy, sections, publications, nav, settings | read | write | write |
| Users and roles | none | none | yes |
| Activity log | hidden in UI | yes | yes |

The sidebar only hides entries. Every destination still re-checks server-side (users and activity do) and RLS is unchanged.

## 2. Existing status model (kept)

`draft`, `review`, `scheduled`, `published`, `archived`. Existing transitions in `saveContentAction` and `setContentStatusAction`: save-draft, submit-for-review (draft to review), publish, schedule, cancel-schedule (scheduled to draft), unpublish (published to draft), archive, back-to-draft (archived to draft), and list quick actions publish, draft, archive.

There is no "approve" action. An editor approves a story in review by Publish or Schedule. The UI will say "Publish" and "Schedule", never "Approve".

### Findings that need a fix (no schema change)
1. List quick-action Publish (`setContentStatusAction('published')`) does not apply the "at least one block and a publication" check that the editor's Publish applies. A story with no body or no edition can be published from the list. Fix: apply the same check server-side. This strengthens validation, it does not replace it.
2. Review to draft is audited as `UNPUBLISH`. Fix: log it as `UPDATE`.
3. There is no way for an editor to send a story back from review with a note. Return to draft exists (`draft` from the queue); a reviewer note is not stored anywhere and would need a schema change (gated).
4. The editor shows "Publish" to a story in `review` with no readiness summary.
5. `window.alert` is used for errors and `window.confirm` for deletes in the list. Replaced by inline status messages and an accessible confirmation dialog.

## 3. Quarterly editions today

A publication is already the edition (title, slug, subtitle, cover, status, sections). Content points to it with a nullable `publication_id`. Proposed, not applied (see Stage 2): `edition_year`, `edition_quarter`, derived `edition_code`, `content.is_evergreen`, `media_edition_usage` view, and gated enforcement.

What the admin can do with no schema change: rename the "Publications" screen to Editions, show counts from real queries (stories by status, in-review count, scheduled, sections, media used), filter content by edition, make the active edition (`site_settings.default_publication_id`, already exists) the default for new stories, and show "No edition" explicitly.

What needs approval first: a true Evergreen flag (today "no publication" cannot be told apart from "undecided"), quarter/year fields and period dates, DB-level rule that review/publish needs an edition.

## 4. Media today

`media` has `alt_text`, `caption`, `mime_type`, `width`, `height`, `file_size_bytes`, `bucket`. Findings:
- Width and height are never recorded at upload, so portrait/landscape cannot be shown for existing assets. Fix without schema: measure in the browser at upload and send with `completeMediaUploadAction`; backfill on view is not done (no bulk change of existing rows).
- There is no `title` or `description` column. The brief asks for both. Without a migration, the displayed title is the original filename. Proposed additive migration for `title` and `description` (nullable text), gated.
- Duplicate detection exists only in the batch importer (`findMediaDuplicatesAction`, same filename and size). It will be reused by the single upload form and the picker.
- Edition association is derivable from usage (cover, body blocks, gallery rows, edition cover). Proposed view exists; until it is applied the admin can compute the same from `content` rows in application code, as `getMediaUsageAction` already does for delete warnings.
- Videos are YouTube blocks inside content bodies, not media rows. A "Videos" screen can list stories that contain video blocks (read-only jsonb containment); there is no video table. A homepage featured-video setting needs a schema addition (gated).
- Private files stay private. Promotion remains admin-only through the existing action and nothing in the redesign calls it automatically.

## 5. Current admin screens (26 pages)

| Route | Today | Plan |
|---|---|---|
| `/admin` | six stat tiles and four lists | role-aware overview with review count, my work, active edition, scheduled |
| `/admin/content` | filters status/type/search; edition filter exists in the query but not the UI | add edition, author, mine, sort; clearer statuses; dialog confirmations |
| `/admin/content/new`, `new/spotlight`, `new/birthday` | type chooser plus forms | keep; add active-edition default |
| `/admin/content/[id]` | single long form, buttons at the bottom | two-column editor: writing area and a publishing panel; unsaved warning; preview |
| `/admin/content/[id]/preview` | exists | add desktop/mobile switch |
| `/admin/media`, `/media/batch-import` | grid, search, bucket filter, metadata edit, usage, promote, delete | grid and list, type/visibility/edition filters, dimensions, orientation, duplicates |
| `/admin/publications` | list and edit form | Editions workspace with counts and detail view |
| `/admin/sections`, `/categories` | managers | keep, restyle |
| `/admin/contributors`, `/staff` | list and forms | keep, restyle |
| `/admin/navigation`, `/settings`, `/settings/assets` | managers | grouped under Administration |
| `/admin/users`, `/activity` | admin / non-contributor | keep |
| `/admin/guide/*` | markdown guide | keep, link from sidebar |

New destinations (each reuses existing data): `/admin/review` (status `review` queue), `/admin/content?scope=mine` (My work), `/admin/videos`, `/admin/publications/[id]` (edition workspace). "Upload media" links to the upload form on the media screen. "Navigation and homepage settings" groups the existing navigation page and the homepage section of settings.

## 6. Sidebar target (role-aware)

Dashboard: Overview, My work, Review queue (editor, admin; contributors see their own submitted items under My work).
Publishing: All content, New story, Editions / quarters, Sections, Categories.
Media: Media library, Upload media, Videos.
People: Contributors, Staff.
Administration: Navigation and homepage settings, Users and roles (admin), Activity log (editor, admin), Site settings, User guide.

## 7. Staging

A. Admin shell and theme, sidebar, overview, review queue, content list, the two server-action fixes above.
B. Editor: writing area and publishing panel, searchable block inserter, move up/down alternative to drag, unsaved-change guard, desktop/mobile preview.
C. Media library: list view, filters, dimensions at upload, duplicate warning in the single upload, usage and edition view.
D. Editions workspace and detail.
E. Restyle the remaining managers; accessibility pass.
Schema-dependent items (evergreen flag, quarter fields, media title/description, reviewer notes, featured video setting) wait for approval.

## 8. Testing limits
No Supabase instance is available here (Docker images are blocked). Planned: typecheck, lint, build with a throwaway local font, and a mock Supabase HTTP server with fictional fixtures for rendering and keyboard checks. Server actions are not exercised against a real database. Every write path remains unverified until run against a verified isolated environment.

## 9. Status after stages A to D (implemented on this branch)

Implemented and wired to the existing server actions and RLS-scoped queries:
- Light admin theme scoped to `.admin-theme` (public site and login unchanged), grouped role-aware sidebar, mobile drawer, skip link.
- Overview (live counts, active edition, my work, scheduled, stalest drafts, activity), Review queue (`/admin/review`), My work and edition/sort filters on All content, confirmation dialogs, Videos list (read-only).
- Story editor: Publish panel with status, readiness checklist and role-aware actions; searchable block inserter; move buttons and drag; collapse; undo remove; per-block "needs attention"; unsaved-change guard; Ctrl/Cmd+S; success text only after the server action returned without an error; preview in a new tab or phone-size window.
- Media library: grid and list, search, visibility/type/edition filters, sort, orientation and size, usage, private/public clearly marked, duplicate warning before upload, dimensions recorded at upload, edit alt text and caption, promote and delete only for administrators.
- Editions workspace (`/admin/publications`, `/admin/publications/[id]`): per-edition live counts, readiness, stories, sections, media, edit, make active (admin), delete with usage warning.
- Fixes: list Publish readiness check, review-to-draft audit label, new `return-to-draft` intent, search-filter sanitising for content and media, edition `published_at` no longer re-stamped on every save.

Not implemented, with the reason:
- Evergreen flag, quarter and period fields, DB-level "needs an edition", media title and description, reviewer notes, featured-video setting, manual media-to-edition association: need schema changes (proposed in `proposed-migrations/`, not applied, awaiting approval). Until then "no edition" cannot be told apart from "evergreen".
- Autosave: not added. A server save writes revisions and audit rows, so autosave would create noise; explicit save with an unsaved-changes guard is used instead.
- Touch drag-and-drop: the move buttons are the accessible alternative.
- In-page preview frame: `X-Frame-Options: DENY` is set site-wide; allowing same-origin framing for the preview route is a header change left for approval.
- Staff Spotlight and Birthday forms keep their own forms and do not have the new Publish panel yet.
- Contributors, Staff, Sections, Categories, Navigation, Users, Settings and Activity pages get the new theme and sidebar only; their layouts are not redesigned (stage E).
- Mobile and tablet: layouts were checked in Chromium at 1440 and 390 wide only.

Verification (run, with the output seen): `tsc --noEmit` clean, `eslint` clean, `next build` succeeds (with a local font standing in for the blocked Google font). Rendered against a mock Supabase server with fictional data: axe found no violations on the new screens at 1440 and 390 for an editor and a contributor, and scripted keyboard and mouse checks passed (block inserter, move, undo, unsaved-change guard, Ctrl+S, refused save showing an error and no success text, media dialog, filters).
Not verified: any real database, RLS behaviour, real uploads and storage, scheduled publishing, Safari and Firefox, screen readers. The mock does not implement RLS, so contributor scoping and permission refusals were only checked where the UI itself decides.

## 10. Featured video (HR, Dare, CJ)

Prototype: `prototype/springboard-compact-home.html` now features HR (`hIW7FrWtcHE`, 16:9) first, with Dare (`jkEu3O_fX94`) and CJ (`V4g-MVnRom8`) as 9:16 selectable features. Each keeps its native ratio, shows a named play button (44px+ target), the title, an optional caption and a "Watch on YouTube" link, and mounts the `youtube-nocookie.com` player only after a click. Ids are validated with the same pattern as `lib/video/youtube.ts`.

Placeholders, not supplied: titles are the names given (HR, Dare, CJ), captions are empty, and quarter is assumed to be 2026 Q3 for all three. Confirm or correct.

Data model (no new table): a video is a Video block inside a story; its quarter is that story's edition (`content.publication_id`). Making a new quarter active changes only `site_settings.default_publication_id`, so older editions keep their videos. The only thing that needs storing is which video is featured: `proposed-migrations/M4_featured_video.sql` (two nullable columns on `site_settings`, admin-only write inherited from the existing policy). NOT applied. Until approved there is no admin control for it and the real homepage cannot persist a choice; no mock control was added.

Privacy decision needed: the existing `YouTubeEmbed` deliberately never loads YouTube's own thumbnail (it would contact Google before the visitor chooses to play), and uses an editor-chosen Media Library image instead. The request asks for YouTube thumbnails, so the prototype loads `i.ytimg.com/vi/<id>/hqdefault.jpg` with `referrerpolicy=no-referrer`. Alternatives: staff cache each thumbnail into the Media Library once (upload, so not done here), which keeps the current no-contact behaviour. Also, `hqdefault` is 4:3 and will look low-resolution cropped to 9:16.

Checks: `checks/verify-featured-video.cjs`, 76 assertions at 1440/1024/768/390, all passing, fully offline (YouTube hosts intercepted). They prove ratios, no overflow, selector state, keyboard activation and player host. They do NOT show real thumbnails or real playback: this sandbox cannot reach YouTube, so real titles, thumbnails, embeddability and orientation were not checked.

## 11. Real homepage (replaces the HTML prototype)

`src/app/page.tsx` now renders the compact homepage from CMS data: `FeaturedVideoPanel` (reuses `YouTubeEmbed`; 16:9 or compact 9:16; YouTube poster with no referrer; `youtube-nocookie.com` player only on click; selectable videos) beside `EditionPanel` (active edition, counts, newest stories). Data: `getActiveEdition`, `getHomeVideos`, `pickFeaturedVideo` in `lib/content/queries.ts`, all through public RLS, no new tables and no schema change. A video's quarter is its story's edition; switching the active edition leaves older videos in place. The lead video is the newest in the active edition until M4 (not applied) stores an admin pick; `pickFeaturedVideo` already accepts that id. Scoped light theme in `components/home/home-theme.css`; other public pages are unchanged.

Not done: the rest of the homepage below the hero still uses the existing dark-site templates re-coloured (large lead story and banner), so it is not yet compact; archive filters; other public templates; admin featured-video control (needs M4).

Verified (run, output seen): `tsc --noEmit` clean, eslint clean, `next build` succeeds (throwaway copy, local font), `checks/verify-home-featured-video.cjs` 76/76 against the dev server on the fictional-data mock at 1440/1024/768/390 (HR 16:9; Dare and CJ 9:16 at most 530px and 72% of viewport height; no overflow; keyboard play; player host only youtube-nocookie.com after click). Not verified: real thumbnails or playback (sandbox cannot reach YouTube), real Supabase/RLS, Safari/Firefox, screen readers.

Q3 content and photos: `docs/redesign/q3-2026-seed/` (manifest + 16 renamed photos), not applied anywhere.
