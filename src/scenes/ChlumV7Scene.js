import { ChlumNesmenBridgeScene } from "./ChlumNesmenBridgeScene.js";
import { CHLUM_FINDING_VARIANTS } from "../data/chlum.js";
import { resolveVariant, createFinding } from "../gameplay/FindingResolver.js";
import { setBoundedCameraCenter } from "../render/CameraBounds.js";
import { createProceduralMoldavite } from "../render/ProceduralMoldavite.js";
import { createIdleWrapper, updateIdlePulse, createPickupTween, updatePickupTween, cancelPickupTween } from "../render/VisualEffects.js";
import { syncSpriteVisual } from "../render/ThreeRenderer.js";

const V7_PLATE_ASSET = "terrain-chlum-plate-v7";
const FALLBACK_PLATE_ASSET = "terrain-chlum-field";
const V7_STYLESHEET_ID = "lovec-v7-visual-theme";
const V7_ROOT_CLASS = "v7-visual-rebuild";
const HUNTER_ACTION_CLIPS = Object.freeze({
  search: Object.freeze({ frames: Object.freeze([0]), fps: 2.5, loop: false }),
  "pick-up": Object.freeze({ frames: Object.freeze([1]), fps: 2.2, loop: false }),
  talk: Object.freeze({ frames: Object.freeze([2]), fps: 1.6, loop: false }),
  caught: Object.freeze({ frames: Object.freeze([3]), fps: 2.5, loop: false }),
  dig: Object.freeze({ frames: Object.freeze([4]), fps: 2.5, loop: false }),
  celebration: Object.freeze({ frames: Object.freeze([5]), fps: 1.8, loop: false })
});

export function resolveChlumV7CameraZoom(viewportWidth, viewportHeight) {
  const width = Math.max(1, Number(viewportWidth) || 1);
  const height = Math.max(1, Number(viewportHeight) || 1);
  const aspect = width / height;
  if (aspect >= 2) return 1.24;
  if (aspect >= 1.5) return 1.16;
  if (aspect <= 0.75) return 1.02;
  return 1.08;
}

function ensureV7Theme(documentRef = globalThis.document) {
  if (!documentRef?.head) return false;
  if (documentRef.getElementById(V7_STYLESHEET_ID)) return true;
  const link = documentRef.createElement("link");
  link.id = V7_STYLESHEET_ID;
  link.rel = "stylesheet";
  link.href = "./v7.css";
  documentRef.head.append(link);
  return true;
}

export class ChlumV7Scene extends ChlumNesmenBridgeScene {
  constructor(options) {
    super(options);
    ensureV7Theme();
    this.foregroundRoot = null;
    this.farmerInteractionRing = null;
    this.farmerIdleVisual = null;
    this.tractorSprite = null;
    this.playerWalkSprite = null;
    this.playerActionSprite = null;
    this.findingActionStage = null;
    this.pickupTween = null;
    this.visualTime = 0;
    this.visualMode = "uninitialized";
  }

  async enter(context) {
    const root = globalThis.document?.documentElement;
    root?.classList?.add(V7_ROOT_CLASS);
    try {
      return await super.enter(context);
    } catch (error) {
      root?.classList?.remove(V7_ROOT_CLASS);
      throw error;
    }
  }

  instantiateWorld() {
    super.instantiateWorld();
    const animation = this.app.world.get(this.playerEntity, "animation");
    animation.clips = { ...animation.clips, ...HUNTER_ACTION_CLIPS };
  }

