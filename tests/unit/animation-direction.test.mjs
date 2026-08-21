import assert from "node:assert/strict";
import test from "node:test";
import {
  AnimationSystem,
  resolveCardinalDirection,
  resolveEightWayDirection,
  setAnimationClip
} from "../../src/systems/AnimationSystem.js";

test("cardinal resolver preserves legacy four-direction behavior", () => {
  assert.equal(resolveCardinalDirection(1, 0), "right");
  assert.equal(resolveCardinalDirection(-1, 0), "left");
  assert.equal(resolveCardinalDirection(0, 1), "up");
  assert.equal(resolveCardinalDirection(0, -1), "down");
});

test("eight-way resolver selects diagonals for balanced movement", () => {
  assert.equal(resolveEightWayDirection(1, 1), "upRight");
  assert.equal(resolveEightWayDirection(-1, 1), "upLeft");
  assert.equal(resolveEightWayDirection(1, -1), "downRight");
  assert.equal(resolveEightWayDirection(-1, -1), "downLeft");
});

test("eight-way resolver keeps strongly axial movement cardinal", () => {
  assert.equal(resolveEightWayDirection(1, 0.1), "right");
  assert.equal(resolveEightWayDirection(-0.1, 1), "up");
  assert.equal(resolveEightWayDirection(0.1, -1), "down");
});

test("motion animation uses diagonal frames when the asset provides them", () => {
  const system = new AnimationSystem();
  const animation = {
    clip: "walk",
    frames: [0, 1],
    fps: 8,
    loop: true,
    playing: false,
    index: 0,
    elapsed: 0,
    completed: false,
    frame: 0,
    direction: "down",
    directionFrames: {
      down: [0, 1],
      right: [2, 3],
      upRight: [4, 5]
    }
  };
  const sprite = { frame: 0, flipX: false };

  system.setMotion(animation, sprite, { x: 1, y: 1 });

  assert.equal(animation.direction, "upRight");
  assert.deepEqual(animation.frames, [4, 5]);
  assert.equal(animation.playing, true);
});

test("four-direction sheets remain valid when a diagonal is requested", () => {
  const system = new AnimationSystem();
  const animation = {
    clip: "walk",
    frames: [0, 1],
    fps: 8,
    loop: true,
    playing: false,
    index: 0,
    elapsed: 0,
    completed: false,
    frame: 0,
    direction: "down",
    directionFrames: {
      down: [0, 1],
      left: [2, 3],
      right: [4, 5],
      up: [6, 7]
    }
  };
  const sprite = { frame: 0, flipX: false };

  system.setMotion(animation, sprite, { x: 1, y: 1 });

  assert.equal(animation.direction, "up");
  assert.deepEqual(animation.frames, [6, 7]);
});

test("legacy directional animations keep their original idle reset semantics", () => {
  const system = new AnimationSystem();
  const animation = {
    clip: "walk",
    frames: [0, 1],
    fps: 8,
    loop: true,
    playing: true,
    index: 1,
    elapsed: 0,
    completed: false,
    frame: 1,
    direction: "right",
    directionFrames: {
      down: [0, 1],
      right: [2, 3]
    }
  };
  const sprite = { frame: 1, flipX: false };

  system.setMotion(animation, sprite, { x: 0, y: 0 });

  assert.equal(animation.direction, "right");
  assert.deepEqual(animation.frames, [0, 1]);
  assert.equal(animation.frame, 0);
  assert.equal(animation.playing, false);
});

test("clip registry switches between directional walk and idle poses", () => {
  const system = new AnimationSystem();
  const animation = {
    clip: "idle",
    frames: [0],
    fps: 1,
    loop: true,
    playing: false,
    index: 0,
    elapsed: 0,
    completed: false,
    frame: 0,
    direction: "down",
    directionFrames: { down: [0], right: [8] },
    motionClip: "walk",
    idleClip: "idle",
    clips: {
      idle: {
        frames: [0],
        fps: 1,
        loop: true,
        directionFrames: { down: [0], right: [8] }
      },
      walk: {
        frames: [0, 1, 2, 3],
        fps: 6,
        loop: true,
        directionFrames: { down: [0, 1, 2, 3], right: [8, 9, 10, 11] }
      }
    }
  };
  const sprite = { frame: 0, flipX: false };

  system.setMotion(animation, sprite, { x: 1, y: 0 });
  assert.equal(animation.clip, "walk");
  assert.equal(animation.direction, "right");
  assert.deepEqual(animation.frames, [8, 9, 10, 11]);
  assert.equal(animation.playing, true);

  system.setMotion(animation, sprite, { x: 0, y: 0 });
  assert.equal(animation.clip, "idle");
  assert.equal(animation.direction, "right");
  assert.deepEqual(animation.frames, [8]);
  assert.equal(animation.frame, 8);
  assert.equal(animation.playing, false);
});

test("unknown optional clip leaves the current animation untouched", () => {
  const animation = {
    clip: "idle",
    frames: [0],
    fps: 1,
    loop: true,
    playing: false,
    index: 0,
    elapsed: 0,
    completed: false,
    frame: 0,
    clips: { idle: { frames: [0], fps: 1, loop: true } }
  };

  assert.equal(setAnimationClip(animation, "search"), false);
  assert.equal(animation.clip, "idle");
  assert.deepEqual(animation.frames, [0]);
});

