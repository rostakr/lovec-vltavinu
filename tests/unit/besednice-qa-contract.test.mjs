import test from "node:test";
import assert from "node:assert/strict";
import { EventBus } from "../../src/core/EventBus.js";
import { EVENT_CONTRACTS, validateEventPayload } from "../../src/core/GameEvents.js";
import { World } from "../../src/ecs/World.js";
import {
  DIG_REQUIRED_HITS,
  getLevelDefinition,
  getLevelTarget,
  isLevelTargetReachable
} from "../../src/data/levels.js";
import { createBesedniceFinding } from "../../src/data/besednice.js";
import { BossSystem } from "../../src/gameplay/BossSystem.js";
import { createGameSession } from "../../src/gameplay/GameSession.js";
import { ObjectiveSystem } from "../../src/gameplay/ObjectiveSystem.js";

const strictEvents = () => new EventBus({
  contracts: EVENT_CONTRACTS,
  validatePayload: validateEventPayload
});

test("Besednice level keeps the canonical targets, guide, preload group and transition contract", () => {
  const level = getLevelDefinition("besednice");
  assert.ok(level);
  assert.equal(level.next, "slavia");
  assert.equal(level.final, undefined);
  assert.deepEqual(level.assetGroups, ["common", "level:besednice"]);
  assert.deepEqual(level.objective, {
    id: "besednice-hedgehog-recovery",
    type: "besednice-hedgehog-recovery",
    required: 1
  });

  const guide = getLevelTarget("besednice", "besednice-guide");
  const traces = getLevelTarget("besednice", "besednice-trace");
  const hedgehog = getLevelTarget("besednice", "besednice-hedgehog");
  const karel = getLevelTarget("besednice", "crystal-karel");
  assert.equal(guide.positions.length, 1);
  assert.equal(traces.positions.length, 3);
  assert.equal(hedgehog.positions.length, 1);
  assert.equal(karel.positions.length, 1);
  assert.equal(isLevelTargetReachable("besednice", "besednice-guide", 1), true);
  assert.equal(isLevelTargetReachable("besednice", "besednice-trace", 3), true);
  assert.equal(isLevelTargetReachable("besednice", "besednice-hedgehog", 1), true);
  assert.equal(isLevelTargetReachable("besednice", "crystal-karel", 1), true);

  assert.equal(level.objectives[0].id, "local-briefing");
  assert.equal(level.objectives[0].target, "besednice-guide");
  const digObjective = level.objectives.find(entry => entry.id === "dig-hedgehog");
  assert.equal(digObjective.requiredHits, DIG_REQUIRED_HITS);
  assert.equal(DIG_REQUIRED_HITS, 3);
});

test("Besednice objective remains blocked by each missing mandatory phase", () => {
  const session = createGameSession();
  session.enterLevel("besednice");
  const objective = new ObjectiveSystem({ session, levelId: "besednice" });

  const cases = [
    { briefingComplete: false, clues: 3, hedgehog: true, bossStarted: true, bossDefeated: true },
    { briefingComplete: true, clues: 2, hedgehog: true, bossStarted: true, bossDefeated: true },
    { briefingComplete: true, clues: 3, hedgehog: false, bossStarted: true, bossDefeated: true },
    { briefingComplete: true, clues: 3, hedgehog: true, bossStarted: false, bossDefeated: true },
    { briefingComplete: true, clues: 3, hedgehog: true, bossStarted: true, bossDefeated: false }
  ];
  for (const runtime of cases) {
    assert.equal(objective.update(runtime).complete, false, JSON.stringify(runtime));
  }
});

test("Besednice completion preserves earlier session findings and emits one canonical transition", () => {
  const events = strictEvents();
  const progress = [];
  const completed = [];
  const levels = [];
  events.on("objective:progress", payload => progress.push(payload));
  events.on("objective:complete", payload => completed.push(payload));
  events.on("level:complete", payload => levels.push(payload));

  const session = createGameSession();
  session.recordFinding({ findingId: "chlum-proof", locality: "chlum", rarity: "B", weight: 1.2, score: 90 });
  session.recordFinding({ findingId: "nesmen-proof", locality: "nesmen", rarity: "B", weight: 1.5, score: 120 });
  session.enterLevel("besednice");
  const objective = new ObjectiveSystem({ events, session, levelId: "besednice" });

  objective.recordFinding(createBesedniceFinding());
  assert.throws(() => objective.recordFinding(createBesedniceFinding()), /already recorded/);
  const result = objective.update({ briefingComplete: true, clues: 3, hedgehog: true, bossStarted: true, bossDefeated: true });
  objective.update({ briefingComplete: true, clues: 3, hedgehog: true, bossStarted: true, bossDefeated: true });

  assert.equal(result.complete, true);
  assert.equal(session.state.findings.length, 3);
  assert.equal(session.state.score, 450);
  assert.equal(session.state.objective.current, 1);
  assert.equal(session.state.objective.required, 1);
  assert.equal(session.state.objective.complete, true);
  assert.equal(progress.at(-1).required, 1);
  assert.equal(progress.at(-1).current, 1);
  assert.deepEqual(completed, [{ id: "besednice-hedgehog-recovery", levelId: "besednice" }]);
  assert.deepEqual(levels, [{ levelId: "besednice", nextLevelId: "slavia", score: 450 }]);
});

test("BossSystem owns the recovery interaction lifecycle", () => {
  const world = new World();
  const player = world.createEntity({ transform: { x: 0, y: 0, rotation: 0 } });
  const karel = world.createEntity({
    transform: { x: 120, y: 0, rotation: 0 },
    interaction: { kind: "recover", label: "ZÍSKAT ZPĚT", range: 74, enabled: false },
    boss: {
      id: "crystal-karel",
      state: "inactive",
      speed: 100,
      stopRange: 50,
      started: false,
      defeated: false
    }
  });
  const boss = new BossSystem();

  assert.equal(boss.start(world, karel), true);
  assert.equal(world.get(karel, "interaction").enabled, false);
  assert.equal(boss.update(world, karel, player, 0).state, "chasing");
  assert.equal(world.get(karel, "interaction").enabled, false);
  assert.equal(boss.update(world, karel, player, 1).state, "recoverable");
  assert.equal(world.get(karel, "interaction").enabled, true);
  assert.equal(boss.defeat(world, karel), true);
  assert.equal(world.get(karel, "interaction").enabled, false);
  boss.reset(world, karel);
  assert.equal(world.get(karel, "interaction").enabled, false);
});
