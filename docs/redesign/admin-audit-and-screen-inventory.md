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
