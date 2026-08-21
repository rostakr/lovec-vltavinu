import test from "node:test";
import assert from "node:assert/strict";
import { createSessionSeed, createRng } from "../../src/gameplay/SessionRng.js";

test("createSessionSeed returns a 32-bit unsigned integer", () => {
  const seed = createSessionSeed();
  assert.equal(typeof seed, "number");
  assert.ok(seed >= 0 && seed <= 0xFFFFFFFF);
  assert.equal(seed, seed >>> 0);
});

test("createRng produces deterministic sequence from the same seed", () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 20; i++) {
    assert.equal(a(), b(), `diverged at step ${i}`);
  }
});

test("createRng produces values in [0, 1)", () => {
  const rng = createRng(12345);
  for (let i = 0; i < 100; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test("different seeds produce different sequences", () => {
  const a = createRng(1);
  const b = createRng(2);
  let same = 0;
  for (let i = 0; i < 20; i++) {
    if (a() === b()) same++;
  }
  assert.ok(same < 5, "sequences are too similar");
});

test("seed 0 does not degenerate to all zeros", () => {
  const rng = createRng(0);
  let nonZero = 0;
  for (let i = 0; i < 10; i++) {
    if (rng() !== 0) nonZero++;
  }
  assert.ok(nonZero >= 8, "degenerate zero stream");
});
