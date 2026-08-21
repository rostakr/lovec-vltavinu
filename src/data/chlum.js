import { CONTEXT_ACTION, getLevelDefinition, getLevelTarget } from "./levels.js";
import { getDialogueDefinition } from "./dialogues.js";

const deepFreeze = value => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
};

const level = getLevelDefinition("chlum");
const farmerPosition = getLevelTarget("chlum", "farmer-vaclav")?.positions[0];
const searchPosition = getLevelTarget("chlum", "chlum-search-site")?.positions[0];
if (!level || !farmerPosition || !searchPosition || !getDialogueDefinition("chlum-permission")) throw new Error("Chlum canonical data is incomplete.");

const playerWalkDirections = {
  down: [0, 1, 2, 3],
  left: [4, 5, 6, 7],
  right: [8, 9, 10, 11],
  up: [12, 13, 14, 15]
};

const playerIdleDirections = {
  down: [0],
  left: [4],
  right: [8],
  up: [12]
};

const entities = [
  {
    id: "player",
    components: {
      transform: { ...level.spawn, rotation: 0, scale: 1 },
      sprite: { assetId: "player-hunter-walk", layer: "actors", frame: 0, columns: 4, rows: 4, flipX: false },
      animation: {
        clip: "idle",
        frames: [0],
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
        directionFrames: playerIdleDirections,
        motionClip: "walk",
        idleClip: "idle",
        clips: {
          idle: {
            frames: [0],
            fps: 1,
            loop: true,
            directionFrames: playerIdleDirections
          },
          walk: {
            frames: [0, 1, 2, 3],
            fps: 6,
            loop: true,
            directionFrames: playerWalkDirections
          }
        }
      },
      collider: { shape: "circle", radius: 18, layer: "player", mask: ["hazard"] },
      player: { speed: 220 }
    }
  },
  { id: "farmer-vaclav", components: { transform: { ...farmerPosition, rotation: 0, scale: 1 }, sprite: { assetId: "npc-farmer-vaclav", layer: "actors", frame: 0 }, collider: { shape: "circle", radius: 24, layer: "npc", mask: [] }, interaction: { kind: "permission", label: "MLUVIT", action: CONTEXT_ACTION, range: 64, priority: 100, enabled: true }, npc: { name: "Václav", role: "farmer", dialogueId: "chlum-permission" } } },
  { id: "chlum-search-site", components: { transform: { ...searchPosition, rotation: 0, scale: 1 }, model: { assetId: "model-chlum-field-marker", layer: "props" }, searchSpot: { findingId: "chlum-finding-1", variantId: "chlum-standard", searched: false, detectionRange: 240 } } },
  { id: "tractor", components: { transform: { x: 360, y: 590, rotation: Math.PI / 2, scale: 1 }, model: { assetId: "model-chlum-tractor-no-driver", layer: "actors" }, collider: { shape: "aabb", width: 112, height: 64, layer: "hazard", mask: ["player"] }, hazard: { kind: "tractor", danger: 100, consequence: "return-to-spawn", enabled: true }, patrol: { axis: "x", min: 240, max: 1360, speed: 135, direction: 1 } } }
];

export const CHLUM_ENTITY_DEFINITIONS = deepFreeze(entities);
const entityById = new Map(CHLUM_ENTITY_DEFINITIONS.map(entity => [entity.id, entity]));
export const CHLUM_FINDING_VARIANTS = deepFreeze([
  { id: "chlum-small", rarity: "C", weight: 0.8, score: 50, assetId: "finding-vltavin-common" },
  { id: "chlum-standard", rarity: "B", weight: 1.2, score: 90, assetId: "finding-vltavin-standard" },
  { id: "chlum-rare", rarity: "A", weight: 1.7, score: 150, assetId: "finding-vltavin-rare" }
]);
const findingById = new Map(CHLUM_FINDING_VARIANTS.map(variant => [variant.id, variant]));
export function getChlumEntityDefinition(id) { return entityById.get(id) ?? null; }
export function createChlumFinding(variantId = "chlum-standard", findingId = "chlum-finding-1") {
  const variant = findingById.get(variantId);
  if (!variant) throw new Error(`Unknown Chlum finding variant: ${variantId}`);
  if (typeof findingId !== "string" || !findingId.trim()) throw new TypeError("findingId must be a non-empty string.");
  return Object.freeze({ findingId: findingId.trim(), locality: "chlum", rarity: variant.rarity, weight: variant.weight, score: variant.score });
}
