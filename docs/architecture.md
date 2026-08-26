# Springboard Digital — Architecture

Status: foundation phase. No visual design has been built and no real or
fake editorial content exists anywhere in this repository or its database.
This document describes the system that the visual site and CMS will be
built on top of, and reflects what's actually implemented, not just planned.

## 1. System Architecture

Two sources of truth, deliberately kept separate:

- **GitHub** owns application code, UI components, the design system,
  database migrations, and this documentation.
- **Supabase** owns live editorial content, users/auth, media metadata,
  publication status, authors, staff, categories, and tags.

The Next.js app never hardcodes editorial content. Every page is a query
against Supabase, rendered through a small set of reusable components keyed
off `content_type` (see §4, §9). This is what makes the CMS addable later
without a frontend rewrite: the frontend already only knows how to render
*structured content*, never specific articles.

```
GitHub (this repo)                 Supabase (project)
├─ Next.js app                     ├─ Postgres (13 tables, RLS)
├─ design tokens                   ├─ Storage (media-public, media-private)
├─ supabase/migrations/*.sql  ───► ├─ Auth (profiles.role: admin/editor/
└─ docs/                           │        contributor/viewer)
                                    └─ live editorial content (empty for now)
```

## 2. Frontend Architecture

Stack: Next.js (App Router, `src/` layout), React, TypeScript, Tailwind CSS
v4, Framer Motion. Package manager: npm (pnpm was the original preference,
but this machine can't create pnpm's global shim under `C:\Program
Files\nodejs` without elevated permissions — npm was used instead; either
works, this is not a structural decision).

**Content-type registry** (`src/content-types/registry.ts`) is the single
extensibility point. It maps every `ContentType` to a `{ Template, Card,
metadataSchema }` triple:

```ts
export const contentTypeRegistry: Record<ContentType, ContentTypeConfig> = {
  ARTICLE: { Template: ArticleTemplate, Card: ArticleCard, metadataSchema: articleMetadataSchema },
  EVENT:   { Template: NewsTemplate,    Card: NewsCard,    metadataSchema: eventMetadataSchema },
  // ...one entry per content_type
};
```

Routes and section rendering resolve components through this map — never
through a switch/if-chain on `content_type` scattered through the app.
Adding a 9th content type later is: one DB enum value, one metadata zod
schema, one Template + Card component, one registry entry. Nothing about
routing or data-fetching changes.

Current Template/Card mappings are placeholders reusing a small set of
generic components until each type gets a dedicated design:
`EDITOR_NOTE`/`ARTICLE`/`HEALTH_TIP` → `ArticleTemplate`/`ArticleCard`;
`COMPANY_NEWS`/`EVENT`/`GALLERY` → `NewsTemplate`/`NewsCard`;
`STAFF_SPOTLIGHT`/`BIRTHDAY` → `SpotlightTemplate` or `ArticleTemplate` with
`StaffProfile`. See the comment block in `registry.ts` for the current
mapping and rationale.

**Body rendering.** `content.body` is a versioned JSON block document (§4),
not markdown or HTML. `src/components/blocks/BlockRenderer.tsx` dispatches
each block to its own component (`ParagraphBlock`, `HeadingBlock`,
`ImageBlock`, `GalleryBlock`, `QuoteBlock`, `StatisticBlock`, `VideoBlock`,
`CalloutBlock`, `RelatedContentBlock`) by `block.type`, mirroring the
content-type registry's pattern one level down. Media/related-content
references inside blocks are resolved by the caller in one batch query and
passed in as `mediaMap`/`relatedContent` — block components never fetch.

