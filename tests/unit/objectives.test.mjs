import test from "node:test";
import assert from "node:assert/strict";
import { evaluateObjective, isObjectiveComplete } from "../../src/gameplay/Objectives.js";

test("Chlum vyžaduje povolení, povrchové hledání i nález", () => {
  assert.equal(evaluateObjective("chlum", { permit: false, searched: true, findings: 1 }).text, "Promluv s Václavem");
  assert.equal(evaluateObjective("chlum", { permit: true, searched: false, findings: 0 }).text, "Aktivuj radar a hledej signál");
  assert.equal(isObjectiveComplete("chlum", { permit: true, searched: false, findings: 1 }), false);
  assert.equal(isObjectiveComplete("chlum", { permit: true, searched: true, findings: 1 }), true);
});

test("Nesměň vyžaduje povolení, kopání, zahrabání i nález", () => {
  assert.equal(evaluateObjective("nesmen", { permit: false }).text, "Získej souhlas lesníka");
  assert.equal(isObjectiveComplete("nesmen", { permit: true, dug: 3, filled: 2, findings: 1 }), false);
  assert.equal(evaluateObjective("nesmen", { permit: true, dug: 3, filled: 3, findings: 0 }).text, "Vyzvedni nalezený vltavín");
  assert.equal(isObjectiveComplete("nesmen", { permit: true, dug: 3, filled: 3, findings: 0 }), false);
  assert.equal(isObjectiveComplete("nesmen", { permit: true, dug: 3, filled: 3, findings: 1 }), true);
});

test("Besednice používá intro znalce a texty všech fází", () => {
  assert.equal(evaluateObjective("besednice", { clues: 2 }).text, "Promluv s místním znalcem");
  assert.equal(evaluateObjective("besednice", { briefingComplete: true, clues: 2 }).text, "Stopy 2/3");
  assert.equal(evaluateObjective("besednice", { briefingComplete: true, clues: 3 }).text, "Vykopej ježkový profil");
  assert.equal(evaluateObjective("besednice", { briefingComplete: true, clues: 3, hedgehog: true, bossStarted: true }).text, "Dostaň ježek zpět");
  assert.equal(evaluateObjective("besednice", { briefingComplete: true, clues: 3, hedgehog: true, bossStarted: true, bossDefeated: true }).text, "Ježek je v bezpečí");
  assert.equal(isObjectiveComplete("besednice", { clues: 3, hedgehog: true, bossStarted: true, bossDefeated: true }), false);
  assert.equal(isObjectiveComplete("besednice", { briefingComplete: true, clues: 3, hedgehog: true, bossStarted: true, bossDefeated: true }), true);
});

test("Slavia vyžaduje dokumenty, znalkyni, Frantu, certifikát i vstup", () => {
  assert.equal(evaluateObjective("slavia", { papers: 2 }).text, "Dokumenty 2/3");
  assert.equal(evaluateObjective("slavia", { papers: 3 }).text, "Promluv se znalkyní");
  assert.equal(evaluateObjective("slavia", { papers: 3, expertConsulted: true }).text, "Získej kámen zpět od Franty");
  assert.equal(isObjectiveComplete("slavia", { papers: 3, expertConsulted: true, bossStarted: true, bossDefeated: true }), false);
  assert.equal(isObjectiveComplete("slavia", {
    papers: 3,
    expertConsulted: true,
    bossStarted: true,
    bossDefeated: true,
    certified: true,
    entered: true
  }), true);
});

test("progress objektivů zůstává v rozsahu 0 až 1", () => {
  const cases = [
    ["chlum", { permit: true, searched: true, findings: 999 }],
    ["nesmen", { permit: true, dug: 999, filled: 999, findings: 999 }],
    ["besednice", { briefingComplete: true, clues: 999, hedgehog: true, bossStarted: true, bossDefeated: true }],
    ["slavia", { papers: 999, expertConsulted: true, bossStarted: true, bossDefeated: true, certified: true, entered: true }]
  ];
  for (const [level, runtime] of cases) {
    const progress = evaluateObjective(level, runtime).progress;
    assert.ok(progress >= 0 && progress <= 1, `${level}: ${progress}`);
  }
});
