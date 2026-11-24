import assert from "node:assert/strict";
import { validateTeamMember, reorderIds, isMissingRelationError, TEAM_NAME_MAX, TEAM_ROLE_MAX } from "../src/lib/team/team.ts";

assert.ok(validateTeamMember({ name: "Henry", role: "Editor in Chief" }).ok !== false);
for (const bad of [{ name: "", role: "x" }, { name: "x", role: "  " }, { name: "a".repeat(TEAM_NAME_MAX + 1), role: "x" }, { name: "x", role: "a".repeat(TEAM_ROLE_MAX + 1) }]) {
  const r = validateTeamMember(bad);
  assert.ok(r.ok === false || r.error, `should reject ${JSON.stringify(bad).slice(0, 40)}`);
}
assert.deepEqual(reorderIds(["a", "b", "c"], 1, -1), ["b", "a", "c"]);
assert.deepEqual(reorderIds(["a", "b", "c"], 1, 1), ["a", "c", "b"]);
assert.equal(reorderIds(["a", "b", "c"], 0, -1), null);
assert.equal(reorderIds(["a", "b", "c"], 2, 1), null);
assert.ok(isMissingRelationError({ code: "42P01" }) && isMissingRelationError({ code: "PGRST205" }) && !isMissingRelationError({ code: "42501" }));
console.log("team tests passed");