**Design tokens** (`src/design-system/tokens/`). Tailwind v4 is CSS-first:
utility classes are generated from CSS custom properties declared in an
`@theme` block, so `theme.css` (imported from `globals.css`) is the single
source of truth for color/typography/spacing/radius/shadow/motion values —
components use Tailwind classes (`bg-primary-500`, `rounded-lg`,
`shadow-editorial`), never raw hex/px values. This replaces the
`tailwind.config.ts` + JS preset approach from the original proposal, which
doesn't apply to Tailwind v4's config model. A parallel set of `.ts` files
(`colors.ts`, `typography.ts`, etc.) re-exports the same tokens as `var(...)`
strings for the rare non-Tailwind context (inline SVG, canvas) plus a
`motion.ts` with numeric duration/easing values Framer Motion needs directly
(hand-kept in sync with `theme.css` — noted in that file's comments).

The palette, type scale, and motion values currently in `theme.css` are
**placeholders** establishing the token *categories* (primary/secondary/
accent/neutral/feedback colors, display/body/mono type, spacing/radius/
shadow/motion scales) — real Springboard brand colors, approved typefaces,
and a logo have not been supplied yet. Swapping them in later is a
`theme.css` edit; no component should need to change.

**Motion.** Framer Motion only — GSAP was deliberately not installed.
Everything in the current component list (`PageTransition`, `ScrollReveal`,
card→template hero transitions) is a Framer Motion strength (React-aware
mount/unmount, `layoutId`); shipping both libraries for overlapping
capability would violate "no unnecessary dependencies." Add GSAP later,
narrowly scoped, only if a specific interaction genuinely needs it.

## 3. Supabase Architecture

Three Supabase client trust boundaries (`src/lib/supabase/`):

- `client.ts` — anon key, browser, for Client Components.
- `server.ts` — cookie-aware, for Server Components/Route Handlers; subject
  to RLS as the signed-in user.
- `admin.ts` — service-role key, bypasses RLS entirely. Guarded with a
  `typeof window !== "undefined"` runtime check so it throws immediately if
  ever imported into client-bundled code. Reserved for privileged
  server-only operations the future CMS will need (e.g. the media
  private→public promotion described in §6).

Schema is defined exclusively by the 14 files in `supabase/migrations/`
(listed in §4/§6/§7 below by what they do) — Supabase Studio is never used
to hand-edit schema. `src/lib/supabase/types.ts` is generated output
(`npx supabase gen types typescript --local > src/lib/supabase/types.ts`),
regenerated whenever a migration changes the schema; it's never hand-edited.

**Local dev note:** this machine's Windows/Hyper-V network stack reserves
the entire 54280–54380 dynamic port range that Supabase CLI defaults to
(`api`, `db`, `studio`, etc. all land in it), which made `supabase start`
fail to bind. `supabase/config.toml` shifts every local port from the
`54xxx` block to `20xxx` (verified clear via `netsh interface ipv4 show
excludedportrange protocol=tcp`). This only affects local ports; it has no
bearing on a hosted Supabase project's URLs.

## 4. Content Model

13 tables (12 from the original brief + `content_staff`, justified below):

`profiles`, `publications`, `sections`, `content`, `authors`, `staff`,
`staff_spotlights`, `spotlight_questions`, `media`, `categories`, `tags`,
`content_tags`, `content_staff`.

**`content`** is the polymorphic core — every `EDITOR_NOTE`, `ARTICLE`,
`COMPANY_NEWS`, `EVENT`, `STAFF_SPOTLIGHT`, `BIRTHDAY`, `HEALTH_TIP`, and
`GALLERY` row lives here, distinguished by `content_type`. Two JSON columns
carry the polymorphism instead of one table per type:

- **`body jsonb`** — `{ version: 1, blocks: Block[] }`, the versioned block
  document from §2. Schema/types live in `src/content-types/blocks/`.
  `version` exists so a future block-shape change ships as an
  `upgradeDocument()` step, not a destructive rewrite. Block references
  (`mediaId`, `contentIds`, ...) are plain UUID strings, not Postgres
  foreign keys — validated for well-formedness by zod, soft-failed (render
  nothing) at read time if stale. This is the one place in the schema that
  trades FK-enforced integrity for flexibility; everywhere else uses real
  foreign keys.
- **`metadata jsonb`** — type-specific scalar fields (an `EVENT`'s
  `eventDate`/`location`, a `HEALTH_TIP`'s `source`), validated against the
  content-type's registered zod schema (`src/content-types/schemas/`) at the
  application layer. Types with genuine repeating/ordered child data get a
  real table instead (see `staff_spotlights`/`spotlight_questions` below) —
  metadata is only for a handful of scalars.

**Slug uniqueness** is publication-scoped: `unique (publication_id, slug)`
on `content`, so e.g. one `editor-note` slug per issue. Evergreen content
(`publication_id is null`) isn't covered by that constraint — Postgres
treats every `NULL` as distinct — so a partial unique index,
`unique (slug) where publication_id is null`, closes that gap separately.

**`sections`** are per-publication, editor-orderable, relabelable groupings
(`title`, `display_order`), not a fixed global taxonomy — one issue's
"Company News" section can be retitled or reordered without a code change,
and a section can mix content types freely.

**`GALLERY`'s images** are `media` rows with `content_id` set to the gallery
content row and an explicit `display_order` — not a separate join table.
`media` already models "one or more files attached to a content row," so it
covers both a single cover image and a full ordered gallery identically.

**`content_staff`** (`content_id`, `staff_id`, `role`) is the one table
added beyond the original 12: `BIRTHDAY` entries and general staff mentions
need to reference *one or more* staff members with real referential
integrity (cascading on staff deletion, joinable from a staff profile page)
— a JSONB array of staff IDs on `content` couldn't do either.

**Full-text search.** `content.search_vector` is a generated `tsvector`
column built from `title`, `summary`, and a flattened extraction of the
block document's text-bearing fields (`extract_block_text()`, an immutable
SQL function — see `20260812010700_content.sql`), indexed with GIN. This
covers `Search` for launch without a hosted search product.

## 5. Publishing Workflow

Status enum: `draft → review → scheduled → published → archived`. Role enum:
`admin`, `editor`, `contributor`, `viewer`.

| | admin | editor | contributor | viewer |
|---|---|---|---|---|
| Read published | ✓ | ✓ | ✓ | ✓ |
| Read/edit own draft/review | ✓ | ✓ | ✓ (own only) | — |
| Create content | ✓ | ✓ | ✓ (as `draft`, self) | — |
| Submit for review | ✓ | ✓ | ✓ (own) | — |
| Publish/schedule/archive | ✓ | ✓ | — | — |
| Hard delete | ✓ | — | — | — |

A contributor's write access is scoped by RLS itself (`created_by =
auth.uid()` and `status in ('draft','review')`), not just application logic
— even a compromised or buggy client can't escalate past that.

**No automation is wired up in this phase**, by explicit direction:
`scheduled → published` transitions and cache revalidation are not driven by
`pg_cron`, `pg_net`, or a database webhook yet. What *is* in place, so this
is addable later without a schema change:

- Visibility is already correct without automation: every public RLS policy
  checks `status = 'published' OR (status = 'scheduled' AND publish_at <=
  now())`, so scheduled content becomes visible the instant its time passes,
  with zero leakage window — the missing piece is only that the stored
  `status` value doesn't flip itself, so an editor dashboard filtering on
  `status = 'published'` would need to also account for eligible `scheduled`
  rows until that automation exists.
- `src/app/api/revalidate/route.ts` exists as an inert `501` stub — the
  intended target for a future trigger, not called by anything yet.

**Loading real editorial content today, before the CMS exists (§9).** There
is deliberately no seed file for this — `supabase/seed.sql` is intentionally
empty and auto-runs on every `db reset` (must never carry content, dev or
real); `supabase/dev-seed.sql` is explicitly local-dev-only fixture data,
never run against a real project. Real content is inserted directly against
the hosted Supabase project's Postgres (Studio's SQL editor, or `psql`/the
Management API with appropriate credentials — never checked into git),
following the schema in §4:

1. Upload the file to the `media-public` Storage bucket, then insert a
   `media` row referencing its `storage_path` with `bucket = 'public'` —
   skipping the private→public promotion step in §6 by uploading straight to
   public, since there's no draft-review UI yet to justify starting private.
2. Reuse or insert the `authors` / `categories` / `publications` / `sections`
   rows the content belongs to (all idempotent — a publication/section/
   author is typically created once, reused by many `content` rows).
3. Insert the `content` row itself with `status = 'published'`,
   `published_at = now()` (or a real past/scheduled timestamp), and
   `cover_media_id` / `author_id` / `category_id` / `section_id` pointing at
   the rows above.
4. No application code changes are needed for any of this — confirmed as
   part of the 2026-08-13 production-readiness audit: every page already
   reads through the generic Supabase queries in `src/lib/content/queries.ts`
   with no dev-seed-specific branching anywhere in `src/`.

## 6. Media Strategy

Two Storage buckets (`20260812011200_storage_buckets.sql`), matching the
`media_bucket` enum on the `media` table:

- **`media-public`** — public read. Published content's media, plus
  evergreen public-facing images (`publications.cover_media_id`,
  `authors.avatar_media_id`, `staff.photo_media_id`).
- **`media-private`** — no public read. Draft/review media. Readable only by
  an authenticated `contributor+` session via `getSignedPrivateUrl()`
  (`src/lib/storage/buckets.ts`).

The database stores only metadata/references (`storage_path`, `bucket`,
`mime_type`, `width`, `height`, `original_filename`, ...) — no binary data
in Postgres.

**Private → Public promotion (built, Phase 4B, 2026-08-15).** New uploads
land in `media-private` by default. `promoteMediaAction`
(`src/lib/admin/media-actions.ts`) is the *only* sanctioned path from there
to `media-public`, and follows a strict copy-then-flip sequence so a failure
partway through never leaves the database claiming an object is public when
it isn't:

```
1. Download the object from media-private
2. Upload it to media-public at the same storage_path
3. Verify the public object is actually listable
4. Update media.bucket = 'public'  (only now is anything publicly reachable)
5. Best-effort delete of the old media-private copy (failure tolerated —
   an orphaned private object is harmless; a public row pointing at
   nothing is not)
```

The row's `id` and `storage_path` never change — every existing reference
(`cover_media_id`, `avatar_media_id`, a block's `mediaId`) keeps resolving
through the same row, so promotion is invisible to every consumer except
`getPublicUrl()` starting to return a real URL instead of `null`.

**Why this can't be shortcut as a bare `UPDATE`:** `media.bucket` is
protected by a `BEFORE UPDATE` trigger, `prevent_media_bucket_change`
(`20260814010000_media_admin_only_delete_and_promote.sql`) — the same
pattern as `prevent_role_self_escalation` (§7) — that rejects any change to
`bucket` from a non-admin session. Promotion is also gated admin-only at
the application layer in `promoteMediaAction` itself. Both layers exist
because the table-level `media_update` policy is `contributor_or_above` (so
contributors can edit their own uploads' metadata), which would otherwise
let a contributor flip `bucket` directly without ever touching Storage —
exactly the inconsistent state this design avoids.

**Replacement** (`replaceMediaAction`) swaps the underlying file while
keeping the row's `id`: upload the new file to a fresh path in the row's
*current* bucket, repoint the row at it, then best-effort delete the old
object. Replacement never changes public/private status — replacing a
public image keeps it public, replacing a private one keeps it private;
promotion is a separate, deliberate step.

**Deletion** (`deleteMediaAction`) is admin-only (§7). Before a delete is
confirmed, `getMediaUsageAction` checks `content.cover_media_id`,
`authors.avatar_media_id`, `publications.cover_media_id`, and scans
`content.body` blocks for `mediaId`/`mediaIds` references, so the UI can
warn ("used by N items") before an admin chooses "Delete anyway." The DB
row is deleted before the Storage object (unchanged from the original
design — an orphaned Storage object is inert, a DB row pointing at a
missing object is not); FK columns are `on delete set null`, and body-block
references to a deleted media id simply resolve to nothing
(`resolveBodyReferences` already treats an unresolvable id as absent, not
an error).

## 7. Security Model

Every table has RLS enabled (`20260812011100_rls_policies.sql`), backed by
three `SECURITY DEFINER` helper functions in
`20260812010200_role_helpers.sql` (`is_admin()`, `is_editor_or_admin()`,
`is_contributor_or_above()`) so role logic lives in one place instead of
being repeated per policy. A companion migration,
`20260812011150_grants.sql`, grants the base table-level `SELECT`/`INSERT`/
`UPDATE`/`DELETE` privileges RLS depends on — Postgres requires that coarse
GRANT before RLS's per-row filtering is ever evaluated; without it every
query 42501s regardless of policy. This was caught by the verification step
in §10, not anticipated in the original schema design, and is worth
remembering for any future hand-written migration.

Public/anon can only ever read published (or time-eligible scheduled)
content, plus non-sensitive reference data (`authors`, active `staff`,
`categories`, `tags`) and non-content-linked `media`. `profiles` is private
(self or admin only) — a `handle_new_user` trigger auto-creates a `viewer`
profile row for every new `auth.users` signup.

Storage policies on `storage.objects` mirror this: `media-public` objects
are readable by anyone, `media-private` objects only by `contributor+`.

**Media & user permission matrix (Phase 4B, 2026-08-15):**

| Action | Public/anon | Contributor | Editor | Admin |
|---|---|---|---|---|
| View public media | ✅ | ✅ | ✅ | ✅ |
| View private media | ❌ | ✅ (own session, signed URL only) | ✅ | ✅ |
| Upload media (lands private) | ❌ | ✅ | ✅ | ✅ |
| Edit media metadata (alt/caption) | ❌ | ✅ | ✅ | ✅ |
| Replace a media file | ❌ | ✅ | ✅ | ✅ |
| Promote private → public | ❌ | ❌ | ❌ | ✅ |
| Delete media | ❌ | ❌ | ❌ | ✅ |
| View `/admin/users` | ❌ | ❌ | ❌ | ✅ |
| Change a user's role | ❌ | ❌ | ❌ | ✅ (never the last admin) |

Promotion and delete are deliberately admin-only rather than following the
`editor_or_admin` pattern used for other staff-level writes elsewhere in
this schema (content publish, taxonomy) — both are enforced twice: once in
the calling Server Action (`getAdminSession().role === "admin"`), and once
at the real boundary (`media_delete` RLS policy, `prevent_media_bucket_change`
trigger — both in `20260814010000_media_admin_only_delete_and_promote.sql`).
User-role management reuses `profiles_update_own_or_admin` (§9's original
role architecture) unchanged, plus one addition: `updateUserRoleAction`
(`src/lib/admin/user-actions.ts`) refuses to demote a profile's role away
from `admin` if doing so would leave zero admins — a plain `count(*)` check
before the write, not a schema-level constraint, since "last admin" isn't
expressible as a row-level RLS predicate.

`/admin/users` reads emails via `list_profiles_with_email()`, a
`SECURITY DEFINER` function (`20260814000000_media_filename_and_user_listing.sql`,
corrected in `20260814020000_fix_list_profiles_with_email_types.sql`) that
joins `profiles` to `auth.users` — a schema PostgREST doesn't expose
directly. The function enforces `is_admin()` internally before returning
any rows, so it's safe to grant `EXECUTE` to every authenticated user
rather than relying on the caller to gate access correctly.

## 8. Deployment Strategy

Not yet deployed. Recommended target: Vercel, the natural fit for Next.js
App Router (ISR, image optimization, edge). Supabase project (hosted) holds
the live database/auth/storage; `supabase db push` (or CI running the
migrations) applies `supabase/migrations/` to it. Environment variables
(`.env.local.example`) are the only place Supabase config is referenced —
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public),
`SUPABASE_SERVICE_ROLE_KEY` (server-only, never `NEXT_PUBLIC_`-prefixed).

### Production readiness audit (Phase 4E, 2026-08-15)

Full findings, environment-variable matrix, migration/UAT/deployment/
rollback procedures, and launch blockers are the dedicated deliverable of
this phase (see the chat report / published artifact) — this subsection
covers only what changed in the codebase itself and the headline
architectural facts worth having in this file permanently.

**Nothing was deployed.** This remains a local-only project: no GitHub
push, no Vercel project, no hosted Supabase project, no real domain. Every
finding below is from static/local audit, not a live environment.

**Fixes made this phase** (all additive, none touch a protected component):
- `src/app/robots.ts` + `src/app/sitemap.ts` — neither existed before.
  Sitemap reads through `getSitemapEntries()` (`src/lib/content/queries.ts`),
  which uses the same RLS-scoped client as every public page — draft/
  future-scheduled/archived content is excluded by the same RLS that keeps
  it off the site itself, not a second manual filter. Returns an empty
  sitemap (not a guessed host) while `NEXT_PUBLIC_SITE_URL` is unset.
- `next.config.ts` gained a `headers()` function: `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, and
  HSTS. A strict Content-Security-Policy was deliberately **not** added —
  it needs real allowlisting against this app's actual sources and testing,
  not a guess; flagged as a post-launch hardening item.
- Two real accessibility defects, found by automated audit, fixed: the
  homepage had zero `<h1>` elements (every other page type already had
  exactly one, via `Hero` or its own inline heading) — fixed with a
  visually-hidden `<h1>` on the homepage rather than promoting
  `FeaturedStory`'s heading, since that component is also nested
  repeatedly inside `EditorialSection` on the publication page and
  promoting it there would have created duplicate `<h1>`s instead. The
  block editor's "add block" type `<select>` had no accessible name —
  fixed with `aria-label`.

**Confirmed clean by this audit** (no code changes needed): service-role
key usage is isolated to exactly `src/lib/supabase/admin.ts` and its one
legitimate consumer, the cron route — verified by grepping the whole `src`
tree, not just reading the two files in isolation. Every `public.*` table
has RLS enabled (`relrowsecurity = true`, checked directly against the
live local database, not just migration source). Live policy set (40 on
`public.*`, 8 on `storage.objects`) matches what the migration history
should produce — including confirming `media_write` (an early, later-
superseded policy) is genuinely absent from the live database, not just
overwritten in source. Every `SECURITY DEFINER` function sets an explicit
`search_path`. `supabase/seed.sql` (the only file wired into `db reset`'s
auto-seed) is genuinely content-free. Preview security
(`src/app/admin/content/[id]/preview/page.tsx`) requires a session and
reads through the RLS-scoped client, so an authenticated-but-unauthorized
viewer gets a clean 404, not the content — verified with a real
contributor session against another user's draft, not just read from the
policy text.

**Launch blockers identified, not fabricated:** no production Supabase
project exists; no real PHD content or media has been supplied (dev-seed
data only); no official PHD/Springboard logo, favicon, or OG image has
been supplied. All three are documented as blockers rather than worked
around with invented substitutes.

## 9. Editorial Admin (CMS)

Built 2026-08-13, under `/admin` (`src/app/admin/`). Reuses every piece of
architecture this section used to describe as "what a future CMS would
build on" — no new tables, no second content model, no second media system.

- **Auth.** Supabase Auth's own email/password flow — nothing custom.
  `src/app/admin/login/page.tsx` calls `supabase.auth.signInWithPassword()`.
  There is deliberately no admin self-signup: creating the *first* account
  is a one-time manual step (below), since a public "become an editor" form
  would itself be an exposure surface.
- **Route protection.** `src/app/admin/(protected)/layout.tsx` redirects to
  `/admin/login` if there's no session or the profile's role is `viewer`.
  This is a UX convenience only — see the next point.
- **The real security boundary is RLS, not the UI.** Every admin mutation
  (`src/lib/admin/*-actions.ts`) runs as a Server Action through the same
  cookie-based, RLS-subject client every public page uses
  (`src/lib/supabase/server.ts`) — never the service-role client. A
  `contributor` session can create/edit their own drafts; only
  `editor`/`admin` can publish, edit others' content, or write taxonomy;
  only `admin` can hard-delete — all of that was already true from §7/§5's
  RLS policies, unchanged. A bug in the admin UI that showed a button it
  shouldn't have would still be rejected by the database.
- **Content editor.** `src/components/admin/ContentForm.tsx` +
  `BlockEditor.tsx` write directly into `content.body`'s existing
  versioned block-document shape — the same shape `BlockRenderer` (the
  public renderer) already consumes, validated on save against the same
  `bodyDocumentSchema` zod schema the public site parses with. No second
  body format.
- **Preview.** `src/app/admin/content/[id]/preview/page.tsx` fetches a
  draft by id (`getContentByIdForPreview`, RLS lets its own
  author/editor/admin see it) and renders it through the *same*
  `ArticleTemplate`/`NewsTemplate` the public route uses via the content-
  type registry — not a second preview renderer.
- **Media Library** (`/admin/media`). `src/lib/admin/media-actions.ts` +
  `MediaLibrary.tsx`. Uploads land in `media-private` by default and are
  explicitly promoted to `media-public` — see §6 for the full
  private→public promotion contract, replacement, and usage-checked delete
  behavior (Phase 4B, 2026-08-15). If the DB insert fails after a
  successful Storage upload, the action deletes the orphaned object rather
  than leaving it. `MediaPicker.tsx` is the one reusable "choose an image"
  component embedded in `ContentForm` (cover), `BlockEditor` (image/gallery
  blocks), `AuthorForm` (portrait), and `PublicationManager` (cover) — a
  single media selection surface, not one per feature.
- **Users** (`/admin/users`, admin-only). `src/components/admin/UserManager.tsx` +
  `src/lib/admin/user-actions.ts`. A minimal role-management UI over the
  existing `profiles.role` architecture (§7) — no new identity system, no
  new role values.
- **Admin client.** `src/lib/supabase/admin.ts` (service-role, bypasses
  RLS) is **not used anywhere in `/admin`**, including the Users page —
  reading `auth.users` for emails goes through `list_profiles_with_email()`
  (§7), a `SECURITY DEFINER` Postgres function, not the service-role
  client. Every mutation here is still a normal authenticated user's own
  RLS-scoped write.

### Content lifecycle (Phase 4A, 2026-08-14)

No new status values — `content_status` already had exactly what this
needs (`draft`, `review`, `scheduled`, `published`, `archived`, from the
original schema). Every transition below is a plain `status` (+
`published_at` on the way to `published`) update on the *same* row —
nothing is ever duplicated or re-created:

```
                ┌────────────┐
    Restore ──▶ │   DRAFT    │
        ▲       └─────┬──────┘
        │             │ Publish
        │             ▼
   ┌────┴─────┐  ┌────────────┐
   │ ARCHIVED │  │ PUBLISHED  │
   └────▲─────┘  └─────┬──────┘
        │  Archive      │ Unpublish
        └───────────────┘
```

Preview is reachable from every state (draft, published, and archived
alike) — `content_select_own`/`content_select_staff` (§7) don't filter by
status at all, only by ownership/role, so there's nothing extra to build
for that; the same `getContentByIdForPreview` call just works regardless
of where the row currently sits in the diagram above.

Restoring an archived item lands it back in `draft`, never straight to
`published` — matching "an editor explicitly chooses to publish" rather
than an archive accidentally being one click from live again. Both
`unpublish` and `restore` reuse the identical `status = 'draft'`
transition under the hood (`setContentStatusAction`/`saveContentAction`'s
`intent` values differ — `"unpublish"` vs `"back-to-draft"` — purely so
the UI can label the button correctly for where the content is coming
from); there's no third "restored" status to track separately.

Editing already-`published` content (`ContentForm`'s "Save changes" —
same `intent="save-draft"` as a fresh draft's "Save draft"; the button
label is the only thing that changes) updates the row in place and
**does not** change its status — publish/unpublish/archive/restore stay
separate, explicit actions, never an implicit side effect of saving.
"Save changes" on already-published content does re-check the same
minimum bar `publish` enforces (at least one block, a publication set) —
otherwise an edit that clears those would leave the row labelled
PUBLISHED while quietly broken/unreachable at its public URL.

### First-admin provisioning

There is no admin signup form by design. To get the first account:

1. Create the Auth user — via the hosted project's Supabase Studio
   (Authentication → Add user), or locally:
   `npx supabase auth admin create-user` targeting the local stack described
   in §10, or simply sign up once through `supabase.auth.signUp()` (e.g.
   Studio's "Add user" does this for you). `handle_new_user` (§1's profiles
   trigger) creates their `profiles` row automatically, defaulting to role
   `viewer`.
2. Promote them — run once, as the project owner, against the database
   directly (Studio's SQL editor, or `psql`):
   ```sql
   update public.profiles set role = 'admin' where id = '<their-auth-uid>';
   ```
   (This exact step was already documented in `supabase/seed.sql`'s header
   comment before `/admin` existed — nothing new here, just now it has a UI
   worth logging into.)
3. From there, that admin can promote further accounts through
   `/admin/users` (built Phase 4B, 2026-08-15) — step 2's raw SQL is now
   only needed for the very first account, before any admin exists yet.

### Media Library & User Management (Phase 4B, 2026-08-15)

Extends the CMS built in Phase 4A with the two pieces it deliberately
deferred: a real Media Library (upload/promote/replace/delete, all wired
into the existing `MediaPicker`) and a minimal Users page over the existing
role architecture. No new tables beyond one additive column
(`media.original_filename`, kept purely for display — the uploader's
original filename was previously discarded in favor of the generated
`uploads/<uuid>.<ext>` storage path) and no new roles. See §6 for the full
media lifecycle and §7 for the permission matrix and RLS changes.

A real defect was found and fixed during this phase's testing:
`MediaPicker`'s upload form was a nested HTML `<form>` inside whichever
outer form it was embedded in (`ContentForm`, `AuthorForm`,
`PublicationManager`) — invalid HTML, silently causing the *outer* form to
submit instead of running the upload. Fixed by making the upload button a
plain `onClick` handler that builds `FormData` manually rather than relying
on native form submission, matching how `promoteMediaAction`/`replaceMediaAction`
are already invoked from plain buttons elsewhere in the same component.

### People, Taxonomy & Editorial Administration (Phase 4C, 2026-08-15)

Closes the remaining gaps that would have required direct database access:
safe (usage-checked) deletion for People/Categories/Sections/Publications,
content counts in every taxonomy manager, a contributor's article list, and
one persisted editorial setting. No new roles, no new content model, no
changes to `authors`/`categories`/`sections`/`publications`' existing
shape — one additive table (`site_settings`, below).

**Editorial hierarchy** (unchanged, now fully manageable end to end):

```
PUBLICATION
    │
    ├── SECTION ── CONTENT
    └── SECTION ── CONTENT
```

`publications.status` (reusing `content_status`) is a publication's own
archive mechanism — already built in Phase 4A/4B, just newly paired with a
usage count ("N sections, N content") shown before delete.

**People.** `authors` remains the sole contributor model — no `is_active`/
status column was added. Two reasons: nothing else in the schema reads such
a flag (unlike `staff.is_active`, which `staff_select`'s RLS already
consumes), and public contributor pages/bylines render unconditionally
(`authors_select` is `using (true)`) — adding a column nothing enforces
would be a decorative no-op, exactly what this phase's brief says not to
build. Deletion (already existing, `deleteAuthorAction`) is the lifecycle
action instead, now usage-checked like the other taxonomy managers.
`/admin/contributors/[id]` also lists the contributor's articles (reusing
`listContent({ authorId })` — the same admin content query the Content
list page uses, not a duplicate).

**Slug stability.** No redirect mechanism exists in this codebase
(`next.config.ts` has no `redirects()`, no redirects table). Contributor
slugs stay freely editable, but `AuthorForm` now warns explicitly when a
contributor with existing articles has their slug changed: the public URL
changes immediately and the old one 404s, with nothing in place to bridge
it. Documented here rather than building a routing system for it, per the
brief's explicit "document the limitation" instruction.

**Safe deletion.** Every FK from `content` into `categories`/`sections`/
`authors`/`publications` is `on delete set null` (§4) — the database never
blocks a delete, it silently orphans the reference on any content that had
it. `SafeDeleteButton` (`src/components/admin/SafeDeleteButton.tsx`) is one
shared component used by all four managers: click Delete → a usage-check
Server Action runs (`getCategoryUsageAction`/`getSectionUsageAction`/
`getAuthorUsageAction`/`getPublicationUsageAction`, all in
`taxonomy-actions.ts`/`author-actions.ts`) → if referenced, show "used by
N…" and require an explicit "Delete anyway"; if not, delete proceeds
immediately. This is the same pattern Phase 4B established for media
deletion, generalized rather than re-invented per entity.

**Settings.** `site_settings` (`20260815000000_site_settings.sql`) is a
one-row singleton table (`id boolean primary key default true`) holding
exactly one field: `default_publication_id`. Every other candidate setting
named in the brief (site name, description, social links) was deliberately
*not* added — `Navigation.tsx`/`Footer.tsx` are explicitly off-limits this
phase, so those fields would have no consumer and be pure decoration,
which the brief's own "do not introduce arbitrary settings simply to
populate a settings page" instruction rules out. `default_publication_id`
has a real, immediate consumer: `ContentForm` pre-selects it for brand-new
content (never overriding an existing row's actual publication). Read is
`contributor+` (anyone who creates content benefits from the default);
write is `admin`-only, matching "ADMIN: full management of editorial
settings" — the only role that lists settings at all.

**Permissions.** No RLS changes were needed for categories/sections/
publications/authors — `categories_write`/`sections_write`/
`publications_write`/`authors_write` already required `editor_or_admin()`
for every operation, and `site_settings_write` (new) is `admin`-only,
matching the brief's model exactly: EDITOR manages taxonomy/people,
CONTRIBUTOR cannot, only ADMIN manages settings. Verified this holds by
testing with all three real accounts, not just reading the policy text.

### Editorial Governance, Audit Trail & Publishing Intelligence (Phase 4D, 2026-08-15)

Adds an audit trail, content revision history, and scheduled publishing on
top of the CMS built across Phases 4A–4C — no new content model, no new
roles, and (critically) no change to the existing `content_status` enum:
`scheduled` already existed and was already fully correct at the RLS
layer, just never surfaced or executed. Two new tables
(`audit_log`, `content_revisions`), one additive nothing to existing
tables.

**Audit log.** `src/lib/admin/audit.ts`'s `logAuditEvent()` is called by
every mutating Server Action (`content-actions.ts`, `media-actions.ts`,
`author-actions.ts`, `taxonomy-actions.ts`, `user-actions.ts`) immediately
after its mutation succeeds — never before, and never speculatively for a
mutation that might still fail. Deliberately **not** transactional with
the mutation it records: PostgREST's per-request model gives no
cross-table transaction to hook into without either (a) rewriting every
existing, already-tested mutation into a hand-written SQL function, which
this phase's "avoid unrelated refactoring / do not destabilize" instruction
rules out, or (b) a fragile client-side two-phase-commit approximation.
Instead, the audit write is best-effort: a failure is `console.error`'d
and swallowed rather than rolling back a mutation that already succeeded
or surfacing a confusing error to the editor for what is, functionally, an
observability record. In practice this is very low-risk — the same
authenticated session that just succeeded at the mutation is inserting one
more row under the same RLS a moment later — but it is a real,
consciously-accepted limitation, not an oversight.

RLS (`audit_log_select_admin`/`_editor`/`_insert`,
`20260816000000_audit_log.sql`): admin reads everything; editor reads
everything except `USER`/`SETTINGS` entity-type rows (role changes,
settings changes stay admin-only); contributor matches neither select
policy and sees nothing. Insert requires `actor_user_id = auth.uid()` —
the mechanism that stops a forged actor id, enforced at the database, not
just by application code choosing not to lie.

**Activity page** (`/admin/users`-style admin-only page,
`/admin/activity`). Filters: user, action, entity type, date range;
paginated 50/page. Actor names are resolved via `list_actor_profiles()`
(`20260816020000_audit_actor_names.sql`), a small `SECURITY DEFINER`
function in the same style as `list_profiles_with_email` (Phase 4B) — a
real gap surfaced during design, not implementation: `profiles_select_own_or_admin`
only lets a user see their own profile row unless they're admin, so a
plain embedded join would have silently shown every *other* actor's name
as blank to an editor viewing Activity. The function is editor/admin-gated
(not admin-only like `list_profiles_with_email`), matching editors' actual
access to the page itself.

**Content revisions.** Scoped to `ARTICLE`/`COMPANY_NEWS` only, in
application code (`content-actions.ts`'s `REVISIONED_TYPES`), not a schema
constraint. A revision snapshots the **post-save** state of every
successful edit to an *existing* row (nothing is written on first create —
the live row itself stands in for "revision zero"). Restoring a revision
(`restoreContentRevisionAction`) writes the chosen snapshot's editable
fields back onto the current row and deliberately leaves `status`
untouched — restoring an old draft-era snapshot must never silently
unpublish or republish something — and, because it goes through the same
update path as any other edit, produces its own new revision. History only
ever grows forward; nothing is destroyed by restoring.

**Scheduled publishing.** Reuses the existing `scheduled` status and
`content.publish_at` column exactly as they already were — no migration.
The single most important fact this phase's audit surfaced: **public
visibility was already correct before any of this was built.** Every
public content RLS policy already reads `status = 'published' OR (status
= 'scheduled' AND publish_at <= now())` (§5, unchanged since the
foundation phase) — a scheduled article becomes visible to anonymous
readers the instant its time passes, with zero leakage window, regardless
of whether anything ever flips the stored `status` column. What this
phase actually adds is the missing *administrative* half: a UI to set
`publish_at` and choose Schedule (`ContentForm`'s "Publishing" section —
previously the field existed in the schema and in `saveContentAction`'s
form-reading code, but nothing in the UI ever rendered an input for it,
so it was silently always null on every save), a Cancel Schedule path back
to `draft`, and a job that flips `status` to `published` + writes the
`PUBLISH` audit event once the time has passed, so admin views stop
showing stale "Scheduled" state for something that's already live to the
public. `mustStayPublishReady`'s block/publication checks (§9 above) were
extended to also apply when scheduling or saving already-scheduled
content, for the same reason they apply to published content: it becomes
publicly reachable with no further human action.

**Scheduler execution mechanism.**
`src/app/api/cron/publish-scheduled/route.ts` — the one legitimate use of
the service-role client (`src/lib/supabase/admin.ts`) anywhere in this
codebase's admin surface, because a cron trigger has no authenticated
session to be RLS-subject to; every other admin mutation still runs
through the cookie-based client. Authenticated via a bearer token
(`CRON_SECRET` env var, checked against `Authorization: Bearer <token>`);
responds 401 to a missing or wrong secret. Naturally idempotent: the query
only matches rows still literally in `status = 'scheduled'`, so a row this
job just published is never matched by a later run — no duplicate
content, no duplicate audit events, verified by running it twice back to
back in testing. **This route is not currently called by anything on a
timer** — no cron infrastructure is deployed (§8: this project isn't
deployed at all yet). `vercel.json` declares the intended production
trigger (`0 6 * * *`, once daily) against this route so it activates
automatically whenever this project is actually deployed to Vercel, per
that platform's [Cron Jobs feature](https://vercel.com/docs/cron-jobs)
(which invokes via GET and auto-attaches the `CRON_SECRET` bearer header
when that env var is set on the project — the route handles both GET and
POST for exactly this reason). The schedule is once daily rather than
every 5 minutes because Vercel's Hobby plan (this project is not on Pro)
rejects any Cron Job that would fire more than once per day — attempting
`*/5 * * * *` is refused outright at deploy time. Given §5's finding
below, a daily cadence has no public-safety consequence: public
visibility of scheduled content never depended on this job running at
any particular frequency. The only cost of the wider interval is that the
admin UI can show a stale "Scheduled" badge, and the `PUBLISH` audit
event/`published_at` timestamp can lag, for up to ~24h after an article's
`publish_at` passes (versus up to ~5min before) — the content itself is
already correctly live and public the entire time. If tighter admin-side
freshness is ever needed without upgrading to Vercel Pro, the job's
actual work (the `scheduled → published` flip + audit write) could move
to Supabase's `pg_cron`/`pg_net` extensions, which run on the database
itself on any schedule independent of Vercel — not wired up today because
nothing currently requires it (this route's logic is unchanged and would
still work as the manual/fallback trigger either way). Until deployed,
this is a real, secure, fully-functional endpoint with no live trigger —
invoked manually for testing, exactly as the brief's own testing section
describes.

**Review status.** Was already a valid `content_status` enum value with
full RLS support (`content_update_own_draft` already permitted a
contributor to move their own row between `draft`/`review`) but had no UI
trigger anywhere — confirmed unused before adding anything. Given how
small and already-supported the gap was, added one button
("Submit for review", `draft → review`) rather than a full approval
workflow, matching the brief's explicit "if implementation is
straightforward and consistent with existing permissions, it may be
included as a small extension" allowance. No reviewer-side UI, no
notifications, no reviewer assignment — review content is simply visible
to editor/admin the same way draft content already was.

**Dashboard.** Reframed around the brief's four governance questions
(what's happening / who changed it / what's scheduled / what needs
attention) rather than added to as a generic BI surface: "Recent
contributors" and "Recent media" (pure content-browsing shortcuts,
already one click away via their own list pages) were replaced with
"Recent activity" (the `ActivityTable` component, shared with
`/admin/activity`) and "Scheduled publishing" (soonest-first); "Drafts
needing attention" (stalest-`updated_at`-first) was added; "Recently
updated content" was kept. Stat tiles extended from 5 to 8: total content,
published, drafts, in review, scheduled, archived, contributors, media
assets — all real counts, no vanity metrics.

**Security review performed for this phase:** contributors cannot read
admin-only audit data (RLS, verified with a real contributor session, not
just policy inspection); contributors cannot forge actor ids
(`audit_log_insert`'s `WITH CHECK`); scheduled publication cannot be
triggered by an unauthorized caller (bearer-token check, verified with
both a missing and a wrong secret); revision records inherit content's own
own-row-or-staff visibility (`content_revisions_select`/`_insert`); public
users cannot access draft/scheduled/archived content (unchanged, existing
RLS, re-verified this phase); service-role credentials never reach client
code (verified — the cron route is the only server-side consumer of
`admin.ts` this phase adds, and `server-only` still makes importing it
from client-bundled code a build error).

### Production Supabase Provisioning + Team CMS Workspace (Phase 4F, 2026-08-15)

**Part A — Supabase production provisioning: stopped, by design.** No real
Supabase production project has ever existed for this project — every
phase, including this one, developed exclusively against the local
Docker-based CLI stack. Confirmed this phase, not assumed: no
`SUPABASE_*`/production credential in the shell environment, no
`.vercel` link, no `supabase/.temp/project-ref` (the CLI has never been
`supabase link`'d to a hosted project). A real GitHub remote *does* exist
(`PHD-Nigeria/springboard`, `main`, one commit — matches the brief's
description) but nothing has been pushed to it beyond that single commit
this whole engagement. Per explicit instruction, none of this was
invented; provisioning is documented as a checklist (chat report) awaiting
real credentials from the project owner, not attempted with placeholders.

**Part B — Team CMS Workspace**, built and tested against the local stack,
ready to carry forward once Part A unblocks:

- **Site Assets** (`/admin/settings/assets`, admin-only). Five named
  slots — PHD logo, Springboard wordmark, favicon, default social-share
  image, homepage artwork — each just a `MediaPicker` writing a media id
  into a new `site_settings` column. No second media system, no binary
  data in the database. Favicon and OG image are wired into
  `src/app/layout.tsx`'s metadata (which had to become an async
  `generateMetadata()` — Next only allows one of a static `metadata`
  export or `generateMetadata()`, and this needed to read the database).
  Homepage artwork is deliberately **not** wired into any layout slot —
  there isn't one yet, and inventing a placement for an asset nothing has
  supplied would be exactly the kind of unrequested redesign this phase
  rules out; the reference is saved and ready the moment a real asset and
  a placement decision both exist.
- **Homepage configuration** (`/admin/settings`). `featured_content_id`
  and `featured_author_ids` (ordered, 4-slot UI) let the CMS pick WHICH
  story leads and WHICH people appear; `FeaturedStory`/`ContributorCard`
  still control HOW. Both fall back to the pre-existing automatic
  behavior (most-recently-published, alphabetical-first-4) when unset —
  nothing changes for an admin who never touches this page. The featured
  pick is read back through `getContentById` (a new public-safe query,
  `src/lib/content/queries.ts`) — RLS-scoped exactly like every other
  public query, so a pick that's since been unpublished fails closed
  (falls back to recency), never leaks. `banner_title`/`banner_description`
  replace the homepage's two hardcoded `EditorialBanner` strings the same
  way. Explicitly **not** built: reordering the homepage's own sections
  (More Stories/People/News Bites) — the brief is explicit that the CMS
  controls WHAT, not a drag-and-drop page builder controlling HOW/WHERE.
- **SEO settings** extend `site_title`/`seo_default_description` into the
  same `generateMetadata()` already serving every page — a real, existing
  consumer, not a speculative field.
- **A real RLS change, not a weakening:** `site_settings_select`
  (previously `contributor_or_above`, correct when the table held exactly
  one admin-facing convenience field) is now `using (true)` — every field
  added this phase is read by anonymous visitors on every page load
  (homepage config, SEO metadata), the same public-read shape
  `categories`/`authors`/`tags` already use. `site_settings_write` is
  unchanged: still admin-only.
- **Navigation** (`Navigation.tsx`) — audited, deliberately left
  code-managed. Two links plus Search, tightly bound to specific homepage
  anchor ids (`#more-stories`, `#people`); a CMS-configurable nav risks an
  admin creating a link to an anchor that doesn't exist, or breaking the
  "restrained editorial header, not a dense app nav" intent the component's
  own comment already documents. Matches the brief's own escape hatch:
  document rather than build infrastructure a 2-item nav doesn't need.
- **Social links** (`Footer.tsx`) — audited: there currently are none.
  The footer has a wordmark, a description, same-page anchor links, and a
  copyright line — no LinkedIn/Instagram/X/YouTube URL has ever been
  supplied or approved. Building a configurable social-links system now
  would be infrastructure for zero actual links, and the brief is explicit
  not to add networks PHD hasn't approved. Documented, not built.
- **Role model** — audited against the brief's ADMIN/EDITOR/CONTRIBUTOR
  breakdown; the existing `AdminNav` role-filtering (from Phases 4B–4D)
  plus this phase's new admin-only gate on Site Assets already satisfies
  it. No restructuring needed — RLS was already the real boundary, this
  phase only added the same UX-convenience redirect pattern to one new page.
- **Documentation**: `docs/team-workflow.md` (editorial/media/people/
  taxonomy/admin how-tos, no code) and `docs/development-workflow.md`
  (Git branch/PR flow, secrets discipline, staging architecture — staging
  doesn't exist yet, documented as what's needed to create it).

Tested this phase: 80 Playwright checks (10 feature-specific — asset
upload→promote→select→verify in `<head>`, homepage featured-pick→verify
on the live public page, role-gated access to Site Assets — plus 70
full-regression covering all five breakpoints, motion, security, and every
pre-existing admin surface), all passing, zero console errors.

## 10. Verification (foundation phase)

- `npx supabase db reset` applies all 14 migrations cleanly from empty.
- `npx supabase gen types typescript --local` succeeds; output matches
  every table/enum in §4 (committed at `src/lib/supabase/types.ts`).
- Anon key: `select * from content` → `[]` (no error — RLS + grants both
  correct, table is genuinely empty); `insert into content (...)` → `42501`
  row-level security violation (write correctly blocked).
- Storage: `media-public` and `media-private` buckets exist with the
  correct `public` flags (confirmed via service-role key).
- No real or fake editorial content exists in the database or in git at any
  point in this phase.
