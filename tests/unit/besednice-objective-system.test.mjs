import test from "node:test";
import assert from "node:assert/strict";
import { EventBus } from "../../src/core/EventBus.js";
import { EVENT_CONTRACTS, validateEventPayload } from "../../src/core/GameEvents.js";
import { createGameSession } from "../../src/gameplay/GameSession.js";
import { ObjectiveSystem } from "../../src/gameplay/ObjectiveSystem.js";
import { createBesedniceFinding } from "../../src/data/besednice.js";

const strictEvents = () => new EventBus({ contracts: EVENT_CONTRACTS, validatePayload: validateEventPayload });

test("Besednice ObjectiveSystem completes only after briefing, clues, hedgehog, boss start and recovery", () => {
  const events = strictEvents();
  const completed = [];
  const levels = [];
  events.on("objective:complete", payload => completed.push(payload));
  events.on("level:complete", payload => levels.push(payload));

  const session = createGameSession();
  session.enterLevel("besednice");
  const objective = new ObjectiveSystem({ events, session, levelId: "besednice" });

  assert.equal(objective.permissionFlag, null);
  assert.equal(objective.grantPermission(), false);
  assert.equal(objective.update({ briefingComplete: false, clues: 3, hedgehog: true, bossStarted: true, bossDefeated: true }).complete, false);
  assert.equal(objective.update({ briefingComplete: true, clues: 3, hedgehog: true, bossStarted: true, bossDefeated: false }).complete, false);

  objective.recordFinding(createBesedniceFinding());
  const result = objective.update({ briefingComplete: true, clues: 3, hedgehog: true, bossStarted: true, bossDefeated: true });
  objective.update({ briefingComplete: true, clues: 3, hedgehog: true, bossStarted: true, bossDefeated: true });

  assert.equal(result.complete, true);
  assert.equal(session.state.score, 240);
  assert.equal(session.state.findings.at(-1).findingId, "besednice-hedgehog-1");
  assert.deepEqual(completed, [{ id: "besednice-hedgehog-recovery", levelId: "besednice" }]);
  assert.deepEqual(levels, [{ levelId: "besednice", nextLevelId: "slavia", score: 240 }]);
});

test("Besednice ObjectiveSystem preserves existing Chlum and Nesměň permission derivation", () => {
  const session = createGameSession();
  session.enterLevel("chlum");
  const chlum = new ObjectiveSystem({ session, levelId: "chlum" });
  assert.equal(chlum.snapshot({ permit: true, searched: true }).current.permit, false);
  assert.equal(chlum.grantPermission(), true);
  assert.equal(chlum.snapshot({ searched: true }).current.permit, true);

  session.enterLevel("nesmen");
  const nesmen = new ObjectiveSystem({ session, levelId: "nesmen" });
  assert.equal(nesmen.snapshot({ dug: 3, filled: 3 }).current.permit, false);
  assert.equal(nesmen.grantPermission(), true);
  assert.equal(nesmen.snapshot({ dug: 3, filled: 3 }).current.permit, true);
});
