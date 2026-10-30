// Dependency-free unit checks for src/lib/content/visibility.ts (what makes an EDITION publicly visible, and the
// content-query filter built from it). Run with: npm run test:visibility   (Node 22+ strips the TypeScript types itself).
import test from "node:test";
import assert from "node:assert/strict";
import { isEditionPubliclyVisible, publicEditionOrFilter } from "../src/lib/content/visibility.ts";

const NOW = new Date("2026-10-30T12:00:00.000Z");
const HOUR = 3600 * 1000;
const at = (offsetMs) => new Date(NOW.getTime() + offsetMs).toISOString();

test("a published edition is visible", () => {
  assert.equal(isEditionPubliclyVisible({ status: "published", publish_at: null }, NOW), true);
});

test("a draft edition is NOT visible, even if it has a past publish time", () => {
  assert.equal(isEditionPubliclyVisible({ status: "draft", publish_at: null }, NOW), false);
  assert.equal(isEditionPubliclyVisible({ status: "draft", publish_at: at(-HOUR) }, NOW), false);
});

test("an archived or unknown-status edition is NOT visible", () => {
  assert.equal(isEditionPubliclyVisible({ status: "archived", publish_at: at(-HOUR) }, NOW), false);
  assert.equal(isEditionPubliclyVisible({ status: "review", publish_at: null }, NOW), false);
  assert.equal(isEditionPubliclyVisible({ status: "", publish_at: null }, NOW), false);
});

test("a scheduled edition is visible only once its time has come", () => {
  assert.equal(isEditionPubliclyVisible({ status: "scheduled", publish_at: at(-HOUR) }, NOW), true, "past");
  assert.equal(isEditionPubliclyVisible({ status: "scheduled", publish_at: at(0) }, NOW), true, "exactly now");
  assert.equal(isEditionPubliclyVisible({ status: "scheduled", publish_at: at(HOUR) }, NOW), false, "future");
});

test("a scheduled edition with a missing or invalid time is NOT visible", () => {
  assert.equal(isEditionPubliclyVisible({ status: "scheduled", publish_at: null }, NOW), false);
  assert.equal(isEditionPubliclyVisible({ status: "scheduled", publish_at: "not a date" }, NOW), false);
});

test("the content filter always keeps evergreen content (no edition)", () => {
  assert.equal(publicEditionOrFilter([]), "publication_id.is.null");
});

test("the content filter lists exactly the visible editions", () => {
  const a = "20000000-0000-4000-8000-000000000601";
  const b = "4788ffc2-a88b-4a0a-8976-81071fe313e0";
  assert.equal(publicEditionOrFilter([a, b]), `publication_id.is.null,publication_id.in.(${a},${b})`);
});

test("the content filter can never be injected into: anything that is not a UUID is dropped", () => {
  const good = "20000000-0000-4000-8000-000000000601";
  const evil = ["x),or(id.not.is.null", "1,2,3", "", "20000000-0000-4000-8000-00000000060", `${good})`, "' or 1=1 --"];
  assert.equal(publicEditionOrFilter([...evil, good]), `publication_id.is.null,publication_id.in.(${good})`);
  assert.equal(publicEditionOrFilter(evil), "publication_id.is.null");
});
