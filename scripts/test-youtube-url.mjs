// Lightweight, dependency-free checks for src/lib/video/youtube.ts.
// Run with: npm run test:youtube   (Node 22+ strips the TypeScript types itself).
import test from "node:test";
import assert from "node:assert/strict";
import { parseYouTubeUrl, youTubeEmbedUrl, youTubeWatchUrl, isValidYouTubeId } from "../src/lib/video/youtube.ts";

const ID = "hIW7FrWtcHE";

test("accepts the supported URL shapes and extracts the canonical id", () => {
  const accepted = [
    [`https://youtu.be/${ID}`, ID, false],
    [`https://youtu.be/${ID}?si=trackingtoken`, ID, false],
    [`https://youtu.be/${ID}/`, ID, false],
    [`https://www.youtube.com/watch?v=${ID}`, ID, false],
    [`https://youtube.com/watch?v=${ID}&list=PL123&t=42s`, ID, false],
    [`https://m.youtube.com/watch?feature=share&v=${ID}`, ID, false],
    [`https://WWW.YOUTUBE.COM/watch?v=${ID}`, ID, false],
    [`https://www.youtube.com/embed/${ID}`, ID, false],
    [`https://www.youtube.com/live/${ID}`, ID, false],
    [`https://www.youtube-nocookie.com/embed/${ID}`, ID, false],
    ["https://youtube.com/shorts/jkEu3O_fX94", "jkEu3O_fX94", true],
    ["https://www.youtube.com/shorts/jkEu3O_fX94?feature=share", "jkEu3O_fX94", true],
    ["https://youtu.be/V4g-MVnRom8", "V4g-MVnRom8", false],
    [`  https://youtu.be/${ID}  `, ID, false], // surrounding whitespace from a paste is trimmed
  ];
  for (const [input, videoId, isShort] of accepted) {
    assert.deepEqual(parseYouTubeUrl(input), { videoId, isShort }, input);
  }
});

test("a Shorts link is flagged as a short; every other shape is not", () => {
  assert.equal(parseYouTubeUrl("https://youtube.com/shorts/jkEu3O_fX94")?.isShort, true);
  assert.equal(parseYouTubeUrl(`https://youtu.be/${ID}`)?.isShort, false);
  assert.equal(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}`)?.isShort, false);
});

test("rejects malformed input", () => {
  const rejected = [
    "",
    "   ",
    "not a url",
    "youtu.be/" + ID, // no scheme
    `//youtu.be/${ID}`, // protocol-relative
    "https://youtu.be/",
    "https://youtu.be/short",
    `https://youtu.be/${ID}x`, // 12 chars
    `https://youtu.be/${ID.slice(0, 10)}`, // 10 chars
    "https://youtu.be/hIW7FrWtc!E", // bad character
    `https://youtu.be/${ID}/extra`,
    "https://www.youtube.com/watch",
    "https://www.youtube.com/watch?v=",
    "https://www.youtube.com/watch?v=short",
    `https://www.youtube.com/watch/${ID}`,
    `https://www.youtube.com/shorts/${ID}/extra`,
    `https://www.youtube.com/shorts//${ID}`,
    `https://www.youtube.com/watch?v=${ID}%0a`,
    "https://www.youtube.com/playlist?list=PLabcdefghijk",
    "https://www.youtube.com/@somechannel",
    "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv",
    `https://www.youtube-nocookie.com/watch?v=${ID}`, // nocookie host only serves /embed/
    `https://youtu.be:8443/${ID}`, // explicit port
  ];
  for (const input of rejected) assert.equal(parseYouTubeUrl(input), null, JSON.stringify(input));
});

test("rejects non-string and oversized input", () => {
  for (const input of [null, undefined, 42, {}, [], true]) assert.equal(parseYouTubeUrl(input), null);
  assert.equal(parseYouTubeUrl(`https://youtu.be/${ID}?x=${"a".repeat(400)}`), null);
});

