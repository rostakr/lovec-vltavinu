import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const rootUrl = new URL("../../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, rootUrl), "utf8");

test("each active hazard keeps its existing trigger and gives scene-specific guidance", () => {
  const chlum = read("src/scenes/ChlumScene.js");
  const besednice = read("src/scenes/BesedniceScene.js");
  const slavia = read("src/scenes/SlaviaScene.js");

  assert.match(chlum, /danger >= 0\.75 \? "TRAKTOR JE BLÍZKO · OBEJDI HO" : ""/);
  assert.match(besednice, /bossActive \? "KAREL MÁ JEŽEK · ZASTAV HO" : ""/);
  assert.match(slavia, /state\.phase === "thief-recovery" \? "FRANTA ODNÁŠÍ NÁLEZ · ZASTAV HO" : ""/);
});
