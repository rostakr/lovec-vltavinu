import { CONTEXT_ACTION, getLevelDefinition, getLevelTarget } from "./levels.js";
import { getDialogueDefinition } from "./dialogues.js";

const deepFreeze = value => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
};

const level = getLevelDefinition("nesmen");
const foresterPosition = getLevelTarget("nesmen", "forester")?.positions[0];
const profilePositions = getLevelTarget("nesmen", "forest-profile")?.positions ?? [];
if (!level || !foresterPosition || profilePositions.length !== 3 || !getDialogueDefinition("nesmen-permission")) {
  throw new Error("Nesměň canonical data is incomplete.");
}

export const NESMEN_PROFILE_IDS = Object.freeze(["nesmen-profile-1", "nesmen-profile-2", "nesmen-profile-3"]);

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
    id: "forester",
    components: {
      transform: { ...foresterPosition, rotation: 0, scale: 1 },
      sprite: { assetId: "npc-forester-jan", layer: "actors", frame: 0 },
      collider: { shape: "circle", radius: 24, layer: "npc", mask: [] },
      interaction: { kind: "permission", label: "MLUVIT", action: CONTEXT_ACTION, range: 66, priority: 100, enabled: true },
      npc: { name: "Jan", role: "forester", dialogueId: "nesmen-permission" }
    }
  },
  ...NESMEN_PROFILE_IDS.map((id, index) => ({
    id,
    components: {
      transform: { ...profilePositions[index], rotation: 0, scale: 1 },
      model: { assetId: "model-nesmen-profile-marker", layer: "props" },
      interaction: { kind: "dig", label: "KOPAT", action: CONTEXT_ACTION, range: 62, priority: 60, enabled: false },
      digSpot: {
        profileIndex: index,
        findingId: index === 0 ? "nesmen-finding-1" : null,
        variantId: index === 0 ? "nesmen-standard" : null,
        dug: false,
        filled: false
      }
    }
  }))
];

export const NESMEN_ENTITY_DEFINITIONS = deepFreeze(entities);
const entityById = new Map(NESMEN_ENTITY_DEFINITIONS.map(entity => [entity.id, entity]));

export const NESMEN_FINDING_VARIANTS = deepFreeze([
  { id: "nesmen-small", rarity: "C", weight: 0.9, score: 70, assetId: "finding-vltavin-nesmen" },
  { id: "nesmen-standard", rarity: "B", weight: 1.5, score: 120, assetId: "finding-vltavin-nesmen" },
  { id: "nesmen-rare", rarity: "A", weight: 2.1, score: 190, assetId: "finding-vltavin-nesmen" }
]);
const findingById = new Map(NESMEN_FINDING_VARIANTS.map(variant => [variant.id, variant]));

export function getNesmenEntityDefinition(id) {
  return entityById.get(id) ?? null;
}

export function createNesmenFinding(variantId = "nesmen-standard", findingId = "nesmen-finding-1") {
  const variant = findingById.get(variantId);
  if (!variant) throw new Error(`Unknown Nesměň finding variant: ${variantId}`);
  if (typeof findingId !== "string" || !findingId.trim()) throw new TypeError("findingId must be a non-empty string.");
  return Object.freeze({
    findingId: findingId.trim(),
    locality: "nesmen",
    rarity: variant.rarity,
    weight: variant.weight,
    score: variant.score
  });
}
