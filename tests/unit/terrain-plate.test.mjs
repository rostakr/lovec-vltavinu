import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import * as THREE from "../../vendor/three.module.min.js";
import { prepareTerrainPlateTexture } from "../../src/render/HybridRenderer.js";
import { createProceduralMoldavite } from "../../src/render/ProceduralMoldavite.js";

const makeTexture = () => ({
  channel: -1,
  wrapS: "repeat",
  wrapT: "repeat",
  repeat: { x: 4, y: 3, set(x, y) { this.x = x; this.y = y; } },
  offset: { x: 0.25, y: 0.5, set(x, y) { this.x = x; this.y = y; } },
  needsUpdate: false,
  clone() {
    const copy = makeTexture();
    copy.channel = this.channel;
    copy.wrapS = this.wrapS;
    copy.wrapT = this.wrapT;
    copy.repeat.x = this.repeat.x;
    copy.repeat.y = this.repeat.y;
    copy.offset.x = this.offset.x;
    copy.offset.y = this.offset.y;
    return copy;
  }
});

test("Chlum V7 production terrain plate is a bounded authored bitmap asset", () => {
  const rootUrl = new URL("../../", import.meta.url);
  const manifest = JSON.parse(fs.readFileSync(new URL("assets/manifests/assets.json", rootUrl), "utf8"));
  const entry = manifest.find(candidate => candidate.id === "terrain-chlum-plate-v7");

  assert.ok(entry);
  assert.equal(entry.url, "./assets/textures/terrain/chlum-plate-v7.webp");
  assert.deepEqual(entry.dimensions, { width: 1600, height: 1200 });
  assert.equal(entry.transparent, false);
  assert.equal(entry.wrap, undefined);
  assert.equal(entry.metrics.bytes, fs.statSync(new URL(entry.url.slice(2), rootUrl)).size);
  assert.ok(entry.metrics.bytes <= entry.budget.bytes);
  assert.equal(entry.budget.textureMax, 2048);
  assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  assert.equal(entry.disposeOwner, "LevelScene:chlum");
});

test("terrain plates clamp edges and never repeat the authored image", () => {
  const source = makeTexture();
  const prepared = prepareTerrainPlateTexture(source, { ClampToEdgeWrapping: "clamp" });

  assert.notEqual(prepared, source);
  assert.equal(prepared.channel, 0);
  assert.equal(prepared.wrapS, "clamp");
  assert.equal(prepared.wrapT, "clamp");
  assert.deepEqual([prepared.repeat.x, prepared.repeat.y], [1, 1]);
  assert.deepEqual([prepared.offset.x, prepared.offset.y], [0, 0]);
  assert.equal(prepared.needsUpdate, true);

  assert.equal(source.wrapS, "repeat");
  assert.deepEqual([source.repeat.x, source.repeat.y], [4, 3]);
});

test("Chlum V7 uses the shared deterministic procedural moldavite mesh", () => {
  const moldavite = createProceduralMoldavite(THREE, { locality: "chlum", rarity: "B", seed: 42 });

  assert.equal(moldavite.isMesh, true);
  assert.equal(moldavite.name, "chlum-v7-moldavite-finding");
  assert.equal(moldavite.userData.assetId, "procedural-chlum-moldavite-v7");
  assert.equal(moldavite.userData.findingVisual, "moldavite");
  assert.deepEqual(moldavite.userData.proceduralMoldavite, {
    locality: "chlum",
    rarity: "B",
    seed: 42,
    deformation: 0.24
  });
  assert.equal(moldavite.material.isMeshStandardMaterial, true);
  assert.ok(moldavite.geometry.attributes.position.count > 0);
  assert.deepEqual([moldavite.scale.x, moldavite.scale.y, moldavite.scale.z], [5, 4, 3]);
  assert.equal(moldavite.position.z, 14);

  moldavite.geometry.dispose();
  moldavite.material.dispose();
});