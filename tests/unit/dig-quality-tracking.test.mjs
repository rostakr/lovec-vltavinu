import test from "node:test";
import assert from "node:assert/strict";
import { DigSystem } from "../../src/gameplay/DigSystem.js";

test("DigSystem tracks quality of each hit and computes average", () => {
  const dig = new DigSystem({ sweetMin: 0.4, sweetMax: 0.6, speed: 1000 });
  dig.start("test-spot");

  dig.active.position = 0.5;
  const r1 = dig.strike();
  assert.ok(r1.hit);
  assert.equal(r1.quality, 1.0);

  dig.active.position = 0.4;
  const r2 = dig.strike();
  assert.ok(r2.hit);
  assert.equal(r2.quality, 0.0);

  dig.active.position = 0.45;
  const r3 = dig.strike();
  assert.ok(r3.hit);
  assert.ok(r3.complete);
  assert.equal(r3.quality, 0.5);

  const avg = dig.averageQuality();
  assert.ok(Math.abs(avg - 0.5) < 0.001, `expected ~0.5, got ${avg}`);
});

test("misses penalize average quality by contributing zero", () => {
  const dig = new DigSystem({ sweetMin: 0.4, sweetMax: 0.6, speed: 1000 });
  dig.start("penalty-spot");

  dig.active.position = 0.1;
  const miss = dig.strike();
  assert.equal(miss.hit, false);
  assert.equal(dig.active.qualities.length, 1);
  assert.equal(dig.active.qualities[0], 0);

  dig.active.position = 0.5;
  dig.strike();
  dig.active.position = 0.5;
  dig.strike();
  dig.active.position = 0.5;
  dig.strike();

  const avg = dig.averageQuality();
  assert.ok(avg < 1.0, `one miss should lower avg below 1.0, got ${avg}`);
  assert.ok(Math.abs(avg - 0.75) < 0.001, `expected ~0.75 (3×1.0 + 1×0) / 4, got ${avg}`);
});

test("dig:complete marks clean only for exactly three hits with zero misses", () => {
  const events = [];
  const bus = { emit: (name, payload) => events.push({ name, payload }) };
  const clean = new DigSystem({ events: bus, sweetMin: 0.4, sweetMax: 0.6 });
  clean.start("clean");
  for (let hit = 0; hit < 3; hit++) {
    clean.active.position = 0.5;
    clean.strike();
  }
  assert.deepEqual(events.find(event => event.name === "dig:complete")?.payload, {
    spot: "clean",
    hits: 3,
    misses: 0,
    clean: true
  });

  events.length = 0;
  const missed = new DigSystem({ events: bus, sweetMin: 0.4, sweetMax: 0.6 });
  missed.start("missed");
  missed.active.position = 0.1;
  missed.strike();
  for (let hit = 0; hit < 3; hit++) {
    missed.active.position = 0.5;
    missed.strike();
  }
  assert.deepEqual(events.find(event => event.name === "dig:complete")?.payload, {
    spot: "missed",
    hits: 3,
    misses: 1,
    clean: false
  });
});

test("averageQuality returns 0 when no hits recorded", () => {
  const dig = new DigSystem();
  assert.equal(dig.averageQuality(), 0);
  dig.start("empty");
  assert.equal(dig.averageQuality(), 0);
});

test("qualities array is reset on new start", () => {
  const dig = new DigSystem({ sweetMin: 0.4, sweetMax: 0.6, speed: 1000 });
  dig.start("first");
  dig.active.position = 0.5;
  dig.strike();
  dig.cancel();

  dig.start("second");
  assert.equal(dig.active.qualities.length, 0);
  assert.equal(dig.averageQuality(), 0);
});
