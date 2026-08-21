import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const manifest = JSON.parse(read("assets/manifests/assets.json"));

test("production environment plates are not obscured by legacy decorative overlays", () => {
  const nesmen = read("src/scenes/NesmenScene.js");
  const besednice = read("src/scenes/BesedniceScene.js");
  const slavia = read("src/scenes/SlaviaScene.js");

  assert.match(nesmen, /terrain-nesmen-forest-plate-v7/);
  assert.match(nesmen, /foreground-nesmen-forest-edge-v7/);
  assert.match(nesmen, /createTerrainPlate\(environmentTexture/);
  assert.match(nesmen, /resolveNesmenV7CameraZoom/);
  assert.doesNotMatch(nesmen, /environmentTexture\.repeat\.set/);
  assert.doesNotMatch(nesmen, /const trail = new THREE\.Mesh/);
  assert.doesNotMatch(nesmen, /addDecorModel\(root, "model-nesmen-tree-stump"/);

  const forestPlate = manifest.find(entry => entry.id === "terrain-nesmen-forest-plate-v7");
  assert.deepEqual(forestPlate?.dimensions, { width: 1500, height: 1200 });
  assert.equal(forestPlate?.url, "./assets/textures/terrain/nesmen-forest-plate-v7.webp");
  assert.ok(forestPlate?.budget.bytes >= forestPlate?.metrics.bytes);

  assert.match(besednice, /terrain-besednice-clay-quarry-v7/);
  assert.match(besednice, /foreground-besednice-quarry-edge-v7/);
  assert.match(besednice, /createTerrainPlate\(environmentTexture/);
  assert.doesNotMatch(besednice, /environmentTexture\.repeat\.set/);
  assert.doesNotMatch(besednice, /addDecorModel\(root, "model-besednice-rock"/);

  const quarryPlate = manifest.find(entry => entry.id === "terrain-besednice-clay-quarry-v7");
  assert.deepEqual(quarryPlate?.dimensions, { width: 1436, height: 1095 });
  assert.equal(quarryPlate?.url, "./assets/textures/terrain/besednice-clay-quarry-v7.webp");
  assert.ok(quarryPlate?.budget.bytes >= quarryPlate?.metrics.bytes);

  assert.match(slavia, /terrain-slavia-event-plate-v7/);
  assert.match(slavia, /foreground-slavia-event-edge-v7/);
  assert.match(slavia, /createTerrainPlate\(environmentTexture/);
  assert.match(slavia, /resolveSlaviaV7CameraZoom/);
  assert.doesNotMatch(slavia, /environmentTexture\.repeat\.set/);
  assert.match(slavia, /building\.visible = false/);

  const eventPlate = manifest.find(entry => entry.id === "terrain-slavia-event-plate-v7");
  assert.deepEqual(eventPlate?.dimensions, { width: 1440, height: 880 });
  assert.equal(eventPlate?.url, "./assets/textures/terrain/slavia-event-plate-v7.webp");
  assert.ok(eventPlate?.budget.bytes >= eventPlate?.metrics.bytes);
});
