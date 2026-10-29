# Compact editorial direction (supersedes the Stage 2 visual direction)

Status: prototype for review. The Stage 2 "motion-led" direction is withdrawn. Editions SQL proposals, audit queries and decisions from Stage 2 are unchanged.

## 1. What was inspected on ascension.phdmedia.com

Method: text extraction of the live homepage only (WebFetch). Browsers and CSS are not reachable from this environment, so nothing below about colour, type size, spacing, grid columns, hover or motion is observed. It is not guessed either.

Observed (text level):
- Header: skip link, search overlay, site name, a "Menu" toggle opening a slide-out area, and five flat items (The Eras, Video, Contributors, Meet PHD, Search). No dropdowns.
- Order of content: "Recent Posts" and "More Posts" headings with a four-card row, then a "News Bites" strip (tagline plus latest bite), then a "More Posts" grid of seven cards with a "Sort: Newest" control, then a "More Bites" list of nine dated entries with thumbnails, a disclaimer paragraph and a footer repeating the nav.
- Card anatomy: thumbnail (files are 1024x574, so about 16:9), a category label, a linked H3 title, a summary of roughly 100 to 160 characters cut with an ellipsis. No author, date or read time on article cards.
- Categories are era names. There is no edition or quarterly archive on that site, so the quarterly model is Springboard's own.
- No featured video on the homepage text. A "Video" nav item exists but its page was not inspected.

Not determinable and therefore not copied: palette, fonts, density in pixels, columns, motion. Please share screenshots if exact density matters; the prototype's numbers are my own choices, listed below.

## 2. Principles taken from it, applied to Springboard
- Content first, no hero chrome: the first viewport carries navigation, a ticker, a video, the latest edition and four stories.
- Card anatomy of thumbnail, category, headline, short summary. Springboard adds edition and date, because its archive is quarterly.
- Bites as a first-class short-form strip and list.
- Not copied: its name, era taxonomy, wording, layout geometry or branding.

## 3. Compact system (choices to approve)
- Header 52px, utility bar 28px, ticker 38px. Section padding 22px. Body 14px, story headlines 14.5 to 16px, lead 26px, one 22px video title. Syne for headlines and labels only.
- Flat: no gradients, no shadows except the open dropdown, no rounded corners, no glass. Hairline rules instead of containers.
- Five brand colours exact. Purple for masthead and edition identity, lime for labels and the play control, coral, lavender, pink as small category markers and one lavender tip block. Text is always the derived ink or white. Neutrals (ink, wash, rule, muted) are derived and need client approval.
- Placeholders are flat grey, labelled with ratio, never imitation photography.
- Layouts differ by section: lead plus two columns (edition), two-column thumbnail list (recent), portrait plus list plus tip (people), ruled table (company), mosaic (photos), four-up short updates, archive with filters.
- Motion, selective: 140 to 200ms dropdown and hover, a 420ms opacity reveal on images, play-button hover. Reduced motion disables all of it.

## 4. Featured video component
Data: provider, videoId, title, caption, orientation (landscape or portrait), thumbnailMediaId. This matches the existing YouTube block fields, so the real build reuses `YouTubeEmbed`, `src/lib/video/youtube.ts` and the nocookie click-to-play facade.
- No videoId: inert slot with a disabled play button, disabled control bar and the text "No video supplied yet". Nothing is registered, uploaded or published, and no URL is invented.
- Valid 11-character id: play control enabled; click swaps in a `youtube-nocookie.com` iframe with the player's own controls.
- Editorial selection: proposed as a `featured_video_content_id` (or block reference) on `site_settings`, defaulting to the latest-edition video. Needs a decision.
- Portrait videos render 9:16 capped at 520px.

## 5. Quarterly model in the design
Latest Edition box and utility bar link; archive with year chips, per-quarter chips with counts, and an explicit Evergreen chip; edition list generated from published editions only. The fixture includes a story inside a draft edition to show it is excluded from every list, matching the embargo rule in M3.

## 6. Checks run
Automated (Playwright Chromium, axe-core): zero axe violations at 1440, 1024 and 390 widths; no horizontal overflow; no page errors; keyboard checks for the nav (arrow keys, Escape returns focus), mobile drawer Escape, filter results and the draft-edition exclusion. Visual review: Chromium screenshots only. Not tested: Safari, Firefox, real devices, screen readers, the real Syne font (blocked here, fallback used).

## 7. Decisions needed
1. Approve density (section 3) or ask for tighter/looser.
2. Video selection rule and where the editor sets it.
3. Body typeface (system stack used here).
4. Brand assets and real photography.
Nothing else is rebuilt until this homepage is approved.
