import test from "node:test";
import assert from "node:assert/strict";
import {
  EVENT_CONTRACTS,
  GAME_EVENT_NAMES,
  EventBus,
  GameApp,
  createGameSession,
  evaluateObjective,
  validateEventPayload
} from "../../src/index.js";

test("event catalog matches the architecture contract", () => {
  assert.equal(GAME_EVENT_NAMES.length, 34);
  assert.ok(GAME_EVENT_NAMES.includes("finding:collected"));
  assert.ok(GAME_EVENT_NAMES.includes("dig:clean"));
  assert.ok(GAME_EVENT_NAMES.includes("hud:model:changed"));
});

test("strict EventBus rejects unknown events and invalid payload fields", () => {
  const events = new EventBus({
    contracts: EVENT_CONTRACTS,
    strict: true,
    validatePayload: validateEventPayload
  });

  assert.throws(() => events.emit("unknown:event", {}), /Unknown event type/);
  assert.throws(
    () => events.emit("app:boot:start", { initialScene: "title", context: {} }),
    /Unexpected payload field/
  );
  assert.throws(
    () => events.emit("finding:collected", { id: "legacy-id", locality: "chlum", rarity: "B", weight: 1, score: 10 }),
    /Unexpected payload field|Missing payload field/
  );
  assert.doesNotThrow(() => events.emit("finding:collected", {
    findingId: "finding-1",
    locality: "chlum",
    rarity: "B",
    weight: 1,
    score: 10
  }));
});

test("dig event contracts require the literal three and validate clean metadata", () => {
  const valid = [
    ["dig:start", { spot: "spot-1", requiredHits: 3 }],
    ["dig:hit", { spot: "spot-1", hit: 1, requiredHits: 3, quality: 0.8 }],
    ["dig:complete", { spot: "spot-1", hits: 3, misses: 0, clean: true }],
    ["dig:clean", { spot: "spot-1" }]
  ];
  for (const [type, payload] of valid) {
    assert.doesNotThrow(() => validateEventPayload(type, payload));
  }

  for (const value of [2, 4]) {
    assert.throws(
      () => validateEventPayload("dig:start", { spot: "spot-1", requiredHits: value }),
      /Invalid payload field for dig:start: requiredHits/
    );
    assert.throws(
      () => validateEventPayload("dig:hit", { spot: "spot-1", hit: 1, requiredHits: value, quality: 0.8 }),
      /Invalid payload field for dig:hit: requiredHits/
    );
    assert.throws(
      () => validateEventPayload("dig:complete", { spot: "spot-1", hits: value }),
      /Invalid payload field for dig:complete: hits/
    );
  }
  assert.throws(
    () => validateEventPayload("dig:complete", { spot: "spot-1", hits: 3, misses: 0, clean: "yes" }),
    /Invalid payload field for dig:complete: clean/
  );
});

test("bootstrap integration uses canonical GameSession and objective evaluator", () => {
  const session = createGameSession();
  session.enterLevel("chlum");
  session.recordFinding({
    findingId: "finding-1",
    locality: "chlum",
    rarity: "B",
    weight: 2.4,
    score: 120
  });

  assert.equal(session.state.findings[0].findingId, "finding-1");
  assert.equal(session.state.score, 120);
  const objective = evaluateObjective("chlum", { permit: true, searched: true, findings: 1 });
  assert.equal(objective.complete, true);
});

test("GameSession reset restores a fresh Chlum run", () => {
  const session = createGameSession();
  session.recordFinding({
    findingId: "finding-1",
    locality: "chlum",
    rarity: "A",
    weight: 3.2,
    score: 240
  });
  session.setFlag("chlumPermission", true);
  session.setDanger(75);
  session.setPhase("complete");

  session.reset();

  assert.equal(session.state.levelId, "chlum");
  assert.equal(session.state.phase, "briefing");
  assert.deepEqual(session.state.findings, []);
  assert.equal(session.state.score, 0);
  assert.equal(session.state.health, 3);
  assert.equal(session.state.danger, 0);
  assert.deepEqual(session.state.flags, {});
  assert.deepEqual(session.state.objective, {
    id: "chlum-permission-and-find",
    current: 0,
    required: 1,
    complete: false
  });
});

test("GameApp invokes fixed-step scene phases in contract order", async () => {
  const calls = [];
  const app = new GameApp();
  app.scenes.register("pipeline", {
    beginFixed: () => calls.push("beginFixed"),
    updateControl: () => calls.push("updateControl"),
    updateMovement: () => calls.push("updateMovement"),
    updateCollisions: () => calls.push("updateCollisions"),
    updateGameplay: () => calls.push("updateGameplay"),
    updateObjectives: () => calls.push("updateObjectives"),
    updateAnimations: () => calls.push("updateAnimations"),
    updateLifetime: () => calls.push("updateLifetime"),
    updateHud: () => calls.push("updateHud")
  });

  await app.boot("pipeline");
  app.loop.advance(1 / 60);
  assert.deepEqual(calls, [
    "beginFixed",
    "updateControl",
    "updateMovement",
    "updateCollisions",
    "updateGameplay",
    "updateObjectives",
    "updateAnimations",
    "updateLifetime",
    "updateHud"
  ]);
  await app.dispose();
});

test("GameApp suppresses fixed scene updates during async transition", async () => {
  const updates = [];
  let releaseEnter;
  const enterGate = new Promise(resolve => {
    releaseEnter = resolve;
  });
  const app = new GameApp();
  app.scenes.register("first", {
    update: () => updates.push("first")
  });
  app.scenes.register("second", {
    enter: async () => enterGate,
    update: () => updates.push("second")
  });

  await app.boot("first");
  app.loop.advance(1 / 60);
  const transition = app.changeScene("second");
  assert.equal(app.scenes.transitioning, true);

  app.loop.advance(1 / 60);
  assert.deepEqual(updates, ["first"]);

  releaseEnter();
  await transition;
  assert.equal(app.scenes.transitioning, false);
  app.loop.advance(1 / 60);
  assert.deepEqual(updates, ["first", "second"]);
  await app.dispose();
});
