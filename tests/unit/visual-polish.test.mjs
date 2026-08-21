import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "../../vendor/three.module.min.js";
import { createProceduralMoldavite, getProceduralMoldaviteProfile } from "../../src/render/ProceduralMoldavite.js";
import { createIdleWrapper, updateIdlePulse, resetIdlePulse, createPickupTween, updatePickupTween, cancelPickupTween } from "../../src/render/VisualEffects.js";

const positions = mesh => Array.from(mesh.geometry.attributes.position.array);
const dispose = object => {
  object?.traverse?.(node => {
    node.geometry?.dispose?.();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) material?.dispose?.();
  });
};

test("procedural moldavite is deterministic for the same seed and parameters", () => {
  const first = createProceduralMoldavite(THREE, { locality: "nesmen", rarity: "B", seed: 1234 });
  const second = createProceduralMoldavite(THREE, { locality: "nesmen", rarity: "B", seed: 1234 });
  const different = createProceduralMoldavite(THREE, { locality: "nesmen", rarity: "B", seed: 1235 });

  assert.deepEqual(positions(first), positions(second));
  assert.notDeepEqual(positions(first), positions(different));
  assert.deepEqual(first.userData.proceduralMoldavite, second.userData.proceduralMoldavite);

  dispose(first);
  dispose(second);
  dispose(different);
});

test("locality and rarity profiles change only the visual moldavite contract", () => {
  const chlum = getProceduralMoldaviteProfile("chlum", "B");
  const nesmen = getProceduralMoldaviteProfile("nesmen", "B");
  const besednice = getProceduralMoldaviteProfile("besednice", "A");
  const rarityC = getProceduralMoldaviteProfile("chlum", "C");
  const rarityB = getProceduralMoldaviteProfile("chlum", "B");
  const rarityA = getProceduralMoldaviteProfile("chlum", "A");

  assert.ok(nesmen.deformation < besednice.deformation);
  assert.ok(chlum.scale[0] < besednice.scale[0]);
  assert.ok(rarityC.scale[0] < rarityB.scale[0]);
  assert.ok(rarityB.scale[0] < rarityA.scale[0]);
  assert.ok(rarityC.deformation < rarityB.deformation);
  assert.ok(rarityB.deformation < rarityA.deformation);
});

test("idle wrapper pulses only its wrapper and preserves child flip/scale", () => {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
  sprite.scale.set(-82, 108, 1);
  const wrapper = createIdleWrapper(THREE, sprite, { amplitude: 0.02, frequency: 1.5, phase: 0 });

  const childScale = [sprite.scale.x, sprite.scale.y, sprite.scale.z];
  assert.equal(wrapper.scale.y, 1);
  assert.equal(updateIdlePulse(wrapper, 1 / 6), true);
  assert.ok(wrapper.scale.y > 1);
  assert.deepEqual([sprite.scale.x, sprite.scale.y, sprite.scale.z], childScale);
  assert.equal(resetIdlePulse(wrapper), true);
  assert.equal(wrapper.scale.y, 1);

  dispose(wrapper);
});

test("pickup tween scales and fades within 150 ms and can be safely cancelled", () => {
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.96 })
  );
  mesh.scale.set(5, 4, 3);
  const tween = createPickupTween(mesh, { duration: 0.15, targetScale: 1.25 });

  assert.ok(tween);
  assert.equal(updatePickupTween(tween, 0.075), false);
  assert.ok(mesh.scale.x > 5 && mesh.scale.x < 6.25);
  assert.ok(mesh.material.opacity > 0 && mesh.material.opacity < 0.96);
  assert.equal(updatePickupTween(tween, 0.075), true);
  assert.ok(Math.abs(mesh.scale.x - 6.25) < 1e-9);
  assert.equal(mesh.material.opacity, 0);

  const second = createPickupTween(mesh, { duration: 0.15, targetScale: 1.25 });
  assert.equal(cancelPickupTween(second, { restore: true }), true);
  assert.ok(Math.abs(mesh.scale.x - 6.25) < 1e-9);
  assert.equal(mesh.material.opacity, 0);

  dispose(mesh);
});
