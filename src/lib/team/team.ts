/**
 * Pure helpers for the team section, dependency-free so scripts/test-team.mjs can import this file directly
 * (same pattern as lib/video/youtube.ts).
 */

export const TEAM_NAME_MAX = 120;
export const TEAM_ROLE_MAX = 160;

export interface TeamMemberInput {
  name: string;
  role: string;
}

/** Trims and validates. Returns the cleaned values or a user-facing error. Names/roles are plain text only; React escapes them on render. */
export function validateTeamMember(input: { name: unknown; role: unknown }): { ok: true; value: TeamMemberInput } | { ok: false; error: string } {
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  const role = typeof input.role === "string" ? input.role.trim().replace(/\s+/g, " ") : "";
  if (!name) return { ok: false, error: "Enter a name." };
  if (!role) return { ok: false, error: "Enter a role." };
  if (name.length > TEAM_NAME_MAX) return { ok: false, error: `Names can be up to ${TEAM_NAME_MAX} characters.` };
  if (role.length > TEAM_ROLE_MAX) return { ok: false, error: `Roles can be up to ${TEAM_ROLE_MAX} characters.` };
  return { ok: true, value: { name, role } };
}

/** The error codes PostgREST/Postgres give when a table does not exist yet (a migration not applied). The public site treats that as "nothing to show", never as a crash. */
export function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /could not find the table|does not exist/i.test(error.message ?? "");
}

/** New display_order values after moving the item at `index` by `delta` (-1 up, +1 down). Returns null when the move is not possible. Always renumbers 1..n so ties and gaps cannot accumulate. */
export function reorderIds(ids: string[], index: number, delta: -1 | 1): string[] | null {
  const target = index + delta;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return null;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
