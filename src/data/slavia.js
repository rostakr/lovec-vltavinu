import { CONTEXT_ACTION, getLevelDefinition, getLevelTarget } from "./levels.js";

const deepFreeze = value => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
};

const level = getLevelDefinition("slavia");
const documentPositions = getLevelTarget("slavia", "documentation-folder")?.positions ?? [];
const expertPosition = getLevelTarget("slavia", "expert-eva")?.positions[0];
const thiefPosition = getLevelTarget("slavia", "thief-franta")?.positions[0];
const venuePosition = getLevelTarget("slavia", "kd-slavia")?.positions[0];

if (!level || documentPositions.length !== 3 || !expertPosition || !thiefPosition || !venuePosition) {
  throw new Error("Slavia canonical data is incomplete.");
}

export const SLAVIA_DOCUMENT_IDS = Object.freeze([
  "slavia-document-chlum",
  "slavia-document-nesmen",
  "slavia-document-besednice"
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
  ...SLAVIA_DOCUMENT_IDS.map((id, index) => ({
    id,
    components: {
      transform: { ...documentPositions[index], rotation: 0, scale: 1 },
      model: { assetId: "model-slavia-document-folder", layer: "props" },
      interaction: {
        kind: "collect-document",
        label: "VYZVEDNOUT",
        action: CONTEXT_ACTION,
        range: 64,
        priority: 70,
        enabled: true
      },
      document: {
        locality: ["chlum", "nesmen", "besednice"][index],
        collected: false
      }
    }
  })),
  {
    id: "expert-eva",
    components: {
      transform: { ...expertPosition, rotation: 0, scale: 1 },
      sprite: { assetId: "npc-expert-eva", layer: "actors", frame: 0, flipX: false },
      collider: { shape: "circle", radius: 22, layer: "npc", mask: [] },
      interaction: {
        kind: "register-collection",
        label: "REGISTROVAT",
        action: CONTEXT_ACTION,
        range: 74,
        priority: 90,
        enabled: false
      },
      expert: { registered: false, evaluated: false }
    }
  },
  {
    id: "thief-franta",
    components: {
      transform: { ...thiefPosition, rotation: 0, scale: 1 },
      sprite: { assetId: "npc-thief-franta", layer: "actors", frame: 0, flipX: false },
      collider: { shape: "circle", radius: 24, layer: "boss", mask: [] },
      interaction: {
        kind: "recover-best-finding",
        label: "ZASTAVIT",
        action: CONTEXT_ACTION,
        range: 74,
        priority: 100,
        enabled: false
      },
      boss: {
        id: "thief-franta",
        state: "inactive",
        speed: 112,
        stopRange: 58,
        started: false,
        defeated: false
      }
    }
  },
  {
    id: "kd-slavia",
    components: {
      transform: { ...venuePosition, rotation: 0, scale: 1 },
      model: { assetId: "model-slavia-kd-building", layer: "props" },
      interaction: {
        kind: "enter-event",
        label: "VSTOUPIT",
        action: CONTEXT_ACTION,
        range: 92,
        priority: 110,
        enabled: false
      },
      destination: { entered: false }
    }
  }
];

export const SLAVIA_ENTITY_DEFINITIONS = deepFreeze(entities);
const entityById = new Map(SLAVIA_ENTITY_DEFINITIONS.map(entity => [entity.id, entity]));

export function getSlaviaEntityDefinition(id) {
  return entityById.get(id) ?? null;
}
