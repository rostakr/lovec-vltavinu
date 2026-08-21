import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveBoundedCameraCenter,
  resolveFollowCameraCenter,
  resetBoundedCameraFollow,
  setBoundedCameraCenter
} from "../../src/render/CameraBounds.js";
import { resolveChlumV7CameraZoom } from "../../src/scenes/ChlumV7Scene.js";

test("desktop camera stays inside a level at an edge spawn", () => {
  const center = resolveBoundedCameraCenter({
    bounds: { x: 0, y: 0, width: 1500, height: 1200 },
    x: 180,
    y: 980,
    viewHeight: 720,
    viewportWidth: 1280,
    viewportHeight: 720,
    zoom: 0.92
  });

  assert.ok(center.x > 690 && center.x < 700);
  assert.ok(center.y > 808 && center.y < 810);
});

test("mobile camera can follow a player without exposing space outside bounds", () => {
  const center = resolveBoundedCameraCenter({
    bounds: { x: 0, y: 0, width: 1680, height: 1280 },
    x: 140,
    y: 1040,
    viewHeight: 720,
    viewportWidth: 390,
    viewportHeight: 844,
    zoom: 0.9
  });

  assert.ok(center.x > 184 && center.x < 186);
  assert.equal(center.y, 880);
});

test("camera centers a map that is smaller than the visible viewport", () => {
  const center = resolveBoundedCameraCenter({
    bounds: { x: 20, y: 30, width: 500, height: 400 },
    x: 30,
    y: 40,
    viewHeight: 720,
    viewportWidth: 1280,
    viewportHeight: 720,
    zoom: 1
  });

  assert.deepEqual(center, { x: 270, y: 230, zoom: 1 });
});

test("follow camera keeps a small player movement inside its dead zone", () => {
  const center = resolveFollowCameraCenter({
    bounds: { x: 0, y: 0, width: 2200, height: 1600 },
    targetX: 1040,
    targetY: 820,
    currentX: 1000,
    currentY: 800,
    viewHeight: 720,
    viewportWidth: 1280,
    viewportHeight: 720,
    zoom: 1,
    deadZoneRatio: 0.07
  });

  assert.deepEqual(center, { x: 1000, y: 800, zoom: 1 });
});

test("follow camera damps continuous movement instead of hard-locking to the player", () => {
  const center = resolveFollowCameraCenter({
    bounds: { x: 0, y: 0, width: 2600, height: 1800 },
    targetX: 1500,
    targetY: 900,
    currentX: 1100,
    currentY: 900,
    viewHeight: 720,
    viewportWidth: 1280,
    viewportHeight: 720,
    zoom: 1,
    deadZoneRatio: 0.07,
    damping: 0.16
  });

  assert.ok(center.x > 1100);
  assert.ok(center.x < 1500);
  assert.equal(center.y, 900);
});

test("follow camera snaps after a large teleport", () => {
  const center = resolveFollowCameraCenter({
    bounds: { x: 0, y: 0, width: 3200, height: 2200 },
    targetX: 2450,
    targetY: 1500,
    currentX: 900,
    currentY: 700,
    viewHeight: 720,
    viewportWidth: 1280,
    viewportHeight: 720,
    zoom: 1,
    snapDistanceRatio: 0.62
  });
  const target = resolveBoundedCameraCenter({
    bounds: { x: 0, y: 0, width: 3200, height: 2200 },
    x: 2450,
    y: 1500,
    viewHeight: 720,
    viewportWidth: 1280,
    viewportHeight: 720,
    zoom: 1
  });

  assert.deepEqual(center, target);
});

test("renderer adapter snaps on first target then follows smoothly", () => {
  const calls = [];
  const renderer = {
    viewHeight: 720,
    width: 1280,
    height: 720,
    camera: { position: { x: 0, y: 0 } },
    setCameraCenter(x, y, zoom) {
      this.camera.position.x = x;
      this.camera.position.y = y;
      calls.push([x, y, zoom]);
    }
  };
  const bounds = { x: 0, y: 0, width: 2600, height: 1800 };

  const first = setBoundedCameraCenter(renderer, bounds, 1000, 900, 1);
  const second = setBoundedCameraCenter(renderer, bounds, 1400, 900, 1);

  assert.deepEqual(calls[0], [first.x, first.y, 1]);
  assert.ok(second.x > first.x);
  assert.ok(second.x < 1400);
  assert.equal(second.y, first.y);
  assert.equal(resetBoundedCameraFollow(renderer), true);
});

test("renderer adapter explicit snap bypasses dead-zone and damping for short resets", () => {
  const renderer = {
    viewHeight: 720,
    width: 1280,
    height: 720,
    camera: { position: { x: 0, y: 0 } },
    setCameraCenter(x, y, zoom) {
      this.camera.position.x = x;
      this.camera.position.y = y;
      this.camera.zoom = zoom;
    }
  };
  const bounds = { x: 0, y: 0, width: 2600, height: 1800 };

  setBoundedCameraCenter(renderer, bounds, 1000, 900, 1);
  const snapped = setBoundedCameraCenter(renderer, bounds, 1200, 900, 1, { snap: true });
  const target = resolveBoundedCameraCenter({
    bounds,
    x: 1200,
    y: 900,
    viewHeight: 720,
    viewportWidth: 1280,
    viewportHeight: 720,
    zoom: 1
  });

  assert.deepEqual(snapped, target);
  assert.deepEqual([renderer.camera.position.x, renderer.camera.position.y, renderer.camera.zoom], [target.x, target.y, 1]);
});

test("renderer adapter preserves immediate mode for simple render adapters", () => {
  const calls = [];
  const renderer = {
    viewHeight: 720,
    width: 1280,
    height: 720,
    setCameraCenter: (...args) => calls.push(args)
  };

  const center = setBoundedCameraCenter(renderer, { x: 0, y: 0, width: 1800, height: 1100 }, 160, 860, 0.9);

  assert.deepEqual(calls, [[center.x, center.y, 0.9]]);
  assert.ok(center.x > 711 && center.x < 712);
  assert.equal(center.y, 700);
});

test("V7 Chlum camera keeps portrait calm and tightens wide compositions", () => {
  const portrait = resolveChlumV7CameraZoom(390, 844);
  const desktop = resolveChlumV7CameraZoom(1280, 720);
  const landscape = resolveChlumV7CameraZoom(844, 390);

  assert.equal(portrait, 1.02);
  assert.equal(desktop, 1.16);
  assert.equal(landscape, 1.24);
  assert.ok(landscape > desktop);
  assert.ok(desktop > portrait);
});

test("V7 Chlum camera profile is deterministic for invalid viewport metadata", () => {
  assert.equal(resolveChlumV7CameraZoom(0, 0), 1.08);
  assert.equal(resolveChlumV7CameraZoom(undefined, undefined), 1.08);
});
