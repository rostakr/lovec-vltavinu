import test from "node:test";
import assert from "node:assert/strict";
import {
  LEVEL_DEFINITIONS,
  LEVEL_ORDER,
  PERK_DEFINITIONS,
  SAMPLE_DEFINITIONS,
  getLevelDefinition,
  getNextLevelId,
  getPerkDefinition,
  getSampleDefinition,
  validateGameData,
  assertValidGameData
} from "../../src/index.js";
import {
  CONTEXT_ACTION,
  DIG_REQUIRED_HITS,
  getLevelTarget,
  isLevelTargetReachable
} from "../../src/data/levels.js";

const gameData = {
  levels: LEVEL_DEFINITIONS,
  perks: PERK_DEFINITIONS,
  samples: SAMPLE_DEFINITIONS
};

const cloneLevels = () => LEVEL_DEFINITIONS.map(level => ({
  ...level,
  briefing: { ...level.briefing },
  spawn: { ...level.spawn },
  bounds: { ...level.bounds },
  objective: { ...level.objective },
  objectives: level.objectives.map(objective => ({ ...objective })),
  targets: level.targets.map(target => ({
    ...target,
    positions: target.positions.map(position => ({ ...position })),
    interaction: { ...target.interaction }
  })),
  hazards: [...level.hazards],
  assetGroups: [...level.assetGroups]
}));

test("game data registry contains the four canonical production levels", () => {
  assert.deepEqual(LEVEL_ORDER, ["chlum", "nesmen", "besednice", "slavia"]);
  assert.equal(LEVEL_DEFINITIONS.length, 4);
  assert.equal(LEVEL_DEFINITIONS.at(-1).final, true);
  assert.equal(LEVEL_DEFINITIONS.filter(level => level.final).length, 1);
  assert.equal(getNextLevelId("chlum"), "nesmen");
  assert.equal(getNextLevelId("slavia"), null);
  assert.equal(getLevelDefinition("besednice").objectives.at(-1).target, "crystal-karel");
});

test("level, perk and sample definitions are immutable", () => {
  assert.equal(Object.isFrozen(LEVEL_DEFINITIONS), true);
  assert.equal(Object.isFrozen(LEVEL_DEFINITIONS[0]), true);
  assert.equal(Object.isFrozen(LEVEL_DEFINITIONS[0].objectives), true);
  assert.equal(Object.isFrozen(LEVEL_DEFINITIONS[0].objectives[0]), true);
  assert.equal(Object.isFrozen(LEVEL_DEFINITIONS[0].targets), true);
  assert.equal(Object.isFrozen(LEVEL_DEFINITIONS[0].targets[0].positions), true);
  assert.equal(Object.isFrozen(PERK_DEFINITIONS), true);
  assert.equal(Object.isFrozen(PERK_DEFINITIONS[0]), true);
  assert.equal(Object.isFrozen(SAMPLE_DEFINITIONS), true);
  assert.equal(Object.isFrozen(SAMPLE_DEFINITIONS[0]), true);
});

test("content lookups return stable definitions and null for unknown ids", () => {
  assert.equal(getPerkDefinition("shovel").max, 3);
  assert.equal(getSampleDefinition("bottle-glass").real, false);
  assert.equal(getLevelDefinition("unknown"), null);
  assert.equal(getPerkDefinition("unknown"), null);
  assert.equal(getSampleDefinition("unknown"), null);
});

test("production game data passes the validation contract", () => {
  const result = validateGameData(gameData);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.strictEqual(assertValidGameData(gameData), gameData);
});

test("every objective uses one context action and a reachable declared target", () => {
  for (const level of LEVEL_DEFINITIONS) {
    for (const objective of level.objectives) {
      assert.equal(objective.action, CONTEXT_ACTION, `${level.id}/${objective.id}`);
      assert.ok(getLevelTarget(level.id, objective.target), `${level.id}/${objective.target}`);
      assert.equal(
        isLevelTargetReachable(level.id, objective.target, objective.required),
        true,
        `${level.id}/${objective.target}`
      );
      if (objective.type === "dig") assert.equal(objective.requiredHits, DIG_REQUIRED_HITS);
    }
  }
});

test("validation rejects renamed or legacy fifth level sets", () => {
  const renamedLevels = cloneLevels();
  renamedLevels[0].next = "locenice";
  renamedLevels[1].id = "locenice";

  const renamedResult = validateGameData({
    levels: renamedLevels,
    perks: PERK_DEFINITIONS,
    samples: SAMPLE_DEFINITIONS
  });
  assert.equal(renamedResult.valid, false);
  assert.ok(renamedResult.errors.some(error => error.includes("exactly the four canonical levels")));

  const fiveLevels = cloneLevels();
  fiveLevels.at(-1).final = false;
  fiveLevels.at(-1).next = "locenice";
  const legacyBase = fiveLevels.at(-1);
  fiveLevels.push({
    ...legacyBase,
    order: 4,
    id: "locenice",
    name: "Ločenice",
    title: "Legacy Ločenice",
    next: null,
    final: true,
    briefing: { ...legacyBase.briefing },
    spawn: { ...legacyBase.spawn },
    bounds: { ...legacyBase.bounds },
    objective: { ...legacyBase.objective, id: "locenice-legacy" },
    objectives: legacyBase.objectives.map(objective => ({ ...objective })),
    targets: legacyBase.targets.map(target => ({
      ...target,
      positions: target.positions.map(position => ({ ...position })),
      interaction: { ...target.interaction }
    })),
    hazards: [...legacyBase.hazards],
    assetGroups: [...legacyBase.assetGroups]
  });

  const fiveLevelResult = validateGameData({
    levels: fiveLevels,
    perks: PERK_DEFINITIONS,
    samples: SAMPLE_DEFINITIONS
  });
  assert.equal(fiveLevelResult.valid, false);
  assert.ok(fiveLevelResult.errors.some(error => error.includes("exactly the four canonical levels")));
});

test("validation rejects duplicate ids, broken order and invalid targets", () => {
  const brokenLevels = cloneLevels();
  brokenLevels[1].id = "chlum";
  brokenLevels[2].order = 8;
  brokenLevels[0].objectives[0].required = 0;
  brokenLevels[1].objectives.find(objective => objective.type === "dig").requiredHits = 2;
  brokenLevels[0].objectives[2].target = "missing-finding";
  brokenLevels.at(-1).final = false;

  const result = validateGameData({
    levels: brokenLevels,
    perks: PERK_DEFINITIONS,
    samples: SAMPLE_DEFINITIONS
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes("Duplicate level ids")));
  assert.ok(result.errors.some(error => error.includes("Level order")));
  assert.ok(result.errors.some(error => error.includes("positive integer")));
  assert.ok(result.errors.some(error => error.includes("missing target")));
  assert.ok(result.errors.some(error => error.includes("exactly three rhythm hits")));
  assert.ok(result.errors.some(error => error.includes("Exactly one level")));
  assert.throws(() => assertValidGameData({ levels: brokenLevels, perks: PERK_DEFINITIONS, samples: SAMPLE_DEFINITIONS }), {
    name: "GameDataValidationError"
  });
});
