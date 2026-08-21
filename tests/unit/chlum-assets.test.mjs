import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GltfAssetLoader, GLTF_LOADER_REVISION } from "../../src/render/GltfAssetLoader.js";
import { ModelFactory } from "../../src/render/ModelFactory.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "assets/manifests/assets.json"), "utf8"));
const chlumManifest = manifest.filter(entry => entry.preload === "common" || entry.preload === "level:chlum");
const EXPECTED_IDS = [
  "player-hunter-walk",
  "player-hunter-actions-v7",
  "npc-farmer-vaclav",
  "hazard-chlum-tractor-v7",
  "foreground-chlum-wet-verge-v7",
  "finding-vltavin-common",
  "finding-vltavin-rare",
  "finding-vltavin-standard",
  "terrain-chlum-plate-v7",
  "terrain-chlum-field",
  "terrain-chlum-furrows",
  "model-chlum-tractor-no-driver",
  "model-chlum-hay-bale",
  "model-chlum-field-marker",
  "model-chlum-field-fence-segment"
];
const fileFor = entry => path.join(root, entry.url.slice(2));
const arrayBufferFor = entry => {
  const buffer = fs.readFileSync(fileFor(entry));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
};

function triangleCount(model) {
  let triangles = 0;
  model.traverse(node => {
    const geometry = node.geometry;
    if (!geometry) return;
    triangles += geometry.index
      ? geometry.index.count / 3
      : (geometry.getAttribute("position")?.count ?? 0) / 3;
  });
  return triangles;
}

function firstMesh(model) {
  let result = null;
  model.traverse(node => {
    if (!result && node.isMesh) result = node;
  });
  return result;
}

