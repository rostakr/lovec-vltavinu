import { CONTEXT_ACTION, getLevelDefinition, getLevelTarget } from "./levels.js";
import { getDialogueDefinition } from "./dialogues.js";

const deepFreeze = value => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
};

const level = getLevelDefinition("besednice");
const guidePosition = getLevelTarget("besednice", "besednice-guide")?.positions[0];
const tracePositions = getLevelTarget("besednice", "besednice-trace")?.positions ?? [];
const hedgehogPosition = getLevelTarget("besednice", "besednice-hedgehog")?.positions[0];
const karelPosition = getLevelTarget("besednice", "crystal-karel")?.positions[0];
if (!level || !guidePosition || tracePositions.length !== 3 || !hedgehogPosition || !karelPosition) {
  throw new Error("Besednice canonical data is incomplete.");
}

export const BESEDNICE_TRACE_IDS = Object.freeze([
  "besednice-trace-1",
  "besednice-trace-2",
  "besednice-trace-3"
]);

const entities = [
  {
    id: "player",
    components: {
      transform: { ...level.spawn, rotation: 0, scale: 1 },
      sprite: { assetId: "player-hunter-walk", layer: "actors", frame: 0, columns: 4, rows: 4, flipX: false },
      animation: {
        clip: "walk",
        frames: [0, 1, 2, 3],
        fps: 6,
        loop: true,
        playing: false,
        index: 0,
        elapsed: 0,
        completed: false,
        frame: 0,
        motionDriven: true,
        motionThreshold: 0.001,
        resetOnIdle: true,
        direction: "down",
        directionFrames: { down: [0, 1, 2, 3], left: [4, 5, 6, 7], right: [8, 9, 10, 11], up: [12, 13, 14, 15] }
      },
      collider: { shape: "circle", radius: 18, layer: "player", mask: [] },
      player: { speed: 220 }
    }
  },
  {
    id: "besednice-guide",
    components: {
      transform: { ...guidePosition, rotation: 0, scale: 1 },
      sprite: { assetId: "npc-rival-karel", layer: "actors", frame: 0, flipX: true },
      interaction: {
        kind: "talk",
        label: "PROMLUVIT",
        action: CONTEXT_ACTION,
        range: 76,
        priority: 90,
        enabled: true
      }
    }
  },
  ...BESEDNICE_TRACE_IDS.map((id, index) => ({
    id,
    components: {
      transform: { ...tracePositions[index], rotation: 0, scale: 1 },
      model: { assetId: "model-besednice-trace-marker", layer: "props" },
      interaction: {
        kind: "discover",
        label: "PROZKOUMAT",
        action: CONTEXT_ACTION,
        range: 66,
        priority: 70,
        enabled: false
      },
      clue: { index, discovered: false }
    }
  })),
  {
    id: "besednice-hedgehog",
    components: {
      transform: { ...hedgehogPosition, rotation: 0, scale: 1 },
      model: { assetId: "model-besednice-hedgehog-marker", layer: "props" },
      interaction: {
        kind: "dig",
        label: "KOPAT",
        action: CONTEXT_ACTION,
        range: 68,
        priority: 80,
        enabled: false
      },
      digSpot: {
        findingId: "besednice-hedgehog-1",
        variantId: "besednice-hedgehog",
        dug: false
      }
    }
  },
  {
    id: "crystal-karel",
    components: {
      transform: { ...karelPosition, rotation: 0, scale: 1 },
      sprite: { assetId: "npc-rival-karel", layer: "actors", frame: 0, flipX: false },
      collider: { shape: "circle", radius: 24, layer: "boss", mask: [] },
      interaction: {
        kind: "recover",
        label: "ZÍSKAT ZPĚT",
        action: CONTEXT_ACTION,
        range: 74,
        priority: 100,
        enabled: false
      },
      boss: {
        id: "crystal-karel",
        state: "inactive",
        speed: 150,
        stopRange: 58,
        started: false,
        defeated: false
      }
    }
  }
];

export const BESEDNICE_ENTITY_DEFINITIONS = deepFreeze(entities);
const entityById = new Map(BESEDNICE_ENTITY_DEFINITIONS.map(entity => [entity.id, entity]));

export const BESEDNICE_FINDING_VARIANTS = deepFreeze([
  {
    id: "besednice-hedgehog",
    rarity: "A",
    weight: 2.8,
    score: 240,
    assetId: "finding-vltavin-besednice-hedgehog"
  }
]);
const findingById = new Map(BESEDNICE_FINDING_VARIANTS.map(variant => [variant.id, variant]));

export function getBesedniceEntityDefinition(id) {
  return entityById.get(id) ?? null;
}

export function createBesedniceFinding(variantId = "besednice-hedgehog", findingId = "besednice-hedgehog-1") {
  const variant = findingById.get(variantId);
  if (!variant) throw new Error(`Unknown Besednice finding variant: ${variantId}`);
  if (typeof findingId !== "string" || !findingId.trim()) throw new TypeError("findingId must be a non-empty string.");
  return Object.freeze({
    findingId: findingId.trim(),
    locality: "besednice",
    rarity: variant.rarity,
    weight: variant.weight,
    score: variant.score
  });
}
