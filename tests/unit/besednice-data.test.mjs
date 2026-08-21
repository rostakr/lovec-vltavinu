import test from "node:test";
import assert from "node:assert/strict";
import { CONTEXT_ACTION, DIG_REQUIRED_HITS, getLevelDefinition } from "../../src/data/levels.js";
import {
  BESEDNICE_ENTITY_DEFINITIONS,
  BESEDNICE_FINDING_VARIANTS,
  BESEDNICE_TRACE_IDS,
  createBesedniceFinding,
  getBesedniceEntityDefinition
} from "../../src/data/besednice.js";

const level = getLevelDefinition("besednice");

test("Besednice data contains guide, player, exactly three gated clues, one locked dig site and Karel", () => {
  const ids = BESEDNICE_ENTITY_DEFINITIONS.map(entity => entity.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, ["player", "besednice-guide", ...BESEDNICE_TRACE_IDS, "besednice-hedgehog", "crystal-karel"]);
  assert.equal(BESEDNICE_TRACE_IDS.length, 3);

  const guide = getBesedniceEntityDefinition("besednice-guide");
  assert.equal(guide.components.interaction.kind, "talk");
  assert.equal(guide.components.interaction.action, CONTEXT_ACTION);
  assert.equal(guide.components.interaction.enabled, true);
  assert.equal(guide.components.sprite.assetId, "npc-rival-karel");

  for (const [index, id] of BESEDNICE_TRACE_IDS.entries()) {
    const clue = getBesedniceEntityDefinition(id);
    assert.equal(clue.components.interaction.kind, "discover");
    assert.equal(clue.components.interaction.action, CONTEXT_ACTION);
    assert.equal(clue.components.interaction.enabled, false);
    assert.equal(clue.components.clue.index, index);
    assert.equal(clue.components.clue.discovered, false);
    assert.equal(clue.components.model.assetId, "model-besednice-trace-marker");
  }

  const dig = getBesedniceEntityDefinition("besednice-hedgehog");
  assert.equal(dig.components.interaction.kind, "dig");
  assert.equal(dig.components.interaction.enabled, false);
  assert.equal(dig.components.digSpot.findingId, "besednice-hedgehog-1");
  assert.equal(DIG_REQUIRED_HITS, 3);

  const karel = getBesedniceEntityDefinition("crystal-karel");
  assert.equal(karel.components.interaction.kind, "recover");
  assert.equal(karel.components.interaction.enabled, false);
  assert.deepEqual(karel.components.boss, {
    id: "crystal-karel",
    state: "inactive",
    speed: 150,
    stopRange: 58,
    started: false,
    defeated: false
  });
});

test("all Besednice entities are reachable inside canonical level bounds", () => {
  for (const entity of BESEDNICE_ENTITY_DEFINITIONS) {
    const { x, y } = entity.components.transform;
    assert.equal(x >= level.bounds.x && x <= level.bounds.x + level.bounds.width, true, entity.id);
    assert.equal(y >= level.bounds.y && y <= level.bounds.y + level.bounds.height, true, entity.id);
  }
});

test("Besednice hedgehog finding has one stable immutable payload", () => {
  assert.equal(BESEDNICE_FINDING_VARIANTS.length, 1);
  assert.equal(Object.isFrozen(BESEDNICE_FINDING_VARIANTS), true);
  assert.deepEqual(createBesedniceFinding("besednice-hedgehog", " hedgehog-proof "), {
    findingId: "hedgehog-proof",
    locality: "besednice",
    rarity: "A",
    weight: 2.8,
    score: 240
  });
  assert.throws(() => createBesedniceFinding("unknown"), /Unknown Besednice finding variant/);
  assert.throws(() => createBesedniceFinding("besednice-hedgehog", "   "), /findingId must be a non-empty string/);
});

test("Besednice definitions remain deeply frozen serializable data", () => {
  assert.equal(Object.isFrozen(BESEDNICE_ENTITY_DEFINITIONS), true);
  assert.equal(Object.isFrozen(BESEDNICE_ENTITY_DEFINITIONS[0].components), true);
  assert.equal(Object.isFrozen(getBesedniceEntityDefinition("crystal-karel").components.boss), true);
  const parsed = JSON.parse(JSON.stringify({ entities: BESEDNICE_ENTITY_DEFINITIONS, findings: BESEDNICE_FINDING_VARIANTS }));
  assert.equal(parsed.entities.length, 7);
  assert.equal(parsed.findings.length, 1);
});
