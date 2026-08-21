import test from "node:test";
import assert from "node:assert/strict";
import { createGameSession } from "../../src/gameplay/GameSession.js";

test("GameSession state includes a 32-bit unsigned seed", () => {
  const session = createGameSession();
  const { seed } = session.state;
  assert.equal(typeof seed, "number");
  assert.ok(seed >= 0 && seed <= 0xFFFFFFFF);
  assert.equal(seed, seed >>> 0);
});

test("each session reset produces a new seed", () => {
  const session = createGameSession();
  const first = session.state.seed;
  session.reset();
  const second = session.state.seed;
  assert.equal(typeof second, "number");
  assert.notEqual(first, second, "reset must produce a different seed");
});

test("seed survives level transitions", () => {
  const session = createGameSession();
  const seed = session.state.seed;
  session.enterLevel("nesmen");
  assert.equal(session.state.seed, seed);
});
