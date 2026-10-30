# Q3 2026 content seed — structure only, not applied

The Q3 2026 newsletter text and the staff and event photographs are **not stored in this repository**.
They contain personal data (staff photographs) and unpublished editorial content, and this repository is public.
They are kept in separate private storage by the content owner.

Nothing from the seed has been uploaded, registered, run or applied anywhere, and no production record has been touched.

## What the private seed contains

- `q3-2026.json` — a structured copy of the newsletter text: an `edition` block, `stories`, `staffNews`
  cards, `photosOfTheQuarter`, `games`, `heroVideos`, `staffSpotlightPage` and a list of `sourceTypos`.
  Each story has a content type, a title, optional kicker / subtitle / author, paragraphs, and a list of photo file names.
- `photos/` — **23** photograph files, renamed by subject. (An earlier version of this note said 16; that was
  incorrect.) Seventeen of them are listed for Photos of the Quarter; the rest accompany stories and staff cards.
  Most are 170–400 px wide (fine for thumbnails, soft for large display); the portraits and the GITEX and rugby
  group shots are larger.
- The three hero videos are `hIW7FrWtcHE` (HR, landscape), `jkEu3O_fX94` (Dare, vertical) and `V4g-MVnRom8`
  (CJ, vertical — a normal video, not a Short, so its player shape is set by hand).

## Rules for using it

1. **Draft only.** Load it only into a *verified isolated* Supabase project, through the normal CMS or a reviewed
   import script. Every item goes in as a **draft**: the edition is created with status `draft` (not `published`),
   every story is `draft`, and every image uploads as **private**. Publishing and promoting are separate, deliberate
   steps under the existing permissions.
2. **Keep it out of this repository.** `.gitignore` excludes `photos/` and `q3-2026.json` here so they cannot be
   committed by accident. Do not add them to a public repository without written clearance.
3. **Clearance.** Staff photographs are personal data under the NDPA 2023. This repository records **no** DPO
   clearance for hosting these photographs or the newsletter text on public GitHub, and none should be assumed.
   Use of the photographs on the Springboard site is a separate decision. Record any decision in your DPO register,
   not in this file.
