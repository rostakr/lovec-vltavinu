import test from "node:test";
import assert from "node:assert/strict";
import { CLEAN_DIG_SCORE_MULTIPLIER, resolveVariant, scaleScore, createFinding } from "../../src/gameplay/FindingResolver.js";
import { createRng } from "../../src/gameplay/SessionRng.js";

const VARIANTS = [
  { id: "small", rarity: "C", weight: 0.8, score: 50 },
  { id: "standard", rarity: "B", weight: 1.2, score: 90 },
  { id: "rare", rarity: "A", weight: 1.7, score: 150 }
];

test("resolveVariant returns C for low quality", () => {
  const v = resolveVariant(VARIANTS, 0.1, null);
  assert.equal(v.rarity, "C");
});

test("resolveVariant returns B for medium quality", () => {
  const v = resolveVariant(VARIANTS, 0.5, null);
  assert.equal(v.rarity, "B");
});

test("resolveVariant returns A for high quality", () => {
  const v = resolveVariant(VARIANTS, 0.9, null);
  assert.equal(v.rarity, "A");
});

test("resolveVariant with RNG jitter stays within expected range", () => {
  const rng = createRng(99);
  const counts = { A: 0, B: 0, C: 0 };
  for (let i = 0; i < 100; i++) {
    const r = createRng(99 + i);
    const v = resolveVariant(VARIANTS, 0.5, r);
    counts[v.rarity]++;
  }
  assert.ok(counts.B > 50, `B should dominate at quality 0.5, got ${counts.B}`);
});

test("resolveVariant with single variant always returns it", () => {
  const single = [{ id: "only", rarity: "A", weight: 2.8, score: 240 }];
  assert.equal(resolveVariant(single, 0.0, null).id, "only");
  assert.equal(resolveVariant(single, 1.0, null).id, "only");
});

test("resolveVariant throws on empty array", () => {
  assert.throws(() => resolveVariant([], 0.5, null), /No finding variants/);
});

test("scaleScore scales from 70% to 130%", () => {
  assert.equal(scaleScore(100, 0), 70);
  assert.equal(scaleScore(100, 0.5), 100);
  assert.equal(scaleScore(100, 1), 130);
});

test("clean-dig bonus is applied after quality scaling and does not change rarity", () => {
  const variant = { rarity: "B", weight: 1.2, score: 101 };
  const quality = 0.5;
  const scaled = scaleScore(variant.score, quality);
  const finding = createFinding(variant, "clean-1", "nesmen", quality, {
    scoreMultiplier: CLEAN_DIG_SCORE_MULTIPLIER
  });
  assert.equal(CLEAN_DIG_SCORE_MULTIPLIER, 1.1);
  assert.equal(finding.score, Math.round(scaled * 1.1));
  assert.equal(finding.rarity, "B");
});

test("createFinding rejects invalid score multipliers", () => {
  const variant = { rarity: "B", weight: 1.2, score: 90 };
  assert.throws(() => createFinding(variant, "bad-1", "chlum", 0.5, { scoreMultiplier: 0 }), /scoreMultiplier/);
});

test("deterministic seed produces reproducible variant resolution", () => {
  const rng1 = createRng(777);
  const rng2 = createRng(777);
  for (let q = 0; q <= 1; q += 0.25) {
    const v1 = resolveVariant(VARIANTS, q, rng1);
    const v2 = resolveVariant(VARIANTS, q, rng2);
    assert.equal(v1.id, v2.id, `diverged at quality ${q}`);
  }
});

test("deterministic seed yields stable scores through scaleScore", () => {
  const variant = VARIANTS[1];
  assert.equal(scaleScore(variant.score, 0.0), 63);
  assert.equal(scaleScore(variant.score, 0.5), 90);
  assert.equal(scaleScore(variant.score, 1.0), 117);
});

test("scaleScore applies 15% perfect dig bonus", () => {
  const normal = scaleScore(100, 1.0);
  const perfect = scaleScore(100, 1.0, true);
  assert.equal(normal, 130);
  assert.equal(perfect, 150);
  assert.ok(perfect > normal);
});

test("createFinding produces frozen object with scaled score", () => {
  const variant = { rarity: "B", weight: 1.2, score: 90 };
  const f = createFinding(variant, "test-1", "chlum", 0.8);
  assert.equal(f.findingId, "test-1");
  assert.equal(f.locality, "chlum");
  assert.equal(f.rarity, "B");
  assert.equal(f.weight, 1.2);
  assert.equal(f.score, scaleScore(90, 0.8));
  assert.ok(Object.isFrozen(f));
});

test("createFinding with perfect flag gives higher score", () => {
  const variant = { rarity: "A", weight: 1.7, score: 150 };
  const normal = createFinding(variant, "f-1", "nesmen", 1.0);
  const perfect = createFinding(variant, "f-2", "nesmen", 1.0, true);
  assert.ok(perfect.score > normal.score, `perfect ${perfect.score} should exceed normal ${normal.score}`);
});
