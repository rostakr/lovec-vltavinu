import test from "node:test";
import assert from "node:assert/strict";
import { DIG_REQUIRED_HITS } from "../../src/data/levels.js";
import { getDialogueDefinition } from "../../src/data/dialogues.js";
import { NESMEN_DIG_CONFIG } from "../../src/scenes/NesmenScene.js";
import { BESEDNICE_DIG_CONFIG } from "../../src/scenes/BesedniceScene.js";

test("V7.1 keeps three required hits and tunes locality difficulty", () => {
  assert.equal(DIG_REQUIRED_HITS, 3);
  assert.deepEqual(NESMEN_DIG_CONFIG, { sweetMin: 0.35, sweetMax: 0.65, speed: 1.05 });
  assert.deepEqual(BESEDNICE_DIG_CONFIG, { sweetMin: 0.43, sweetMax: 0.57, speed: 1.45 });
  assert.ok(BESEDNICE_DIG_CONFIG.sweetMax - BESEDNICE_DIG_CONFIG.sweetMin < NESMEN_DIG_CONFIG.sweetMax - NESMEN_DIG_CONFIG.sweetMin);
  assert.ok(BESEDNICE_DIG_CONFIG.speed > NESMEN_DIG_CONFIG.speed);
});

test("Besednice guide explains the trace to hedgehog to Karel flow", () => {
  const dialogue = getDialogueDefinition("besednice-guide");
  assert.equal(dialogue.speaker.entityId, "besednice-guide");
  assert.equal(dialogue.speaker.name, "Milan");
  const text = dialogue.lines.join(" ");
  assert.match(text, /tři stopy/i);
  assert.match(text, /profil/i);
  assert.match(text, /Karla/i);
});
