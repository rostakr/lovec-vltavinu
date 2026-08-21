import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const rootUrl = new URL("../../", import.meta.url);
const html = fs.readFileSync(new URL("index.html", rootUrl), "utf8");
const howSection = html.match(/<section id="howScreen"[\s\S]*?<\/section>/)?.[0] ?? "";

test("onboarding describes the canonical one-action, three-hit flow without legacy mechanics", () => {
  assert.match(howSection, /role="dialog"/);
  assert.match(howSection, /aria-modal="true"/);
  assert.match(howSection, /aria-labelledby="howTitle"/);
  assert.match(howSection, /aria-describedby="howIntro"/);
  assert.match(howSection, /<h2 id="howTitle">Jak se hraje<\/h2>/);
  assert.match(howSection, /<p id="howIntro" class="eyebrow">/);
  assert.match(howSection, /Přibliž se k cíli/);
  assert.match(howSection, /tři úspěšné zásahy do rytmu/);
  assert.match(howSection, /červené varování/);
  assert.doesNotMatch(howSection, /běžíš automaticky|Kombo|ztratíš slabý kámen/);
});
