import test from "node:test";
import assert from "node:assert/strict";
import { AnimationSystem, createAnimation } from "../../src/systems/AnimationSystem.js";
import { resolveSpriteFrameUv, syncSpriteVisual } from "../../src/render/ThreeRenderer.js";

const createWorld = components => ({
  query(name) {
    if (name === "animation") return [[1, components.animation]];
    return [];
  },
  get(_entity, name) {
    return components[name] ?? null;
  }
});

test("motion-driven walk animation advances, mirrors left and resets on idle", () => {
  const events = [];
  const animation = createAnimation({
    clip: "walk",
    frames: [0, 1, 2, 3],
    fps: 8,
    playing: false,
    motionDriven: true,
    motionThreshold: 0.001,
    resetOnIdle: true
  });
  const components = {
    animation,
    sprite: { frame: 0, columns: 4, rows: 4, flipX: false },
    previousTransform: { x: 0, y: 0 },
    transform: { x: 2, y: 0 }
  };
  const system = new AnimationSystem({ events: { emit: (name, payload) => events.push({ name, payload }) } });
  const world = createWorld(components);

  assert.equal(system.update(world, 0.13), 1);
  assert.equal(animation.playing, true);
  assert.equal(animation.frame, 1);
  assert.equal(components.sprite.frame, 1);
  assert.equal(components.sprite.flipX, false);

  components.previousTransform = { x: 2, y: 0 };
  components.transform = { x: 0, y: 0 };
  system.update(world, 0.13);
  assert.equal(components.sprite.flipX, true);

  components.previousTransform = { ...components.transform };
  system.update(world, 0.13);
  assert.equal(animation.playing, false);
  assert.equal(animation.frame, 0);
  assert.equal(components.sprite.frame, 0);
  assert.ok(events.some(event => event.name === "animation:frame" && event.payload.clip === "walk"));
});

test("sprite UV binding maps frames and preserves base width while mirroring", () => {
  const texture = {
    repeat: { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } },
    offset: { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } },
    needsUpdate: false
  };
  const object = {
    isSprite: true,
    material: { map: texture },
    scale: { x: 72 },
    userData: {}
  };

  assert.deepEqual(resolveSpriteFrameUv(5, 4, 4), {
    frame: 5,
    repeatX: 0.25,
    repeatY: 0.25,
    offsetX: 0.25,
    offsetY: 0.5
  });
  assert.equal(syncSpriteVisual(object, { frame: 5, columns: 4, rows: 4, flipX: true }), true);
  assert.equal(texture.repeat.x, 0.25);
  assert.equal(texture.repeat.y, 0.25);
  assert.equal(texture.offset.x, 0.25);
  assert.equal(texture.offset.y, 0.5);
  assert.equal(object.scale.x, -72);

  assert.equal(syncSpriteVisual(object, { frame: 5, columns: 4, rows: 4, flipX: false }), true);
  assert.equal(object.scale.x, 72);
});

test("directional walk uses the matching realistic sprite row and idles in the last direction", () => {
  const animation = createAnimation({
    clip: "walk",
    frames: [0, 1, 2, 3],
    fps: 6,
    playing: false,
    motionDriven: true,
    direction: "down",
    directionFrames: {
      down: [0, 1, 2, 3],
      left: [4, 5, 6, 7],
      right: [8, 9, 10, 11],
      up: [12, 13, 14, 15]
    }
  });
  const sprite = { frame: 0, flipX: false };
  const system = new AnimationSystem();

  assert.equal(system.setMotion(animation, sprite, { x: 2, y: 0 }), true);
  assert.equal(animation.direction, "right");
  assert.deepEqual(animation.frames, [8, 9, 10, 11]);
  system.updateAnimation(animation, 0.18);
  assert.equal(sprite.flipX, false);
  assert.equal(animation.frame, 9);

  assert.equal(system.setMotion(animation, sprite, { x: 0, y: 3 }), true);
  assert.equal(animation.direction, "up");
  assert.deepEqual(animation.frames, [12, 13, 14, 15]);
  assert.equal(animation.frame, 13);

  assert.equal(system.setMotion(animation, sprite, { x: 0, y: 0 }), false);
  assert.equal(animation.playing, false);
  assert.equal(animation.frame, 12);
  assert.equal(sprite.frame, 12);
});
