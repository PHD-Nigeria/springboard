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
`mime_type`, `width`, `height`, ...) — no binary data in Postgres.

**Promotion on publish:** when content moves to `published`, its media rows
must be copied `media-private → media-public` and `media.bucket`/
`storage_path` updated. This is specified as a contract for the future
publish action (part of the CMS, not built yet) to implement synchronously —
consistent with "no automation in this phase" from §5.

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

## 8. Deployment Strategy

Not yet deployed. Recommended target: Vercel, the natural fit for Next.js
App Router (ISR, image optimization, edge). Supabase project (hosted) holds
the live database/auth/storage; `supabase db push` (or CI running the
migrations) applies `supabase/migrations/` to it. Environment variables
(`.env.local.example`) are the only place Supabase config is referenced —
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public),
`SUPABASE_SERVICE_ROLE_KEY` (server-only, never `NEXT_PUBLIC_`-prefixed).

## 9. Future CMS Architecture

Not built in this phase. What's already in place for it to build on:

- **Schema.** `status`/`review` workflow, `contributor` role, and
  `created_by` ownership already model draft → review → publish. The CMS's
  job is UI + the publish action described in §6, not new tables.
- **Validation.** `content-types/schemas/*.ts` (metadata) and
  `content-types/blocks/schema.ts` (body) are the same zod schemas a CMS
  form would validate against — no duplicate validation logic to write.
- **Body editing.** `content.body`'s versioned block-document shape was
  chosen specifically so a future block editor (Tiptap/Slate-style) can be
  built against it directly, unlike a markdown/HTML string — no migration
  needed when that editor arrives, only new write-side UI.
- **Media.** Upload → `media-private`, promote → `media-public` on publish
  (§6) is the contract a CMS upload flow implements.
- **Admin client.** `src/lib/supabase/admin.ts` is reserved for exactly the
  kind of privileged operation (cross-bucket media moves, bulk
  status transitions) a CMS backend needs.

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
