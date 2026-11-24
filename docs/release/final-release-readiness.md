# Final release readiness: Springboard (Preview to springboard.phdnigeria.com)

Status: **ready for review on Preview. Nothing has been merged, deployed or applied to any database.**
Branch: `feature/final-release-additions` (25 commits ahead of `origin/main`, 0 behind: `main` is a direct ancestor, so the eventual merge is a fast-forward with no conflicts).

## What was added (all extensions of the existing site)
| Phase | Change | Where |
|---|---|---|
| 1 Team | CMS-driven team section at the foot of the homepage; admin-only add / edit / remove / reorder / show-hide at `/admin/team` | `team_members` table, `TeamSection`, `TeamManager` |
| 2 Archive PDFs | Archive cards show Open / Download PDF, newest first (by period, else publish date); editors/admins attach a PDF per edition; PDF-only editions open the PDF directly; Q3 web edition untouched; PDFs are not converted to articles | `publications` new columns, `edition-pdfs` bucket |
| 3 Gallery | `/gallery`: every image in the public media bucket appears automatically (no second upload), grouped by event/category or month, responsive grid, accessible lightbox; editors/admins set description, group, date, visibility; videos excluded by MIME type; private images stay private until an admin promotes them | `media` new columns, view-free query |
| 4 Share Your Ideas | Top-right header button, lightbulb icon, mailto with subject `Springboard – Suggestions & Ideas`; recipient set by an admin in Settings; button is **disabled** until an address exists | `site_settings.ideas_email`, `site_settings_public_ideas()` |
| 5 Navigation | Migration inserts a Gallery item directly after Archive (order: existing items, Archive, Gallery, Search) | `nav_items` row |

## Missing inputs (nothing was invented)
1. The edition PDFs, with title, period and cover for each. None were uploaded.
2. The Share Your Ideas recipient address. Until saved in Settings, the button is disabled.
3. Gallery event/category names (optional). Without them photos group by month.
4. Decision on the Gallery rule: only **public-bucket** photos auto-appear; private uploads join when an admin promotes them. This keeps the "never make private media public automatically" rule.
5. Whether the old "People" contributor block should stay. It was kept; the new team section sits below it.

## Database migrations (additive, idempotent, not applied)
Apply in order on Preview first, then Production at release time:
1. `20261124000000_team_members.sql`: new table, RLS (public sees visible rows; admin writes), seeds the five members only if the table is empty, adds the `TEAM` audit type.
2. `20261124010000_edition_pdfs.sql`: nullable columns on `publications`, public `edition-pdfs` bucket (PDF only, 50 MiB), storage policies (public read; editor/admin write; admin delete).
3. `20261124020000_gallery_media_metadata.sql`: nullable columns on `media`, `gallery_visible` defaulting to true, trigger so contributors cannot change curation fields.
4. `20261124030000_ideas_email_and_gallery_nav.sql`: `site_settings.ideas_email`, narrow SECURITY DEFINER read function, Gallery nav row.

The app fails soft if any migration is missing (team section hidden, no PDF links, Gallery lists public images, button disabled), so code and database can be released in either order. No existing row, policy, role or auth setting is altered.

**Rollback** (data-safe; run only if needed): drop the `TEAM` rows/table; null then drop the five PDF columns on `publications` and, once the bucket is empty, remove the bucket and its three policies; drop the gallery trigger, function and four `media` columns; drop `site_settings_public_ideas()`, the `ideas_email` column and the `/gallery` nav row. Code rollback is reverting the merge; uploaded PDF files are never deleted by the app.

## Environment variables
No new variables. The app uses `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`. The ideas recipient lives in the database setting, not an env var. For production, `NEXT_PUBLIC_SITE_URL` should be `https://springboard.phdnigeria.com` (this also enables the sitemap, which now lists Archive and Gallery).

## Preview and Production credential separation
Not verifiable from this session (no access to Vercel or either Supabase project). Before release, confirm in Vercel that Preview env vars point at the staging Supabase project and Production at the live one, that migrations are applied to staging first, and that no Preview secret is copied to Production.

## Test results
Automated, run here:
- `eslint`: clean. `tsc --noEmit`: clean. `next build`: passes (Google Fonts stubbed because this sandbox cannot reach Google; the real build on Vercel is unaffected).
- Unit tests: YouTube, visibility, contrast, home helpers, team (validation, reorder, missing-table detection), ideas (mailto building and rejection of bad addresses): all pass.
- axe (WCAG 2.0/2.1 A and AA) on `/`, `/archive`, `/gallery`: no violations.

Visual / behavioural, run against a **mock Supabase with fictional data** (no real database):
- Desktop 1440, tablet 820, mobile 390: no horizontal overflow on home, Archive, Gallery. Header button fits next to Menu on mobile.
- Gallery: hidden photo, video and private image excluded; lightbox opens, arrow keys move, Escape closes, focus returns.
- Team: hidden member not shown publicly; admin sees all five; edit/reorder/hide/add send the expected requests; remove asks for confirmation and Escape cancels.
- Roles: editor and contributor are redirected from `/admin/team` and cannot edit the ideas address; contributors do not see the PDF panel; signed-out visitors see only public pages.
- Button: disabled with no address; real `mailto:` link with the exact subject once an address exists.

**Not yet tested (needs the real Preview database after migrations):** real RLS enforcement of the new policies, real PDF upload to Storage, real photo upload appearing in the Gallery, the Q3 photos on Preview, and a signed-out pass on the deployed Preview URL. Existing story, edition and video pages were not changed, and `/issues/*`, search and the video player were not part of the mock pass beyond the homepage.

## Release steps (when you approve)
1. Apply the four migrations to staging, run the "not yet tested" checks on Preview.
2. Supply the PDFs and recipient address; upload via the admin.
3. Approve; fast-forward merge to `main`; apply migrations to production; set `NEXT_PUBLIC_SITE_URL`; deploy; smoke test.
