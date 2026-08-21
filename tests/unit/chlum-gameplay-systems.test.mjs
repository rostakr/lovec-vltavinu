import test from "node:test";
import assert from "node:assert/strict";
import { EventBus } from "../../src/core/EventBus.js";
import { EVENT_CONTRACTS, validateEventPayload } from "../../src/core/GameEvents.js";
import { World } from "../../src/ecs/World.js";
import { createGameSession } from "../../src/gameplay/GameSession.js";
import { InteractionSystem } from "../../src/gameplay/InteractionSystem.js";
import { DigSystem } from "../../src/gameplay/DigSystem.js";
import { DangerSystem } from "../../src/gameplay/DangerSystem.js";
import { ObjectiveSystem } from "../../src/gameplay/ObjectiveSystem.js";

const strictEvents = () => new EventBus({ contracts: EVENT_CONTRACTS, validatePayload: validateEventPayload });

test("InteractionSystem exposes and performs only the best enabled contextual action", () => {
  const events = strictEvents();
  const emitted = [];
  for (const type of ["interaction:available", "interaction:performed", "interaction:cleared"]) events.on(type, payload => emitted.push([type, payload]));
  const world = new World();
  const actor = world.createEntity({ transform: { x: 0, y: 0 } });
  const low = world.createEntity({ transform: { x: 5, y: 0 }, interaction: { kind: "dig", label: "KOPAT", range: 20, priority: 1, enabled: true } });
  const high = world.createEntity({ transform: { x: 12, y: 0 }, interaction: { kind: "permission", label: "MLUVIT", range: 20, priority: 10, enabled: true } });
  const system = new InteractionSystem({ events });

  const available = system.update(world, actor, true);
  assert.equal(available.entity, high);
  assert.equal(available.performed, true);
  assert.deepEqual(emitted.slice(0, 2), [
    ["interaction:available", { entity: high, kind: "permission", label: "MLUVIT" }],
    ["interaction:performed", { actor, target: high, kind: "permission" }]
  ]);

  world.get(high, "interaction").enabled = false;
  assert.equal(system.update(world, actor, false).entity, low);
  assert.deepEqual(emitted.at(-2), ["interaction:cleared", { entity: high }]);
  assert.deepEqual(emitted.at(-1), ["interaction:available", { entity: low, kind: "dig", label: "KOPAT" }]);
});

test("DigSystem rejects alternate hit counts and completes on the third successful strike only", () => {
  const events = strictEvents();
  const hits = [];
  const complete = [];
  events.on("dig:hit", payload => hits.push(payload));
  events.on("dig:complete", payload => complete.push(payload));
  assert.throws(() => new DigSystem({ requiredHits: 4 }), /literal 3/);

  const dig = new DigSystem({ events, speed: 1.25 });
  assert.equal(dig.start("nesmen-profile-1"), true);
  for (let index = 1; index <= 3; index++) {
    dig.update(0.4);
    const result = dig.strike();
    assert.equal(result.hit, true);
    assert.equal(result.complete, index === 3);
    assert.equal(result.hits, index);
  }
  assert.equal(hits.length, 3);
  assert.equal(hits.every(event => event.requiredHits === 3), true);
  assert.deepEqual(complete, [{ spot: "nesmen-profile-1", hits: 3, misses: 0, clean: true }]);
  assert.equal(dig.strike(), null);
  assert.equal(dig.finish().hits, 3);
});

test("ObjectiveSystem writes permission and one finding to GameSession without owning a parallel collection", () => {
  const events = strictEvents();
  const completed = [];
  const levels = [];
  events.on("objective:complete", payload => completed.push(payload));
  events.on("level:complete", payload => levels.push(payload));
  const session = createGameSession();
  const objective = new ObjectiveSystem({ events, session, levelId: "chlum" });

  assert.equal(objective.update({ searched: true }).complete, false);
  assert.equal(objective.grantPermission(), true);
  assert.equal(objective.update({ searched: false }).complete, false);
  assert.equal(objective.update({ searched: true }).complete, false);
  objective.recordFinding({ findingId: "chlum-1", locality: "chlum", rarity: "B", weight: 1.2, score: 90 });
  const result = objective.update({ searched: true });

  assert.equal(result.complete, true);
  assert.equal(session.state.findings.length, 1);
  assert.equal(session.state.score, 90);
  assert.equal(session.state.objective.complete, true);
  assert.deepEqual(completed, [{ id: "chlum-permission-and-find", levelId: "chlum" }]);
  assert.deepEqual(levels, [{ levelId: "chlum", nextLevelId: "nesmen", score: 90 }]);
  assert.throws(() => objective.recordFinding({ findingId: "chlum-1", locality: "chlum", rarity: "B", weight: 1.2, score: 90 }), /already recorded/);
});

test("DangerSystem updates only GameSession danger and honors collision cooldown", () => {
  const events = strictEvents();
  const caught = [];
  events.on("danger:caught", payload => caught.push(payload));
  const session = createGameSession();
  const world = new World();
  const actor = world.createEntity({ transform: { x: 0, y: 0 } });
  const tractor = world.createEntity({ transform: { x: 0, y: 0 }, hazard: { kind: "tractor", danger: 100, consequence: "return-to-spawn" } });
  const system = new DangerSystem({ events, session, cooldownDuration: 1, recoveryPerSecond: 25 });
  const collision = { a: { entity: actor }, b: { entity: tractor } };

  assert.equal(system.update(world, actor, [collision], 0).caught, true);
  assert.equal(session.state.danger, 100);
  assert.equal(system.update(world, actor, [collision], 0.25).caught, false);
  assert.equal(caught.length, 1);
  system.update(world, actor, [], 1);
  assert.equal(session.state.danger, 75);
});
