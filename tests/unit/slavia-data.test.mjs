import test from "node:test";
import assert from "node:assert/strict";
import { CONTEXT_ACTION, getLevelDefinition } from "../../src/data/levels.js";
import {
  SLAVIA_DOCUMENT_IDS,
  SLAVIA_ENTITY_DEFINITIONS,
  getSlaviaEntityDefinition
} from "../../src/data/slavia.js";

const level = getLevelDefinition("slavia");

test("Slavia data contains player, three documents, Eva, Franta and KD Slavia", () => {
  const ids = SLAVIA_ENTITY_DEFINITIONS.map(entity => entity.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, [
    "player",
    ...SLAVIA_DOCUMENT_IDS,
    "expert-eva",
    "thief-franta",
    "kd-slavia"
  ]);
  assert.equal(SLAVIA_DOCUMENT_IDS.length, 3);
});

test("Slavia documents preserve one canonical locality each", () => {
  const localities = SLAVIA_DOCUMENT_IDS.map(id => {
    const entity = getSlaviaEntityDefinition(id);
    assert.equal(entity.components.interaction.kind, "collect-document");
    assert.equal(entity.components.interaction.action, CONTEXT_ACTION);
    assert.equal(entity.components.interaction.enabled, true);
    assert.equal(entity.components.document.collected, false);
    return entity.components.document.locality;
  });
  assert.deepEqual(localities, ["chlum", "nesmen", "besednice"]);
});

test("Slavia objective gates start disabled until prior steps complete", () => {
  const eva = getSlaviaEntityDefinition("expert-eva");
  const franta = getSlaviaEntityDefinition("thief-franta");
  const venue = getSlaviaEntityDefinition("kd-slavia");

  assert.equal(eva.components.interaction.kind, "register-collection");
  assert.equal(eva.components.interaction.enabled, false);
  assert.equal(eva.components.expert.registered, false);
  assert.equal(eva.components.expert.evaluated, false);

  assert.equal(franta.components.interaction.kind, "recover-best-finding");
  assert.equal(franta.components.interaction.enabled, false);
  assert.equal(franta.components.boss.started, false);
  assert.equal(franta.components.boss.defeated, false);

  assert.equal(venue.components.interaction.kind, "enter-event");
  assert.equal(venue.components.interaction.enabled, false);
  assert.equal(venue.components.destination.entered, false);
});

test("all Slavia entities are reachable inside canonical level bounds", () => {
  for (const entity of SLAVIA_ENTITY_DEFINITIONS) {
    const { x, y } = entity.components.transform;
    assert.equal(x >= level.bounds.x && x <= level.bounds.x + level.bounds.width, true, entity.id);
    assert.equal(y >= level.bounds.y && y <= level.bounds.y + level.bounds.height, true, entity.id);
  }
});

test("Slavia definitions remain deeply frozen serializable data", () => {
  assert.equal(Object.isFrozen(SLAVIA_ENTITY_DEFINITIONS), true);
  assert.equal(Object.isFrozen(SLAVIA_ENTITY_DEFINITIONS[0].components), true);
  assert.equal(Object.isFrozen(getSlaviaEntityDefinition("thief-franta").components.boss), true);
  const parsed = JSON.parse(JSON.stringify(SLAVIA_ENTITY_DEFINITIONS));
  assert.equal(parsed.length, 7);
});