test("rejects look-alike and spoofed hosts", () => {
  const rejected = [
    `https://youtube.com.evil.example/watch?v=${ID}`,
    `https://notyoutube.com/watch?v=${ID}`,
    `https://youtube.com-evil.example/watch?v=${ID}`,
    `https://evil.example/youtube.com/watch?v=${ID}`,
    `https://evil.example/?v=${ID}&u=youtube.com`,
    `https://youtu.be.evil.example/${ID}`,
    `https://myyoutu.be/${ID}`,
    `https://youtube.com@evil.example/watch?v=${ID}`, // userinfo trick: the real host is evil.example
    `https://www.youtube.com:pass@evil.example/watch?v=${ID}`,
    `https://user:pass@www.youtube.com/watch?v=${ID}`,
    `https://evil.example\\@youtube.com/watch?v=${ID}`, // backslash trick
    `https://xn--youtub-8ve.com/watch?v=${ID}`, // punycode look-alike
    `https://youtubе.com/watch?v=${ID}`, // Cyrillic "е"
    `https://music.youtube.com/watch?v=${ID}`, // not in the explicit allowlist
    `https://vimeo.com/${ID}`,
    `https://www.youtube-nocookie.com.evil.example/embed/${ID}`,
  ];
  for (const input of rejected) assert.equal(parseYouTubeUrl(input), null, input);
});

test("rejects unsafe schemes", () => {
  const rejected = [
    `http://youtu.be/${ID}`,
    `http://www.youtube.com/watch?v=${ID}`,
    "javascript:alert(1)",
    `javascript://youtube.com/%0aalert(1)//watch?v=${ID}`,
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    `data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==`,
    `vbscript:msgbox(1)`,
    `file:///etc/passwd`,
    `ftp://youtu.be/${ID}`,
    `blob:https://youtu.be/${ID}`,
    `about:blank`,
  ];
  for (const input of rejected) assert.equal(parseYouTubeUrl(input), null, input);
});

test("rejects iframe / HTML injection attempts", () => {
  const rejected = [
    `<iframe src="https://www.youtube.com/embed/${ID}"></iframe>`,
    `<iframe width="560" height="315" src="https://www.youtube.com/embed/${ID}" frameborder="0" allowfullscreen></iframe>`,
    `<script>alert(1)</script>`,
    `https://youtu.be/${ID}"><script>alert(1)</script>`,
    `https://youtu.be/${ID}' onload='alert(1)`,
    `https://youtu.be/${ID}<img src=x onerror=alert(1)>`,
    `https://youtu.be/${ID} onload=alert(1)`,
    `https://youtu.be/${ID}\nhttps://evil.example`,
    `https://youtu.be/${ID}\u0000`,
    `https://www.youtube.com/embed/${ID}?autoplay=1" allow="camera"`,
    `https://youtu.be/${ID}\`onerror=alert(1)`,
  ];
  for (const input of rejected) assert.equal(parseYouTubeUrl(input), null, JSON.stringify(input));
});

test("id validation is strict", () => {
  assert.equal(isValidYouTubeId(ID), true);
  assert.equal(isValidYouTubeId("V4g-MVnRom8"), true);
  assert.equal(isValidYouTubeId("jkEu3O_fX94"), true);
  for (const bad of ["", "short", `${ID}x`, "hIW7FrWtc E", "hIW7FrWtc/E", "../../etc/pw", "hIW7FrWtcH\n", null, undefined, 12345678901]) {
    assert.equal(isValidYouTubeId(bad), false, String(bad));
  }
});

test("embed and watch URLs are rebuilt from a valid id against fixed hosts, and refuse invalid ids", () => {
  assert.equal(
    youTubeEmbedUrl(ID, { autoplay: true }),
    `https://www.youtube-nocookie.com/embed/${ID}?rel=0&playsinline=1&modestbranding=1&autoplay=1`
  );
  assert.ok(youTubeEmbedUrl(ID)?.startsWith(`https://www.youtube-nocookie.com/embed/${ID}?`));
  assert.ok(!youTubeEmbedUrl(ID)?.includes("autoplay"));
  assert.equal(youTubeWatchUrl(ID), `https://www.youtube.com/watch?v=${ID}`);
  assert.equal(youTubeWatchUrl("jkEu3O_fX94", true), "https://www.youtube.com/shorts/jkEu3O_fX94");
  for (const bad of ["", "x", `${ID}"onload="x`, "javascript:alert(1)", "../../evil"]) {
    assert.equal(youTubeEmbedUrl(bad), null, bad);
    assert.equal(youTubeWatchUrl(bad), null, bad);
  }
});
