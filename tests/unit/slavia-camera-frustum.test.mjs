import test from "node:test";
import assert from "node:assert/strict";
import { resolveSlaviaV7CameraZoom } from "../../src/scenes/SlaviaScene.js";
import { resolveBoundedCameraCenter } from "../../src/render/CameraBounds.js";
import { getLevelDefinition } from "../../src/data/levels.js";

const VIEW_HEIGHT = 720;
const BOUNDS = getLevelDefinition("slavia").bounds;

const visibleWorldWidth = (viewportWidth, viewportHeight, zoom) =>
  (VIEW_HEIGHT / zoom) * (viewportWidth / viewportHeight);

const viewports = [
  { name: "desktop 1280x720", width: 1280, height: 720 },
  { name: "iPhone portrait 390x844", width: 390, height: 844 },
  { name: "iPhone landscape 844x390", width: 844, height: 390 }
];

test("Slavia V7 camera never exposes clear colour outside the authored plate", () => {
  for (const viewport of viewports) {
    const zoom = resolveSlaviaV7CameraZoom(viewport.width, viewport.height, VIEW_HEIGHT, BOUNDS.width);
    assert.ok(
      visibleWorldWidth(viewport.width, viewport.height, zoom) <= BOUNDS.width + 1e-9,
      `${viewport.name} frustum is wider than the plate`
    );
    assert.ok((VIEW_HEIGHT / zoom) <= BOUNDS.height + 1e-9, `${viewport.name} frustum is taller than the plate`);
  }
});

test("Slavia V7 keeps the approved world scale across the release matrix", () => {
  for (const viewport of viewports) {
    assert.equal(resolveSlaviaV7CameraZoom(viewport.width, viewport.height, VIEW_HEIGHT, BOUNDS.width), 0.9);
  }
});

test("Slavia V7 camera stays clamped inside level bounds while following the player", () => {
  const zoom = resolveSlaviaV7CameraZoom(844, 390, VIEW_HEIGHT, BOUNDS.width);
  const halfWidth = visibleWorldWidth(844, 390, zoom) / 2;
  const halfHeight = VIEW_HEIGHT / zoom / 2;
  for (const [x, y] of [[0, 0], [1800, 1100], [380, 860], [1630, 520]]) {
    const center = resolveBoundedCameraCenter({
      bounds: BOUNDS,
      x,
      y,
      viewHeight: VIEW_HEIGHT,
      viewportWidth: 844,
      viewportHeight: 390,
      zoom
    });
    assert.ok(center.x - halfWidth >= BOUNDS.x - 1e-9 && center.x + halfWidth <= BOUNDS.x + BOUNDS.width + 1e-9);
    assert.ok(center.y - halfHeight >= BOUNDS.y - 1e-9 && center.y + halfHeight <= BOUNDS.y + BOUNDS.height + 1e-9);
  }
});
