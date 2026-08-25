-- Additive column: the contributor page needs a role/title line (e.g.
-- "Senior Strategist"), which public.authors didn't carry (only
-- name/bio/avatar_media_id). Nullable, no default-data backfill needed —
-- existing rows (there are none yet) are unaffected. "Organization" is
-- deliberately not a column here: for this site it's always "PHD Nigeria",
-- so it's a static label in the contributor template, not per-row data.
alter table public.authors
  add column title text;
