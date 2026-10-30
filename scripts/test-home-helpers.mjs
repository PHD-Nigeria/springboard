// Unit tests for the homepage's pure helpers (no database, no network). Run: npm run test:home-helpers
import test from "node:test";
import assert from "node:assert/strict";
import { isEditorialStory, quarterMonths, formatTickerDate, formatLongDate } from "../src/lib/content/home-helpers.ts";

const story = (contentType, blocks) => ({ contentType, body: { version: 1, blocks } });
const para = { type: "paragraph", text: "x" };
const video = { type: "video", provider: "youtube", videoId: "hIW7FrWtcHE", title: "HR", orientation: "landscape" };

test("an article or news item with text is a story", () => {
  assert.equal(isEditorialStory(story("ARTICLE", [para])), true);
  assert.equal(isEditorialStory(story("COMPANY_NEWS", [para, video])), true);
});
test("a gallery is not a story (it has its own band)", () => {
  assert.equal(isEditorialStory(story("GALLERY", [{ type: "gallery", mediaIds: [] }])), false);
});
test("an item that holds only videos is not a story", () => {
  assert.equal(isEditorialStory(story("ARTICLE", [video, video])), false);
});
test("an empty article is still a story (it is the editors' call, not ours)", () => {
  assert.equal(isEditorialStory(story("ARTICLE", [])), true);
});
test("quarterMonths maps each quarter and rejects anything else", () => {
  assert.equal(quarterMonths("2026 Q1"), "Jan–Mar");
  assert.equal(quarterMonths("2026 Q2"), "Apr–Jun");
  assert.equal(quarterMonths("2026 Q3"), "Jul–Sep");
  assert.equal(quarterMonths("2026 Q4"), "Oct–Dec");
  assert.equal(quarterMonths("2026 Q5"), null);
  assert.equal(quarterMonths(null), null);
  assert.equal(quarterMonths("July – September 2026"), null);
});
test("dates are shown in Lagos time", () => {
  assert.equal(formatTickerDate("2026-10-29T23:30:00Z"), "30 Oct"); // 00:30 on the 30th in Lagos
  assert.equal(formatTickerDate(null), "");
  assert.equal(formatLongDate(new Date("2026-10-29T09:00:00Z")), "Thursday 29 October 2026");
});

import { publicStatusOrFilter } from "../src/lib/content/visibility.ts";
test("the public status filter admits published, and scheduled items only once due", () => {
  assert.equal(
    publicStatusOrFilter(new Date("2026-10-30T12:00:00.000Z")),
    "status.eq.published,and(status.eq.scheduled,publish_at.lte.2026-10-30T12:00:00.000Z)",
  );
  assert.ok(!/draft|archived|review/.test(publicStatusOrFilter()));
});
