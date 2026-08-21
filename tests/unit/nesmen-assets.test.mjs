import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GltfAssetLoader, GLTF_LOADER_REVISION } from "../../src/render/GltfAssetLoader.js";
import { resolveNesmenV7CameraZoom } from "../../src/scenes/NesmenScene.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "assets/manifests/assets.json"), "utf8"));
const entries = manifest.filter(entry => entry.preload === "level:nesmen");
const EXPECTED_IDS = [
  "npc-forester-jan",
  "terrain-nesmen-forest-plate-v7",
  "foreground-nesmen-forest-edge-v7",
  "finding-vltavin-nesmen",
  "terrain-nesmen-sand-profile",
  "model-nesmen-profile-marker"
];
const fileFor = entry => path.join(root, entry.url.slice(2));
const bufferFor = entry => fs.readFileSync(fileFor(entry));
const arrayBufferFor = entry => {
  const buffer = bufferFor(entry);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
};

function triangleCount(model) {
  let triangles = 0;
  model.traverse(node => {
    const geometry = node.geometry;
    if (!geometry) return;
    triangles += geometry.index ? geometry.index.count / 3 : (geometry.getAttribute("position")?.count ?? 0) / 3;
  });
  return triangles;
}

test("Nesměň manifest contains the complete budgeted V7 asset group", () => {
  assert.deepEqual(entries.map(entry => entry.id), EXPECTED_IDS);
  assert.equal(new Set(manifest.map(entry => entry.id)).size, manifest.length);
  for (const entry of entries) {
    assert.match(entry.url, /^\.\/assets\//);
    assert.equal(entry.preload, "level:nesmen");
    assert.equal(entry.disposeOwner, "LevelScene:nesmen");
    const buffer = bufferFor(entry);
    assert.equal(buffer.length, entry.metrics.bytes, entry.id);
    assert.ok(buffer.length <= entry.budget.bytes, entry.id);
    assert.equal(crypto.createHash("sha256").update(buffer).digest("hex"), entry.sha256, entry.id);
  }
});

test("Nesměň image dimensions and GLB triangle counts match the manifest", async () => {
  const loader = new GltfAssetLoader();
  for (const entry of entries) {
    const buffer = bufferFor(entry);
    if (entry.url.endsWith(".png")) {
      assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", entry.id);
      const dimensions = { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
      assert.deepEqual(dimensions, entry.dimensions, entry.id);
      assert.ok(Math.max(dimensions.width, dimensions.height) <= entry.budget.textureMax, entry.id);
    } else if (entry.url.endsWith(".webp")) {
      assert.equal(buffer.subarray(0, 4).toString("ascii"), "RIFF", entry.id);
      assert.equal(buffer.subarray(8, 12).toString("ascii"), "WEBP", entry.id);
    } else {
      assert.equal(entry.type, "gltf", entry.id);
      assert.equal(buffer.subarray(0, 4).toString("ascii"), "glTF", entry.id);
      assert.equal(buffer.readUInt32LE(4), 2, entry.id);
      assert.equal(buffer.readUInt32LE(8), buffer.length, entry.id);
      const model = await loader.parse(arrayBufferFor(entry), "");
      assert.equal(triangleCount(model), entry.metrics.triangles, entry.id);
      assert.equal(model.userData.gltfLoaderRevision, GLTF_LOADER_REVISION, entry.id);
      assert.ok(entry.metrics.triangles <= entry.budget.triangles, entry.id);
    }
  }
});

test("NesmenScene uses level asset groups without manual ID arrays or type overrides", () => {
  const source = fs.readFileSync(path.join(root, "src/scenes/NesmenScene.js"), "utf8");
  assert.match(source, /selectPreload\(this\.level\.assetGroups\)/);
  assert.doesNotMatch(source, /TEXTURE_IDS|MODEL_IDS/);
  assert.doesNotMatch(source, /\.load\(\{\s*\.\.\.entry,\s*type:/);
  assert.match(source, /createTerrainPlate\(environmentTexture/);
  assert.match(source, /V7_FOREGROUND_ASSET/);
  assert.match(source, /"foreground"/);
});

test("Nesměň V7 camera keeps intentional desktop and iPhone compositions", () => {
  assert.equal(resolveNesmenV7CameraZoom(1280, 720), 1.04);
  assert.equal(resolveNesmenV7CameraZoom(390, 844), 0.94);
  assert.equal(resolveNesmenV7CameraZoom(844, 390), 1.12);
});