test("Chlum asset manifest has stable IDs, budgets, relative URLs and dispose ownership", () => {
  assert.equal(chlumManifest.length, EXPECTED_IDS.length);
  assert.deepEqual(chlumManifest.map(entry => entry.id), EXPECTED_IDS);
  assert.equal(new Set(manifest.map(entry => entry.id)).size, manifest.length, "global manifest IDs must remain unique");
  for (const entry of chlumManifest) {
    assert.match(entry.url, /^\.\/assets\//);
    assert.ok(entry.preload === "common" || entry.preload === "level:chlum");
    assert.equal(typeof entry.disposeOwner, "string");
    assert.ok(entry.disposeOwner.length > 0);
    const file = fileFor(entry);
    assert.equal(fs.existsSync(file), true, entry.url);
    const bytes = fs.statSync(file).size;
    assert.equal(bytes, entry.metrics.bytes, entry.id);
    assert.ok(bytes <= entry.budget.bytes, entry.id);
  }
});

test("Chlum image and GLB files match declared technical constraints", () => {
  for (const entry of chlumManifest) {
    const file = fileFor(entry);
    const buffer = fs.readFileSync(file);
    if (entry.url.endsWith(".png")) {
      assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", entry.id);
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      assert.deepEqual({ width, height }, entry.dimensions, entry.id);
      assert.ok(Math.max(width, height) <= entry.budget.textureMax, entry.id);
      if (entry.transparent === true) assert.ok([4, 6].includes(buffer[25]), `${entry.id} must preserve PNG alpha`);
    } else if (entry.url.endsWith(".webp")) {
      assert.equal(buffer.subarray(0, 4).toString("ascii"), "RIFF", entry.id);
      assert.equal(buffer.subarray(8, 12).toString("ascii"), "WEBP", entry.id);
    } else if (entry.url.endsWith(".glb")) {
      assert.equal(buffer.subarray(0, 4).toString("ascii"), "glTF", entry.id);
      assert.equal(buffer.readUInt32LE(4), 2, entry.id);
      assert.equal(buffer.readUInt32LE(8), buffer.length, entry.id);
      assert.ok(entry.pivot && entry.boundsMeters, entry.id);
      assert.ok(entry.metrics.triangles <= entry.budget.triangles, entry.id);
      if (entry.id === "model-chlum-tractor-no-driver") assert.equal(entry.requirements.visibleDriver, false);
    }
  }
});

test("standard Three.js GLTFLoader r185 parses every Chlum model and preserves triangle counts", async () => {
  const loader = new GltfAssetLoader();
  for (const entry of chlumManifest.filter(asset => asset.type === "gltf")) {
    const model = await loader.parse(arrayBufferFor(entry), "");
    assert.equal(model.isGroup || model.isScene, true, entry.id);
    assert.ok(firstMesh(model), entry.id);
    assert.equal(triangleCount(model), entry.metrics.triangles, entry.id);
    assert.equal(model.userData.gltfLoaderRevision, GLTF_LOADER_REVISION, entry.id);
  }
});

test("ModelFactory clones resources and binds a standard GLTF source through the shared renderer", async () => {
  const entry = chlumManifest.find(asset => asset.id === "model-chlum-tractor-no-driver");
  const source = await new GltfAssetLoader().parse(arrayBufferFor(entry), "");
  const bindings = [];
  const renderer = {
    bindEntity(entity, object, layer) {
      bindings.push({ entity, object, layer });
      return object;
    },
    disposeObject() {}
  };
  const factory = new ModelFactory({ renderer });
  const bound = factory.bind(77, source, {
    assetId: entry.id,
    layer: "actors",
    rotationX: Math.PI / 2,
    scale: 44,
    z: 8
  });

  assert.notEqual(bound, source);
  assert.deepEqual(bindings.map(item => ({ entity: item.entity, layer: item.layer })), [{ entity: 77, layer: "actors" }]);
  assert.equal(bound.userData.assetId, entry.id);
  assert.equal(bound.scale.x, 44);
  assert.equal(bound.rotation.x, Math.PI / 2);
  assert.equal(bound.position.z, 8);
  const sourceMesh = firstMesh(source);
  const boundMesh = firstMesh(bound);
  assert.notEqual(boundMesh.geometry, sourceMesh.geometry);
  assert.notEqual(boundMesh.material, sourceMesh.material);
});

test("ChlumScene používá manifest preload bez ručních seznamů a type override", () => {
  const source = fs.readFileSync(path.join(root, "src/scenes/ChlumScene.js"), "utf8");
  assert.doesNotMatch(source, /TEXTURE_IDS|MODEL_IDS/);
  assert.doesNotMatch(source, /\.load\(\{\s*\.\.\.entry,\s*type:/);
  assert.match(source, /selectPreload\(this\.level\.assetGroups\)/);
});

test("Chlum V7 renders the tractor and foreground from authored transparent sprites", () => {
  const source = fs.readFileSync(path.join(root, "src/scenes/ChlumV7Scene.js"), "utf8");
  assert.match(source, /this\.texture\("hazard-chlum-tractor-v7"\)/);
  assert.match(source, /this\.texture\("foreground-chlum-wet-verge-v7"\)/);
  assert.match(source, /assetId: "hazard-chlum-tractor-v7"/);
  assert.match(source, /sprite\.flipX = patrol\.direction < 0/);
  assert.match(source, /foreground\.name = "chlum-v7-foreground-occlusion"/);
  assert.doesNotMatch(source, /modelFactory\.bind\(this\.tractorEntity/);
});

test("Chlum V7 wires every required hunter action pose through the animation controller", () => {
  const source = fs.readFileSync(path.join(root, "src/scenes/ChlumV7Scene.js"), "utf8");
  assert.match(source, /this\.texture\("player-hunter-actions-v7"\)/);
  for (const clip of ["search", "pick-up", "talk", "caught", "dig", "celebration"]) {
    assert.match(source, new RegExp(`["']?${clip}["']?: Object\\.freeze`), clip);
  }
  assert.match(source, /this\.app\.animations\.playAction\(animation, clip/);
  assert.match(source, /syncSpriteVisual\(this\.playerActionSprite/);
  assert.match(source, /this\.playHunterAction\("search"/);
  assert.match(source, /this\.playHunterAction\("pick-up"/);
  assert.match(source, /this\.playHunterAction\("talk"/);
  assert.match(source, /this\.playHunterAction\("caught"/);
  assert.match(source, /this\.playHunterAction\("celebration"/);
});