  async createVisualWorld() {
    const THREE = this.THREE;
    const root = new THREE.Group();
    root.name = "chlum-v7-terrain-plate";

    const plateAssetId = this.assetEntries.has(V7_PLATE_ASSET) ? V7_PLATE_ASSET : FALLBACK_PLATE_ASSET;
    this.visualMode = plateAssetId === V7_PLATE_ASSET ? "terrain-plate-v7" : "terrain-plate-fallback";

    const [plateTexture, playerTexture, playerActionTexture, farmerTexture, tractorTexture, foregroundTexture] = await Promise.all([
      this.texture(plateAssetId),
      this.texture("player-hunter-walk"),
      this.texture("player-hunter-actions-v7"),
      this.texture("npc-farmer-vaclav"),
      this.texture("hazard-chlum-tractor-v7"),
      this.texture("foreground-chlum-wet-verge-v7")
    ]);

    const plate = this.renderer.createTerrainPlate(plateTexture, {
      x: this.level.bounds.x,
      y: this.level.bounds.y,
      width: this.level.bounds.width,
      height: this.level.bounds.height,
      z: -12,
      assetId: plateAssetId
    });
    plate.name = "chlum-v7-main-plate";
    root.add(plate);

    // Lighting is intentionally reserved for 3D props/vehicles. The authored plate
    // already contains its final environmental light and must not be re-lit.
    const hemisphere = new THREE.HemisphereLight(0xfff2cf, 0x263b2b, 1.7);
    const sun = new THREE.DirectionalLight(0xffe3ad, 2.1);
    sun.position.set(-260, 420, 520);
    root.add(hemisphere, sun);

    // Secondary props remain sparse: the authored terrain plate owns the scene identity.
    this.addDecorModel(root, "model-chlum-hay-bale", { x: 1280, y: 925, scale: 42, rotationZ: 0.35, z: 2 });

    this.visualRoot = root;
    this.renderer.add(root, "ground");

    playerTexture.repeat.set(0.25, 0.25);
    playerTexture.offset.set(0, 0.75);
    const actorSpriteOptions = {
      width: 86,
      height: 116,
      z: 12,
      anchorX: 0.5,
      anchorY: 0.08
    };
    const player = this.renderer.createSprite(playerTexture, {
      ...actorSpriteOptions,
      assetId: "player-hunter-walk"
    });
    const playerAction = this.renderer.createSprite(playerActionTexture, {
      width: actorSpriteOptions.height,
      height: actorSpriteOptions.height,
      z: actorSpriteOptions.z,
      anchorX: actorSpriteOptions.anchorX,
      anchorY: actorSpriteOptions.anchorY,
      assetId: "player-hunter-actions-v7"
    });
    playerAction.visible = false;
    const playerGroup = new THREE.Group();
    playerGroup.name = "chlum-v7-player-visuals";
    playerGroup.add(player, playerAction);
    this.playerWalkSprite = player;
    this.playerActionSprite = playerAction;
    const farmer = this.renderer.createSprite(farmerTexture, {
      ...actorSpriteOptions,
      assetId: "npc-farmer-vaclav"
    });
    const farmerIdle = createIdleWrapper(THREE, farmer, {
      name: "chlum-v7-farmer-idle",
      amplitude: 0.02,
      frequency: 1.35,
      phase: 0.4
    });
    this.farmerIdleVisual = farmerIdle;
    this.renderer.bindEntity(this.playerEntity, playerGroup, "actors");
    this.renderer.bindEntity(this.farmerEntity, farmerIdle, "actors");
    this.syncPlayerActionVisual();

    const marker = this.modelFactory.bind(this.searchEntity, this.model("model-chlum-field-marker"), {
      assetId: "model-chlum-field-marker",
      layer: "props",
      rotationX: Math.PI / 2,
      scale: 42,
      z: 3
    });
    marker.visible = false;

    const tractor = this.renderer.createSprite(tractorTexture, {
      width: 210,
      height: 140,
      z: 14,
      anchorX: 0.5,
      anchorY: 0.08,
      assetId: "hazard-chlum-tractor-v7"
    });
    this.app.world.add(this.tractorEntity, "sprite", {
      assetId: "hazard-chlum-tractor-v7",
      layer: "actors",
      frame: 0,
      columns: 1,
      rows: 1,
      flipX: false
    });
    this.app.world.get(this.tractorEntity, "transform").rotation = 0;
    this.tractorSprite = tractor;
    this.renderer.bindEntity(this.tractorEntity, tractor, "actors");

    const farmerTransform = this.app.world.get(this.farmerEntity, "transform");
    const interactionRing = new THREE.Mesh(
      new THREE.RingGeometry(45, 52, 64),
      new THREE.MeshBasicMaterial({
        color: 0x9af2ad,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide
      })
    );
    interactionRing.name = "chlum-v7-farmer-interaction-ring";
    interactionRing.position.set(farmerTransform.x, farmerTransform.y - 7, 4);
    this.farmerInteractionRing = interactionRing;
    this.renderer.add(interactionRing, "props");

    // Foreground occlusion is a dedicated render layer. Authored wet vegetation
    // can cover the lower part of actors and create depth without affecting collisions.
    const foreground = new THREE.Group();
    foreground.name = "chlum-v7-foreground-occlusion";
    const nearVerge = this.renderer.createSprite(foregroundTexture, {
      x: 350,
      y: 300,
      z: 30,
      width: 430,
      height: 286,
      anchorX: 0.5,
      anchorY: 0.08,
      assetId: "foreground-chlum-wet-verge-v7"
    });
    nearVerge.name = "chlum-v7-near-wet-verge";
    foreground.add(nearVerge);

    const farVerge = this.renderer.createSprite(foregroundTexture, {
      x: 1370,
      y: 1020,
      z: 30,
      width: 330,
      height: 220,
      anchorX: 0.5,
      anchorY: 0.08,
      assetId: "foreground-chlum-wet-verge-v7"
    });
    farVerge.name = "chlum-v7-far-wet-verge";
    farVerge.scale.x *= -1;
    foreground.add(farVerge);
    this.foregroundRoot = foreground;
    this.renderer.add(foreground, "foreground");
  }

