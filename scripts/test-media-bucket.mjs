import assert from "node:assert/strict";
import { bucketForMimeType, ALLOWED_MIME_TYPES, isAllowedMimeType } from "../src/lib/admin/media-constants.ts";
for (const m of ALLOWED_MIME_TYPES) assert.equal(bucketForMimeType(m), "public", `${m} must go to the public bucket`);
assert.equal(bucketForMimeType("video/mp4"), "private");
assert.equal(bucketForMimeType("application/pdf"), "private");
assert.equal(isAllowedMimeType("video/mp4"), false);
assert.equal(isAllowedMimeType("image/svg+xml"), false);
console.log("media bucket tests passed");
