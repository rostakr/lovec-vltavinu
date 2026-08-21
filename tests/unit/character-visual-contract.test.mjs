import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const rootUrl = new URL("../../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, rootUrl), "utf8");
const manifest = JSON.parse(read("assets/manifests/assets.json"));

test("production NPC art uses the V7 Chlum farmer while later-level NPCs stay on the approved v2 baseline", () => {
  const expected = Object.freeze({
    "npc-farmer-vaclav": { file: "farmer-vaclav-v7.png", dimensions: { width: 384, height: 512 } },
    "npc-forester-jan": { file: "forester-jan-v2.png", dimensions: { width: 256, height: 384 } },
    "npc-rival-karel": { file: "rival-karel-v2.png", dimensions: { width: 256, height: 384 } },
    "npc-expert-eva": { file: "expert-eva-v2.png", dimensions: { width: 256, height: 384 } },
    "npc-thief-franta": { file: "thief-franta-v2.png", dimensions: { width: 256, height: 384 } }
  });

  for (const [id, contract] of Object.entries(expected)) {
    const entry = manifest.find(candidate => candidate.id === id);
    assert.ok(entry, id);
    assert.equal(entry.url, `./assets/sprites/npcs/${contract.file}`);
    assert.deepEqual(entry.dimensions, contract.dimensions);
    assert.ok(entry.metrics.bytes > 0 && entry.metrics.bytes <= entry.budget.bytes, id);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    assert.match(entry.disposeOwner, /^LevelScene:/);
  }
});

test("player and NPC sprites share one visual size and foot anchor in every production scene", () => {
  for (const path of [
    "src/scenes/ChlumScene.js",
    "src/scenes/NesmenScene.js",
    "src/scenes/BesedniceScene.js",
    "src/scenes/SlaviaScene.js"
  ]) {
    const scene = read(path);
    const normalizedSprites = scene.match(/width:\s*82,?\s*height:\s*108[\s\S]{0,100}?anchorX:\s*0\.5,?\s*anchorY:\s*0\.08/g) ?? [];
    assert.ok(normalizedSprites.length >= 2, `${path} must normalize player and NPC sprite size`);
  }
});