  spawnFinding() {
    if (this.findingEntity !== null) return;
    const searchTransform = this.app.world.get(this.searchEntity, "transform");
    this.findingEntity = this.app.world.createEntity({
      transform: { x: searchTransform.x + 22, y: searchTransform.y + 12, rotation: 0, scale: 1 },
      previousTransform: { x: searchTransform.x + 22, y: searchTransform.y + 12, rotation: 0, scale: 1 },
      interaction: { kind: "collect", label: "SEBRAT", action: "action", range: 70, priority: 80, enabled: true }
    });
    this.externalIdByEntity.set(this.findingEntity, "chlum-finding-1");
    const moldavite = createProceduralMoldavite(this.THREE, {
      locality: "chlum",
      rarity: "B",
      seed: this.session.state.seed ^ 0x43484c55
    });
    this.renderer.bindEntity(this.findingEntity, moldavite, "effects");
  }

  playHunterAction(clip, options = {}) {
    const animation = this.app.world.get(this.playerEntity, "animation");
    const played = this.app.animations.playAction(animation, clip, options);
    if (played) this.syncPlayerActionVisual();
    return played;
  }

  syncPlayerActionVisual() {
    if (!this.playerWalkSprite || !this.playerActionSprite || this.playerEntity === null) return false;
    const animation = this.app.world.get(this.playerEntity, "animation");
    const sprite = this.app.world.get(this.playerEntity, "sprite");
    const actionVisible = Boolean(animation?.actionClip);
    this.playerWalkSprite.visible = !actionVisible;
    this.playerActionSprite.visible = actionVisible;
    if (actionVisible) {
      syncSpriteVisual(this.playerActionSprite, {
        frame: animation.frame,
        columns: 3,
        rows: 2,
        flipX: false
      });
    } else {
      syncSpriteVisual(this.playerWalkSprite, sprite);
    }
    return actionVisible;
  }

  showPermissionDialog() {
    this.playHunterAction("talk", { interruptible: true });
    super.showPermissionDialog();
  }

  activateRadar() {
    if (this.radarEnabled && !this.surfaceSearched) this.playHunterAction("search", { interruptible: true });
    super.activateRadar();
  }

  collectFinding() {
    if (this.findingEntity === null || this.pickupTween) return;
    const entity = this.findingEntity;
    const interaction = this.app.world.get(entity, "interaction");
    if (interaction) interaction.enabled = false;

    this.findingActionStage = "pick-up";
    this.playHunterAction("pick-up");
    const surfaceQuality = this.rng();
    const variant = resolveVariant(CHLUM_FINDING_VARIANTS, surfaceQuality, this.rng);
    this.objectives.recordFinding(createFinding(variant, "chlum-finding-1", "chlum", surfaceQuality));

    const visual = this.renderer.objectByEntity.get(entity);
    this.pickupTween = createPickupTween(visual, { duration: 0.15, targetScale: 1.25 });
    this.radarMessage = "Vltavín byl bezpečně sebrán.";
    this.availableInteraction = null;
    this.interactions.clear();
    this.app.input.reset("finding-collected");
    this.emitHud(true);
    if (!this.pickupTween) this.finishPickup(entity);
  }

  finishPickup(entity) {
    this.renderer.unbindEntity(entity);
    this.app.world.destroyEntity(entity);
    this.externalIdByEntity.delete(entity);
    if (this.findingEntity === entity) this.findingEntity = null;
    this.pickupTween = null;
  }

