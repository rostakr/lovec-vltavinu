import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONTEXT_ACTION, getLevelDefinition } from "../../src/data/levels.js";
import { DIALOGUE_DEFINITIONS, getDialogueDefinition } from "../../src/data/dialogues.js";
import { CHLUM_ENTITY_DEFINITIONS, CHLUM_FINDING_VARIANTS, createChlumFinding, getChlumEntityDefinition } from "../../src/data/chlum.js";

const ASSET_MANIFEST = JSON.parse(readFileSync(new URL("../../assets/manifests/assets.json", import.meta.url), "utf8"));

test("Chlum entity data contains one canonical player, permission target, surface search site and tractor", () => {
  const ids = CHLUM_ENTITY_DEFINITIONS.map(entity => entity.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, ["player", "farmer-vaclav", "chlum-search-site", "tractor"]);
  assert.equal(getChlumEntityDefinition("farmer-vaclav").components.npc.dialogueId, "chlum-permission");
  assert.equal(getChlumEntityDefinition("farmer-vaclav").components.interaction.action, CONTEXT_ACTION);
  const search = getChlumEntityDefinition("chlum-search-site");
  assert.equal(search.components.interaction, undefined);
  assert.equal(search.components.searchSpot.searched, false);
  assert.equal(search.components.searchSpot.detectionRange, 240);
  assert.equal(getChlumEntityDefinition("tractor").components.hazard.kind, "tractor");
});

test("all Chlum transforms are reachable inside canonical level bounds", () => {
  const { bounds } = getLevelDefinition("chlum");
  for (const entity of CHLUM_ENTITY_DEFINITIONS) {
    const { x, y } = entity.components.transform;
    assert.equal(x >= bounds.x && x <= bounds.x + bounds.width, true, entity.id);
    assert.equal(y >= bounds.y && y <= bounds.y + bounds.height, true, entity.id);
  }
});

test("Chlum permission dialogue and three immutable finding variants are complete", () => {
  const dialogueIds = DIALOGUE_DEFINITIONS.map(entry => entry.id);
  assert.equal(new Set(dialogueIds).size, dialogueIds.length, "dialogue IDs must remain unique across levels");
  const dialogue = getDialogueDefinition("chlum-permission");
  assert.equal(dialogue.speaker.entityId, "farmer-vaclav");
  assert.equal(dialogue.grantsFlag, "chlumPermission");
  assert.equal(dialogue.lines.length, 2);
  assert.equal(CHLUM_FINDING_VARIANTS.length, 3);
  assert.equal(Object.isFrozen(CHLUM_FINDING_VARIANTS), true);

  assert.deepEqual(createChlumFinding("chlum-rare", " finding-rare "), {
    findingId: "finding-rare",
    locality: "chlum",
    rarity: "A",
    weight: 1.7,
    score: 150
  });
  assert.throws(() => createChlumFinding("unknown"), /Unknown Chlum finding variant/);
});

test("every Chlum asset reference resolves exactly once to a compatible manifest entry", () => {
  const manifestIds = ASSET_MANIFEST.map(entry => entry.id);
  assert.equal(new Set(manifestIds).size, manifestIds.length, "manifest asset IDs must be unique");

  const references = [];
  for (const entity of CHLUM_ENTITY_DEFINITIONS) {
    for (const componentName of ["sprite", "model"]) {
      const component = entity.components[componentName];
      if (component?.assetId) references.push({ owner: entity.id, componentName, assetId: component.assetId });
    }
  }
  for (const variant of CHLUM_FINDING_VARIANTS) {
    references.push({ owner: variant.id, componentName: "finding", assetId: variant.assetId });
  }

  for (const reference of references) {
    const matches = ASSET_MANIFEST.filter(entry => entry.id === reference.assetId);
    assert.equal(matches.length, 1, `${reference.owner}.${reference.componentName} -> ${reference.assetId}`);
    const [entry] = matches;
    assert.equal(["common", "level:chlum"].includes(entry.preload), true, `${reference.assetId} preload`);
    if (reference.componentName === "model") assert.equal(entry.type, "gltf", `${reference.assetId} must be GLTF`);
    else assert.equal(["texture", "spritesheet"].includes(entry.type), true, `${reference.assetId} must be a texture asset`);
  }

  const crossLevelNames = ASSET_MANIFEST.filter(entry => (
    entry.preload === "level:chlum" && /besednice/i.test(`${entry.id} ${entry.url}`)
  ));
  assert.deepEqual(crossLevelNames, []);
});
