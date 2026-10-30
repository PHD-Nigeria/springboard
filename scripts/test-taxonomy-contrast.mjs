// WCAG AA check for the homepage's light theme: every taxonomy label colour must reach 4.5:1 (normal text) on every
// light surface the theme defines. Reads src/components/home/home-theme.css directly. Run: npm run test:contrast
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("../src/components/home/home-theme.css", import.meta.url)), "utf8");
const block = css.match(/\.home-theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
const token = (name) => block.match(new RegExp(`--color-${name}\\s*:\\s*(#[0-9a-fA-F]{6})\\b`))?.[1];

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const SURFACES = ["background", "surface", "surface-raised"].map((n) => [n, token(n)]);
const LABELS = [1, 2, 3, 4, 5].map((n) => [`taxonomy-${n}`, token(`taxonomy-${n}`)]);

test("the light theme defines every surface and every taxonomy colour as a hex value", () => {
  for (const [name, value] of [...SURFACES, ...LABELS]) assert.ok(value, `--color-${name} is not defined as a #rrggbb value in .home-theme`);
});

for (const [name, colour] of LABELS) {
  test(`${name} (${colour}) meets WCAG AA 4.5:1 on every light surface`, () => {
    for (const [surfaceName, surface] of SURFACES) {
      const r = ratio(colour, surface);
      assert.ok(r >= 4.5, `${name} ${colour} on ${surfaceName} ${surface} is ${r.toFixed(2)}:1 (needs 4.5:1)`);
    }
  });
}
