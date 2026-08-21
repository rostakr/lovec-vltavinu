import { getLevelDefinition, getNextLevelId } from "../data/levels.js";
import { createSessionSeed } from "./SessionRng.js";

const PHASES = new Set(["briefing", "playing", "digging", "paused", "complete", "finale"]);
const RARITIES = new Set(["A", "B", "C"]);

const deepFreeze = value => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
};

const finiteNumber = (value, field) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative finite number.`);
  }
  return value;
};

function initialObjective(level) {
  return {
    id: level.objective.id,
    current: 0,
    required: level.objective.required,
    complete: false
  };
}

function createInitialState() {
  const level = getLevelDefinition("chlum");
  return deepFreeze({
    seed: createSessionSeed(),
    levelId: level.id,
    phase: "briefing",
    findings: [],
    score: 0,
    health: 3,
    danger: 0,
    flags: {},
    objective: initialObjective(level)
  });
}

function normalizeFinding(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Finding must be an object.");
  }

  const findingId = String(input.findingId ?? "").trim();
  const locality = String(input.locality ?? "").trim();
  const rarity = String(input.rarity ?? "").trim().toUpperCase();
  if (!findingId) throw new TypeError("findingId must be a non-empty string.");
  if (!getLevelDefinition(locality)) throw new TypeError(`Unknown finding locality: ${locality}`);
  if (!RARITIES.has(rarity)) throw new TypeError(`Unknown finding rarity: ${rarity}`);

  return {
    findingId,
    locality,
    rarity,
    weight: finiteNumber(input.weight, "weight"),
    score: Math.round(finiteNumber(input.score, "score"))
  };
}

export class GameSession {
  #state = createInitialState();

  get state() {
    return this.#state;
  }

  reset() {
    this.#state = createInitialState();
    return this.#state;
  }

  enterLevel(levelId) {
    const level = getLevelDefinition(levelId);
    if (!level) throw new Error(`Unknown level: ${levelId}`);
    this.#state = deepFreeze({
      ...this.#state,
      levelId: level.id,
      phase: "briefing",
      danger: 0,
      objective: initialObjective(level)
    });
    return this.#state;
  }

  enterNextLevel() {
    const nextLevelId = getNextLevelId(this.#state.levelId);
    return nextLevelId ? this.enterLevel(nextLevelId) : null;
  }

  setPhase(phase) {
    if (!PHASES.has(phase)) throw new TypeError(`Unknown session phase: ${phase}`);
    this.#state = deepFreeze({ ...this.#state, phase });
    return this.#state;
  }

  setDanger(value) {
    const danger = Math.max(0, Math.min(100, finiteNumber(value, "danger")));
    this.#state = deepFreeze({ ...this.#state, danger });
    return this.#state;
  }

  setFlag(name, value = true) {
    if (typeof name !== "string" || !name.trim()) throw new TypeError("Flag name must be a non-empty string.");
    this.#state = deepFreeze({
      ...this.#state,
      flags: { ...this.#state.flags, [name]: value === true }
    });
    return this.#state;
  }

  setObjectiveProgress(current, complete = false) {
    const value = Math.floor(finiteNumber(current, "objective current"));
    this.#state = deepFreeze({
      ...this.#state,
      objective: {
        ...this.#state.objective,
        current: value,
        complete: complete === true
      }
    });
    return this.#state;
  }

  recordFinding(input) {
    const finding = normalizeFinding(input);
    if (this.#state.findings.some(entry => entry.findingId === finding.findingId)) {
      throw new Error(`Finding already recorded: ${finding.findingId}`);
    }

    this.#state = deepFreeze({
      ...this.#state,
      findings: [...this.#state.findings, finding],
      score: this.#state.score + finding.score
    });
    return this.#state;
  }
}

export function createGameSession() {
  return new GameSession();
}
