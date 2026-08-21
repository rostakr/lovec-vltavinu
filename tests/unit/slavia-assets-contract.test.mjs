import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const rootUrl = new URL("../../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, rootUrl), "utf8");
const readBuffer = path => fs.readFileSync(new URL(path, rootUrl));
const manifest = JSON.parse(read("assets/manifests/assets.json"));
const serviceWorker = read("sw.js");
const slaviaData = read("src/data/slavia.js");
const slaviaScene = read("src/scenes/SlaviaScene.js");

const expectedAssets = Object.freeze([
  "model-slavia-kd-building",
  "model-slavia-document-folder",
  "npc-expert-eva",
  "npc-thief-franta"
]);

const sha256 = buffer => crypto.createHash("sha256").update(buffer).digest("hex");
const localPath = url => {
  assert.match(url, /^\.\/assets\//);
  return url.slice(2);
};

test("Slavia asset pack has stable canonical IDs, budgets and lifecycle ownership", () => {
  const byId = new Map(manifest.map(entry => [entry.id, entry]));
  assert.equal(new Set(manifest.map(entry => entry.id)).size, manifest.length);
  for (const id of expectedAssets) {
    const entry = byId.get(id);
    assert.ok(entry, `missing ${id}`);
    assert.equal(entry.preload, "level:slavia");
    assert.equal(entry.disposeOwner, "LevelScene:slavia");
    assert.ok(entry.budget?.bytes > 0, `${id} missing byte budget`);
    assert.ok(entry.metrics?.bytes > 0, `${id} missing byte metric`);
    assert.ok(entry.metrics.bytes <= entry.budget.bytes, `${id} exceeds byte budget`);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(byId.has("npc-rival-franta"), false);
});

test("Slavia manifest integrity matches physical production asset files", () => {
  const byId = new Map(manifest.map(entry => [entry.id, entry]));
  for (const id of expectedAssets) {
    const entry = byId.get(id);
    const buffer = readBuffer(localPath(entry.url));
    assert.equal(buffer.byteLength, entry.metrics.bytes, `${id} byte metric mismatch`);
    assert.equal(sha256(buffer), entry.sha256, `${id} SHA-256 mismatch`);
  }
  const slaviaEntries = manifest.filter(entry => entry.preload === "level:slavia");
  assert.equal(slaviaEntries.some(entry => /\.svg$|\.gltf$/i.test(entry.url)), false);
});

test("Slavia PNG sprites have valid signatures and declared dimensions", () => {
  const byId = new Map(manifest.map(entry => [entry.id, entry]));
  for (const id of ["npc-expert-eva", "npc-thief-franta"]) {
    const entry = byId.get(id);
    assert.match(entry.url, /\.png$/);
    const buffer = readBuffer(localPath(entry.url));
    assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(buffer.readUInt32BE(16), entry.dimensions.width);
    assert.equal(buffer.readUInt32BE(20), entry.dimensions.height);
    assert.ok(Math.max(entry.dimensions.width, entry.dimensions.height) <= entry.budget.textureMax);
  }
});

test("Slavia GLB models are valid, bounded and within triangle budgets", () => {
  const byId = new Map(manifest.map(entry => [entry.id, entry]));
  const expectedBounds = new Map([
    ["model-slavia-kd-building", { min: [-3, 0, -1.6], max: [3, 4.4, 0.8] }],
    ["model-slavia-document-folder", { min: [-0.45, 0, -0.3], max: [0.45, 0.13, 0.3] }]
  ]);
  for (const [id, bounds] of expectedBounds) {
    const entry = byId.get(id);
    assert.equal(entry.type, "gltf");
    assert.match(entry.url, /\.glb$/);
    assert.deepEqual(entry.scale, { unit: "meter", upAxis: "Y", forwardAxis: "-Z" });
    assert.equal(entry.pivot?.kind, "ground-center");
    assert.ok(entry.pivot?.toleranceMeters > 0);
    assert.deepEqual(entry.boundsMeters, bounds);
    assert.ok(entry.metrics.triangles > 0);
    assert.ok(entry.metrics.triangles <= entry.budget.triangles);
    const buffer = readBuffer(localPath(entry.url));
    assert.equal(buffer.subarray(0, 4).toString("ascii"), "glTF");
    assert.equal(buffer.readUInt32LE(4), 2);
    assert.equal(buffer.readUInt32LE(8), buffer.byteLength);
  }
});

test("Slavia data and canonical scene references resolve through the manifest", () => {
  const ids = new Set(manifest.map(entry => entry.id));
  for (const id of expectedAssets) {
    assert.ok(slaviaData.includes(`assetId: "${id}"`), `Slavia data missing ${id}`);
    assert.ok(ids.has(id), `manifest missing ${id}`);
  }
  assert.ok(ids.has("terrain-slavia-event-plate-v7"));
  assert.ok(ids.has("foreground-slavia-event-edge-v7"));
  assert.match(slaviaScene, /this\.model\("model-slavia-kd-building"\)/);
  assert.match(slaviaScene, /this\.model\("model-slavia-document-folder"\)/);
  assert.match(slaviaScene, /this\.texture\(V7_PLATE_ASSET\)/);
  assert.match(slaviaScene, /scale: 104/);
  assert.match(slaviaScene, /\["thief-franta", "npc-thief-franta"\]/);
  assert.doesNotMatch(slaviaScene, /npc-rival-franta|ProductionSlaviaScene/);
});

test("service worker pre-caches only canonical Slavia scene modules", () => {
  const byId = new Map(manifest.map(entry => [entry.id, entry]));
  const paths = new Set(expectedAssets.map(id => byId.get(id).url));
  assert.ok(serviceWorker.includes('"./src/scenes/SlaviaScene.js"'));
  assert.doesNotMatch(serviceWorker, /ProductionSlaviaScene|BesedniceSlaviaBridgeScene/);
  for (const path of paths) assert.ok(serviceWorker.includes(`"${path}"`));
  assert.ok(serviceWorker.includes('"./assets/textures/terrain/slavia-event-plate-v7.webp"'));
  assert.ok(serviceWorker.includes('"./assets/sprites/foreground/slavia-event-edge-v7.webp"'));
  assert.match(serviceWorker, /lovec-vltavinu-slavia-v7-0-release/);
});
