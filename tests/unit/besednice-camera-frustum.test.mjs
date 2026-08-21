import test from "node:test";
import assert from "node:assert/strict";
import { resolveBesedniceV7CameraZoom } from "../../src/scenes/BesedniceScene.js";

const VIEW_HEIGHT = 720;
const BOUNDS_WIDTH = 1680;

const visibleWorldWidth = (viewportWidth, viewportHeight, zoom) =>
  (VIEW_HEIGHT / zoom) * (viewportWidth / viewportHeight);

test("Besednice V7 landscape camera stays inside terrain bounds", () => {
  const zoom = resolveBesedniceV7CameraZoom(844, 390, VIEW_HEIGHT, BOUNDS_WIDTH);
  assert.ok(zoom >= 0.94, `expected safe landscape zoom, got ${zoom}`);
  assert.ok(
    visibleWorldWidth(844, 390, zoom) <= BOUNDS_WIDTH,
    "844x390 frustum must not expose clear-color side strips"
  );
});

test("Besednice V7 keeps approved desktop and portrait composition", () => {
  assert.equal(resolveBesedniceV7CameraZoom(1280, 720, VIEW_HEIGHT, BOUNDS_WIDTH), 0.9);
  assert.equal(resolveBesedniceV7CameraZoom(390, 844, VIEW_HEIGHT, BOUNDS_WIDTH), 0.9);
});
