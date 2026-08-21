import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const rootUrl = new URL("../../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, rootUrl), "utf8");
const readBuffer = path => fs.readFileSync(new URL(path, rootUrl));
const manifest = JSON.parse(read("assets/manifests/assets.json"));
const scene = read("src/scenes/SlaviaScene.js");
const serviceWorker = read("sw.js");
const slaviaSmoke = read("tests/slavia-smoke.spec.mjs");
const productionPipeline = read("tools/art/build-slavia-v7-art.mjs");
const pngGenerator = read("tools/art/build-slavia-v7-png.mjs");
const artPipelineDocs = read("docs/ART_PIPELINE.md");

const V7_ASSETS = Object.freeze(["terrain-slavia-event-plate-v7", "foreground-slavia-event-edge-v7"]);
const byId = new Map(manifest.map(entry => [entry.id, entry]));

test("Slavia V7 production art is a repository-owned bounded bitmap pack", () => {
  for (const id of V7_ASSETS) {
    const entry = byId.get(id);
    assert.ok(entry, `missing ${id}`);
    assert.equal(entry.type, "texture");
    assert.match(entry.url, /^\.\/assets\/.+\.webp$/);
    assert.equal(entry.preload, "level:slavia");
    assert.equal(entry.disposeOwner, "LevelScene:slavia");
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(entry.dimensions, { width: 1440, height: 880 });
    assert.ok(entry.metrics.bytes <= entry.budget.bytes, `${id} exceeds byte budget`);
    assert.ok(Math.max(entry.dimensions.width, entry.dimensions.height) <= entry.budget.textureMax);

    const buffer = readBuffer(entry.url.slice(2));
    assert.equal(buffer.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(buffer.subarray(8, 12).toString("ascii"), "WEBP");
    assert.equal(buffer.byteLength, entry.metrics.bytes);
    assert.equal(crypto.createHash("sha256").update(buffer).digest("hex"), entry.sha256);
    assert.ok(serviceWorker.includes(`"${entry.url}"`), `service worker missing ${entry.url}`);
  }
  assert.equal(byId.get("foreground-slavia-event-edge-v7").transparent, true);
  assert.equal(byId.get("terrain-slavia-event-plate-v7").transparent, false);
});

test("Slavia production art has one canonical build command with automatic WebP verification and cleanup", () => {
  assert.match(productionPipeline, /build-slavia-v7-png\.mjs/);
  assert.match(productionPipeline, /run\("cwebp"/);
  assert.match(productionPipeline, /-alpha_q/);
  assert.match(productionPipeline, /buffer\.byteLength !== entry\.metrics\?\.bytes/);
  assert.match(productionPipeline, /digest !== entry\.sha256/);
  assert.match(productionPipeline, /fs\.rmSync\(file, \{ force: true \}\)/);
  assert.match(productionPipeline, /\.webp\.generated|\$\{asset\.webp\}\.generated/);

  assert.match(pngGenerator, /encodePng\(buildPlate\(\)\)/);
  assert.match(pngGenerator, /slavia-event-plate-v7\.png/);
  assert.match(pngGenerator, /slavia-event-edge-v7\.png/);

  assert.match(artPipelineDocs, /node tools\/art\/build-slavia-v7-art\.mjs/);
  assert.match(artPipelineDocs, /cwebp/);
  assert.match(artPipelineDocs, /SHA-256/);
  assert.match(artPipelineDocs, /mezilehlé PNG.*odstran/i);
  assert.doesNotMatch(artPipelineDocs, /Převeď výstup na WebP:/);
});

test("the plate keeps the plate/world aspect so no authored pixel is stretched off-axis", () => {
  const plate = byId.get("terrain-slavia-event-plate-v7").dimensions;
  // level bounds are 1800x1100; the plate must use the same aspect ratio.
  assert.equal(plate.width / plate.height, 1800 / 1100);
});

test("Slavia scene composes plate, foreground layer and bounded follow camera", () => {
  assert.match(scene, /const V7_PLATE_ASSET = "terrain-slavia-event-plate-v7"/);
  assert.match(scene, /const V7_FOREGROUND_ASSET = "foreground-slavia-event-edge-v7"/);
  assert.match(scene, /createTerrainPlate\(environmentTexture/);
  assert.match(scene, /slavia-v7-main-plate/);
  assert.match(scene, /slavia-v7-foreground-occlusion/);
  assert.match(scene, /this\.renderer\.add\(foreground, "foreground"\)/);
  assert.match(scene, /setBoundedCameraCenter\(this\.renderer, this\.level\.bounds, transform\.x, transform\.y, this\.cameraZoom\)/);
  // the foreground layer must be released with the rest of the visual world
  assert.match(scene, /if \(this\.foregroundRoot\) \{\s*\n\s*this\.renderer\.remove\(this\.foregroundRoot\);/);
  assert.doesNotMatch(scene, /new THREE\.WebGLRenderer|localStorage|inventory/);
});

test("Slavia runtime snapshot exposes V7 visual evidence for QA", () => {
  assert.match(scene, /this\.visualMode = "event-plaza-v7"/);
  assert.match(scene, /visualMode: this\.visualMode/);
  assert.match(scene, /cameraZoom: this\.cameraZoom/);
  assert.ok(slaviaSmoke.includes("event-plaza-v7"), "smoke matrix must assert the Slavia V7 visual mode");
  assert.ok(slaviaSmoke.includes("terrain-slavia-event-plate-v7"));
  assert.ok(slaviaSmoke.includes("foreground-slavia-event-edge-v7"));
});

test("the jury summary uses correct Czech counted-noun forms", async () => {
  const { czechCount } = await import("../../src/scenes/SlaviaScene.js");
  assert.equal(czechCount(1, "nález", "nálezy", "nálezů"), "1 nález");
  assert.equal(czechCount(3, "nález", "nálezy", "nálezů"), "3 nálezy");
  assert.equal(czechCount(5, "nález", "nálezy", "nálezů"), "5 nálezů");
  assert.equal(czechCount(0, "lokality", "lokalit", "lokalit"), "0 lokalit");
  assert.equal(czechCount(1, "lokality", "lokalit", "lokalit"), "1 lokality");
  assert.match(scene, /czechCount\(result\.findingCount, "nález", "nálezy", "nálezů"\)/);
});