  showResult() {
    const animation = this.playerEntity === null ? null : this.app.world.get(this.playerEntity, "animation");
    if (this.findingActionStage === "pick-up") {
      if (animation?.actionClip) return;
      this.findingActionStage = "celebration";
      this.playHunterAction("celebration");
      return;
    }
    if (this.findingActionStage === "celebration") {
      if (animation?.actionClip) return;
      this.findingActionStage = null;
    }
    super.showResult();
  }

  updateGameplay(dt, time, input) {
    const player = this.playerEntity === null ? null : this.app.world.get(this.playerEntity, "transform");
    const before = player ? { x: player.x, y: player.y } : null;
    super.updateGameplay(dt, time, input);
    if (!player || !before) return;

    const returnedToSpawn = player.x === this.level.spawn.x && player.y === this.level.spawn.y;
    const teleported = before.x !== player.x || before.y !== player.y;
    const wasAwayFromSpawn = before.x !== this.level.spawn.x || before.y !== this.level.spawn.y;
    if (returnedToSpawn && teleported && wasAwayFromSpawn) {
      this.playHunterAction("caught");
      this.setCameraToPlayer({ snap: true });
    }
  }

  updateMovement(dt, time, input) {
    super.updateMovement(dt, time, input);
    if (this.tractorEntity === null) return;
    const transform = this.app.world.get(this.tractorEntity, "transform");
    const patrol = this.app.world.get(this.tractorEntity, "patrol");
    const sprite = this.app.world.get(this.tractorEntity, "sprite");
    if (transform) transform.rotation = 0;
    if (sprite && patrol) sprite.flipX = patrol.direction < 0;
  }

  updateAnimations(dt) {
    super.updateAnimations(dt);
    this.visualTime += Math.max(0, Number(dt) || 0);
    updateIdlePulse(this.farmerIdleVisual, this.visualTime);
    if (this.pickupTween && updatePickupTween(this.pickupTween, dt)) {
      const entity = this.findingEntity;
      if (entity !== null) this.finishPickup(entity);
      else this.pickupTween = null;
    }
    this.syncPlayerActionVisual();
  }

  setCameraToPlayer(options = {}) {
    if (this.playerEntity === null) return;
    const transform = this.app.world.get(this.playerEntity, "transform");
    const zoom = resolveChlumV7CameraZoom(this.renderer.width, this.renderer.height);
    setBoundedCameraCenter(this.renderer, this.level.bounds, transform.x, transform.y, zoom, {
      deadZoneRatio: 0.06,
      damping: 0.18,
      snapDistanceRatio: 0.55,
      ...options
    });
  }

  updateHud() {
    super.updateHud();
    if (!this.farmerInteractionRing) return;
    const farmerInteraction = this.app.world.get(this.farmerEntity, "interaction");
    this.farmerInteractionRing.visible = this.session.state.phase === "playing" && farmerInteraction?.enabled === true;
  }

  destroyVisualWorld() {
    if (this.pickupTween) cancelPickupTween(this.pickupTween);
    this.pickupTween = null;
    if (this.farmerInteractionRing) {
      this.renderer.remove(this.farmerInteractionRing);
      this.renderer.disposeObject(this.farmerInteractionRing);
      this.farmerInteractionRing = null;
    }
    if (this.foregroundRoot) {
      this.renderer.remove(this.foregroundRoot);
      this.renderer.disposeObject(this.foregroundRoot);
      this.foregroundRoot = null;
    }
    this.farmerIdleVisual = null;
    this.tractorSprite = null;
    this.playerWalkSprite = null;
    this.playerActionSprite = null;
    this.findingActionStage = null;
    this.visualTime = 0;
    super.destroyVisualWorld();
  }

  async exit(context) {
    globalThis.document?.documentElement?.classList?.remove(V7_ROOT_CLASS);
    return super.exit(context);
  }

  snapshot() {
    const snapshot = super.snapshot();
    return {
      ...snapshot,
      runtime: {
        ...snapshot.runtime,
        visualMode: this.visualMode,
        cameraZoom: this.renderer.camera?.zoom ?? null,
        farmerInteractionRingVisible: this.farmerInteractionRing?.visible === true,
        farmerIdleScaleY: this.farmerIdleVisual?.scale?.y ?? null,
        pickupActive: Boolean(this.pickupTween)
      }
    };
  }
}

export { ensureV7Theme };