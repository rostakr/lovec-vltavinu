import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const rootUrl = new URL("../../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, rootUrl), "utf8");

const html = read("index.html");
const screenController = read("src/ui/ScreenController.js");

const resultSection = html.match(/<section id="resultScreen"[\s\S]*?<\/section>/)?.[0] ?? "";
const resultStyle = html.match(/<style id="slavia-final-ui-contract">[\s\S]*?<\/style>/)?.[0] ?? "";

test("final result is exposed as one accessible modal result surface", () => {
  assert.match(resultSection, /role="dialog"/);
  assert.match(resultSection, /aria-modal="true"/);
  assert.match(resultSection, /aria-labelledby="resultTitle"/);
  assert.match(resultSection, /aria-describedby="resultText"/);
  assert.match(resultSection, /aria-live="polite"/);
  assert.match(resultSection, /id="resultStats"[^>]*role="list"/);
  assert.match(resultSection, /id="againButton"[^>]*type="button"/);
});

test("final result preserves mobile touch targets and compact landscape layout", () => {
  assert.match(resultStyle, /min-height:44px/);
  assert.match(resultStyle, /#againButton\{min-height:48px\}/);
  assert.match(resultStyle, /orientation:landscape/);
  assert.match(resultStyle, /max-height:520px/);
  assert.match(resultStyle, /grid-template-areas:"kicker score"/);
  assert.match(resultStyle, /var\(--safe-t\)/);
  assert.match(resultStyle, /var\(--safe-b\)/);
});

test("ScreenController renders semantic result data without owning gameplay evaluation", () => {
  assert.match(screenController, /resultScreen\.setAttribute\("role", "dialog"\)/);
  assert.match(screenController, /container\.setAttribute\("role", "list"\)/);
  assert.match(screenController, /item\.setAttribute\("role", "listitem"\)/);
  assert.match(screenController, /scoreElement\.setAttribute\("aria-label", `\$\{normalizedScore\} bodů`\)/);
  assert.doesNotMatch(screenController, /findingId|rarity|locality|award/);
});