test("action clip has priority over motion until it completes", () => {
  const system = new AnimationSystem();
  const animation = {
    clip: "idle",
    frames: [0],
    fps: 1,
    loop: true,
    playing: false,
    index: 0,
    elapsed: 0,
    completed: false,
    frame: 0,
    direction: "down",
    directionFrames: { down: [0] },
    motionClip: "walk",
    idleClip: "idle",
    actionClip: null,
    actionInterruptible: false,
    clips: {
      idle: { frames: [0], fps: 1, loop: true, directionFrames: { down: [0] } },
      walk: { frames: [1, 2], fps: 8, loop: true, directionFrames: { down: [1, 2], right: [3, 4] } },
      search: { frames: [20, 21, 22], fps: 10, loop: false }
    }
  };
  const sprite = { frame: 0, flipX: false };

  assert.equal(system.playAction(animation, "search"), true);
  assert.equal(animation.clip, "search");
  assert.equal(animation.actionClip, "search");

  system.setMotion(animation, sprite, { x: 1, y: 0 });
  assert.equal(animation.clip, "search");
  assert.equal(animation.actionClip, "search");

  system.updateAnimation(animation, 0.31);
  assert.equal(animation.completed, true);
  assert.equal(animation.playing, false);

  system.setMotion(animation, sprite, { x: 1, y: 0 });
  assert.equal(animation.actionClip, null);
  assert.equal(animation.clip, "walk");
  assert.equal(animation.direction, "right");
  assert.equal(animation.playing, true);
});

test("directional action clip resolves current facing before the next motion tick", () => {
  const system = new AnimationSystem();
  const animation = {
    clip: "idle",
    frames: [8],
    fps: 1,
    loop: true,
    playing: false,
    index: 0,
    elapsed: 0,
    completed: false,
    frame: 8,
    direction: "right",
    directionFrames: { right: [8] },
    actionClip: null,
    clips: {
      idle: { frames: [8], fps: 1, loop: true, directionFrames: { right: [8] } },
      "pick-up": {
        fps: 10,
        loop: false,
        directionFrames: {
          down: [20, 21],
          right: [30, 31]
        }
      }
    }
  };

  assert.equal(system.playAction(animation, "pick-up"), true);
  assert.equal(animation.clip, "pick-up");
  assert.deepEqual(animation.frames, [30, 31]);
  assert.equal(animation.frame, 30);
  assert.equal(animation.direction, "right");
  assert.equal(animation.playing, true);
});

test("missing semantic action clip is a safe no-op", () => {
  const system = new AnimationSystem();
  const animation = {
    clip: "idle",
    frames: [0],
    fps: 1,
    loop: true,
    playing: false,
    index: 0,
    elapsed: 0,
    completed: false,
    frame: 0,
    actionClip: null,
    clips: { idle: { frames: [0], fps: 1, loop: true } }
  };

  assert.equal(system.playAction(animation, "pick-up"), false);
  assert.equal(animation.clip, "idle");
  assert.equal(animation.actionClip, null);
  assert.deepEqual(animation.frames, [0]);
});

test("single-frame non-loop action completes deterministically", () => {
  const events = [];
  const system = new AnimationSystem({ events: { emit: (name, payload) => events.push([name, payload]) } });
  const animation = {
    clip: "idle",
    frames: [0],
    fps: 1,
    loop: true,
    playing: false,
    index: 0,
    elapsed: 0,
    completed: false,
    frame: 0,
    actionClip: null,
    clips: {
      idle: { frames: [0], fps: 1, loop: true },
      caught: { frames: [7], fps: 5, loop: false }
    }
  };

  assert.equal(system.playAction(animation, "caught"), true);
  assert.equal(animation.playing, true);
  system.updateAnimation(animation, 0.21, 42);

  assert.equal(animation.frame, 7);
  assert.equal(animation.completed, true);
  assert.equal(animation.playing, false);
  assert.deepEqual(events, [["animation:complete", { entity: 42, clip: "caught" }]]);
});

test("interruptible action yields to real movement", () => {
  const system = new AnimationSystem();
  const animation = {
    clip: "idle",
    frames: [0],
    fps: 1,
    loop: true,
    playing: false,
    index: 0,
    elapsed: 0,
    completed: false,
    frame: 0,
    direction: "down",
    directionFrames: { down: [0] },
    motionClip: "walk",
    idleClip: "idle",
    actionClip: null,
    actionInterruptible: false,
    clips: {
      idle: { frames: [0], fps: 1, loop: true, directionFrames: { down: [0] } },
      walk: { frames: [1, 2], fps: 8, loop: true, directionFrames: { down: [1, 2], right: [3, 4] } },
      talk: { frames: [10, 11], fps: 6, loop: false }
    }
  };
  const sprite = { frame: 0, flipX: false };

  assert.equal(system.playAction(animation, "talk", { interruptible: true }), true);
  system.setMotion(animation, sprite, { x: 1, y: 0 });

  assert.equal(animation.actionClip, null);
  assert.equal(animation.clip, "walk");
  assert.equal(animation.direction, "right");
});
