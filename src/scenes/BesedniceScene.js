import { DIG_REQUIRED_HITS, LEVEL_ORDER, getLevelDefinition } from "../data/levels.js";
import { BESEDNICE_ENTITY_DEFINITIONS, BESEDNICE_TRACE_IDS, BESEDNICE_FINDING_VARIANTS } from "../data/besednice.js";
import { getDialogueDefinition } from "../data/dialogues.js";
import { InteractionSystem } from "../gameplay/InteractionSystem.js";
import { DigSystem } from "../gameplay/DigSystem.js";
import { ObjectiveSystem } from "../gameplay/ObjectiveSystem.js";
import { BossSystem } from "../gameplay/BossSystem.js";
import { createRng } from "../gameplay/SessionRng.js";
import { CLEAN_DIG_SCORE_MULTIPLIER, resolveVariant, createFinding } from "../gameplay/FindingResolver.js";
import { ModelFactory } from "../render/ModelFactory.js";
import { setBoundedCameraCenter } from "../render/CameraBounds.js";
import { createProceduralMoldavite } from "../render/ProceduralMoldavite.js";
import { createIdleWrapper, updateIdlePulse, createPickupTween, updatePickupTween, cancelPickupTween } from "../render/VisualEffects.js";
import { createDustEmitter, createSparkleEmitter } from "../render/ParticleSystem.js";

const MANIFEST_ENTRY = Object.freeze({ id: "besednice-runtime-assets", type: "json", url: "./assets/manifests/assets.json" });
const V7_PLATE_ASSET = "terrain-besednice-clay-quarry-v7";
const V7_FOREGROUND_ASSET = "foreground-besednice-quarry-edge-v7";
const cloneData = value => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const BESEDNICE_DIG_CONFIG = Object.freeze({ sweetMin: 0.43, sweetMax: 0.57, speed: 1.45 });

export function resolveBesedniceV7CameraZoom(viewportWidth, viewportHeight, viewHeight = 720, boundsWidth = 1680) {
  const width = Math.max(1, Number(viewportWidth) || 1);
  const height = Math.max(1, Number(viewportHeight) || 1);
  const safeViewHeight = Math.max(1, Number(viewHeight) || 720);
  const safeBoundsWidth = Math.max(1, Number(boundsWidth) || 1680);
  const fitZoom = (safeViewHeight * (width / height)) / safeBoundsWidth;
  const boundsSafeZoom = Math.ceil(fitZoom * 100) / 100 + 0.01;
  return Math.max(0.9, boundsSafeZoom);
}

function moldaviteNoise(x, y, z) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

export function createBesedniceMoldavite(THREE) {
  if (!THREE?.IcosahedronGeometry || !THREE?.MeshStandardMaterial || !THREE?.Mesh) {
    throw new TypeError("Besednice moldavite requires Three.js mesh primitives.");
  }

  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const position = geometry.attributes?.position;
  if (!position?.getX || !position?.setXYZ) throw new TypeError("Besednice moldavite geometry must expose positions.");

  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const radial = 0.79 + moldaviteNoise(x, y, z) * 0.25;
    position.setXYZ(index, x * radial * 1.12, y * radial * 0.92, z * radial * 0.68);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals?.();

  const material = new THREE.MeshStandardMaterial({
    color: 0x2f6038,
    emissive: 0x0c2010,
    emissiveIntensity: 0.22,
    roughness: 0.52,
    metalness: 0.015,
    transparent: true,
    opacity: 0.95
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "besednice-moldavite-finding";
  mesh.position.z = 14;
  mesh.rotation.x = 0.25;
  mesh.rotation.y = -0.42;
  mesh.scale.set(5.2, 4.1, 3.2);
  mesh.userData.assetId = "procedural-besednice-moldavite";
  mesh.userData.findingVisual = "moldavite";
  return mesh;
}

export class BesedniceScene {
  constructor(options) {
    this.app = options.app;
    this.events = options.events;
    this.renderer = options.renderer;
    this.THREE = options.three;
    this.screens = options.screens;
    this.session = options.session;
    this.level = getLevelDefinition("besednice");
    this.modelFactory = new ModelFactory({ renderer: this.renderer });
    this.interactions = new InteractionSystem({ events: this.events });
    this.dig = new DigSystem({ events: this.events, sweetMin: 0.42, sweetMax: 0.58, speed: 1.5 });
    this.dig = new DigSystem({ events: this.events, ...BESEDNICE_DIG_CONFIG });
    this.objectives = new ObjectiveSystem({ events: this.events, session: this.session, levelId: "besednice" });
    this.boss = new BossSystem();
    this.resetRuntime();
  }

  async enter() {
    this.resetRuntime();
    this.session.enterLevel(this.level.id);
    await this.loadAssets();
    this.instantiateWorld();
    await this.createVisualWorld();
    this.syncLocks();
    this.setCameraToPlayer();
    this.screens.showBrief(this.level, LEVEL_ORDER.length, () => this.beginPlaying());
    this.emitHud(true);
  }

  resetRuntime() {
    this.destroyVisualWorld?.();
    this.app?.world?.clear?.();
    this.app?.collisions?.reset?.();
    this.interactions?.clear?.();
    this.dig?.cancel?.();
    this.objectives?.reset?.();
    this.assetEntries = new Map();
    this.loadedModels = new Map();
    this.entityByExternalId = new Map();
    this.externalIdByEntity = new Map();
    this.traceVisuals = new Map();
    this.visualRoot = null;
    this.foregroundRoot = null;
    this.karelIdleVisual = null;
    this.pickupTween = null;
    this.dustEmitter = null;
    this.sparkleEmitter = null;
    this.visualTime = 0;
    this.playerEntity = null;
    this.guideEntity = null;
    this.traceEntities = [];
    this.hedgehogEntity = null;
    this.karelEntity = null;
    this.findingEntity = null;
    this.collectingEntity = null;
    this.collectingElapsed = 0;
    this.availableInteraction = null;
    this.modal = null;
    this.briefingComplete = false;
    this.totalDigHits = 0;
    this.rng = createRng(this.session.state.seed ^ 0x42455345);
    this.resultShown = false;
    this.levelComplete = null;
    this.hudRevision = this.hudRevision ?? 0;
    this.hudSignature = "";
    this.npcIdleTime = 0;
  }

  async loadAssets() {
    const manifest = await this.app.assets.load(MANIFEST_ENTRY);
    if (!Array.isArray(manifest)) throw new Error("Besednice asset manifest must be an array.");
    this.app.assets.setManifest(manifest);
    const selected = this.app.assets.selectPreload(this.level.assetGroups);
    this.assetEntries = new Map(selected.map(entry => [entry.id, entry]));
    const loaded = await this.app.assets.loadAll(selected);
    for (const [id, asset] of loaded) {
      const entry = this.requireAsset(id);
      if (entry.type === "texture" || entry.type === "spritesheet") this.configureTexture(entry, asset);
      else if (entry.type === "gltf") {
        asset.userData.assetId = id;
        this.loadedModels.set(id, asset);
      }
    }
  }

  requireAsset(id) {
    const entry = this.assetEntries.get(id);
    if (!entry) throw new Error(`Missing Besednice asset entry: ${id}`);
    return entry;
  }

  configureTexture(entry, texture) {
    texture.colorSpace = this.THREE.SRGBColorSpace;
    if (entry.wrap === "repeat") {
      texture.wrapS = this.THREE.RepeatWrapping;
      texture.wrapT = this.THREE.RepeatWrapping;
    }
    texture.needsUpdate = true;
    return texture;
  }

  async texture(id) {
    const entry = this.requireAsset(id);
    if (entry.type !== "texture" && entry.type !== "spritesheet") throw new Error(`Asset ${id} is not a texture.`);
    const texture = await this.app.assets.get(id, entry.type);
    if (!texture) throw new Error(`Texture is not loaded: ${id}`);
    return texture;
  }

  model(id) {
    const model = this.loadedModels.get(id);
    if (!model) throw new Error(`Model is not loaded: ${id}`);
    return model;
  }

  instantiateWorld() {
    for (const definition of BESEDNICE_ENTITY_DEFINITIONS) {
      const components = cloneData(definition.components);
      components.previousTransform = { ...components.transform };
      const entity = this.app.world.createEntity(components);
      this.entityByExternalId.set(definition.id, entity);
      this.externalIdByEntity.set(entity, definition.id);
    }
    this.playerEntity = this.entityByExternalId.get("player");
    this.guideEntity = this.entityByExternalId.get("besednice-guide");
    this.traceEntities = BESEDNICE_TRACE_IDS.map(id => this.entityByExternalId.get(id));
    this.hedgehogEntity = this.entityByExternalId.get("besednice-hedgehog");
    this.karelEntity = this.entityByExternalId.get("crystal-karel");
    if (![this.playerEntity, this.guideEntity, this.hedgehogEntity, this.karelEntity, ...this.traceEntities].every(Number.isInteger)) {
      throw new Error("Besednice entities are incomplete.");
    }
  }

  async createVisualWorld() {
    const THREE = this.THREE;
    const root = new THREE.Group();
    root.name = "besednice-vertical-slice";
    const [environmentTexture, foregroundTexture, playerTexture, karelTexture] = await Promise.all([
      this.texture(V7_PLATE_ASSET),
      this.texture(V7_FOREGROUND_ASSET),
      this.texture("player-hunter-walk"),
      this.texture("npc-rival-karel")
    ]);
    const ground = this.renderer.createTerrainPlate(environmentTexture, {
      x: this.level.bounds.x,
      y: this.level.bounds.y,
      width: this.level.bounds.width,
      height: this.level.bounds.height,
      z: -12,
      assetId: V7_PLATE_ASSET
    });
    ground.name = "besednice-v7-main-plate";
    root.add(ground);
    const ambient = new THREE.HemisphereLight(0xf0d7af, 0x241d19, 1.65);
    const sun = new THREE.DirectionalLight(0xffefcf, 1.85);
    sun.position.set(-180, 420, 580);
    root.add(ambient, sun);
    this.visualRoot = root;
    this.renderer.add(root, "ground");
    playerTexture.repeat.set(0.25, 0.25);
    playerTexture.offset.set(0, 0.75);
    const player = this.renderer.createSprite(playerTexture, {
      width: 82, height: 108, z: 12, anchorX: 0.5, anchorY: 0.08, assetId: "player-hunter-walk"
    });
    const guide = this.renderer.createSprite(karelTexture, {
      width: 78, height: 104, z: 12, anchorX: 0.5, anchorY: 0.08, color: 0xb9d8a5, assetId: "npc-rival-karel"
    });
    guide.scale.x *= -1;
    const karel = this.renderer.createSprite(karelTexture, {
      width: 82, height: 108, z: 12, anchorX: 0.5, anchorY: 0.08, color: 0xff8f72, assetId: "npc-rival-karel"
    });
    const karelIdle = createIdleWrapper(THREE, karel, {
      name: "besednice-v7-karel-idle",
      amplitude: 0.02,
      frequency: 1.65,
      phase: 2.2
    });
    this.karelIdleVisual = karelIdle;
    this.renderer.bindEntity(this.playerEntity, player, "actors");
    this.renderer.bindEntity(this.guideEntity, guide, "actors");
    this.renderer.bindEntity(this.karelEntity, karelIdle, "actors");
    for (const entity of this.traceEntities) {
      const marker = this.modelFactory.clone(this.model("model-besednice-trace-marker"), {
        assetId: "model-besednice-trace-marker", layer: "props", rotationX: Math.PI / 2, scale: 38, z: 4
      });
      marker.visible = false;
      this.renderer.bindEntity(entity, marker, "props");
      this.traceVisuals.set(entity, marker);
    }
    const hedgehogMarker = this.modelFactory.clone(this.model("model-besednice-hedgehog-marker"), {
      assetId: "model-besednice-hedgehog-marker", rotationX: Math.PI / 2, scale: 64, z: 5
    });
    hedgehogMarker.visible = false;
    this.renderer.bindEntity(this.hedgehogEntity, hedgehogMarker, "props");

    const foreground = new THREE.Group();
    foreground.name = "besednice-v7-foreground-occlusion";
    const quarryEdge = this.renderer.createSprite(foregroundTexture, {
      x: this.level.bounds.x + this.level.bounds.width / 2,
      y: this.level.bounds.y + this.level.bounds.height / 2,
      z: 30,
      width: this.level.bounds.width,
      height: this.level.bounds.height,
      anchorX: 0.5,
      anchorY: 0.5,
      assetId: V7_FOREGROUND_ASSET
    });
    quarryEdge.name = "besednice-v7-quarry-edge";
    foreground.add(quarryEdge);
    this.foregroundRoot = foreground;
    this.renderer.add(foreground, "foreground");

    this.dustEmitter = createDustEmitter(THREE, { color: 0x6B5A47 });
    this.renderer.add(this.dustEmitter.object, "effects");
    this.sparkleEmitter = createSparkleEmitter(THREE, { color: 0x8FBC8F });
    this.renderer.add(this.sparkleEmitter.object, "effects");

    this.events.on("dig:hit", ({ position }) => this.onDigHit(position));
    this.events.on("dig:clean", () => this.onDigClean());
  }

  beginPlaying() {
    this.session.setPhase("playing");
    this.screens.play();
    this.app.input.reset("besednice-start");
    this.emitHud(true);
  }

  beginFixed() {
    for (const [, transform, previous] of this.app.world.query("transform", "previousTransform")) Object.assign(previous, transform);
  }

  updateControl(_dt, _time, input) {
    if (!input.actions.pause?.pressed || this.modal) return;
    if (this.session.state.phase === "playing") this.pause();
    else if (this.session.state.phase === "paused") this.resume();
  }

  updateMovement(dt, _time, input) {
    if (this.session.state.phase !== "playing" || this.modal || this.resultShown) return;
    const player = this.app.world.get(this.playerEntity, "transform");
    const playerData = this.app.world.get(this.playerEntity, "player");
    const move = input.axes.move ?? { x: 0, y: 0 };
    const speed = playerData?.speed ?? 220;
    const walkable = this.level.walkable ?? this.level.bounds;
    player.x = clamp(player.x + (move.x ?? 0) * speed * dt, walkable.x + 28, walkable.x + walkable.width - 28);
    player.y = clamp(player.y + (move.y ?? 0) * speed * dt, walkable.y + 28, walkable.y + walkable.height - 28);
    this.setCameraToPlayer();
  }

  updateCollisions() {
    if (this.session.state.phase === "playing" && !this.modal) this.app.collisions.update(this.app.world);
  }

  updateGameplay(dt, _time, input) {
    if (this.session.state.phase === "digging" && this.modal === "dig") {
      const state = this.dig.update(dt);
      if (state) this.screens.updateDig({
        ...state,
        marker: state.position,
        requiredHits: DIG_REQUIRED_HITS,
        sweetMin: this.dig.sweetMin,
        sweetMax: this.dig.sweetMax
      });
      return;
    }
    if (this.session.state.phase !== "playing" || this.modal || this.resultShown) return;
    const bossState = this.app.world.get(this.karelEntity, "boss");
    if (bossState?.started === true && bossState.defeated !== true) this.boss.update(this.app.world, this.karelEntity, this.playerEntity, dt);
    const available = this.interactions.update(this.app.world, this.playerEntity, input.actions.action?.pressed === true);
    this.availableInteraction = available;
    if (available?.performed) this.performInteraction(available);
  }

  updateObjectives() {
    const objective = this.objectives.update(this.objectiveRuntime());
    if (objective.complete && !this.resultShown) this.showResult();
  }

  updateAnimations(dt) {
    if (this.session.state.phase === "playing" && !this.modal) this.app.animations.update(this.app.world, dt);
    this.visualTime += Math.max(0, Number(dt) || 0);
    const bossState = this.karelEntity === null ? null : this.app.world.get(this.karelEntity, "boss");
    const bossMoving = bossState?.started === true && bossState.defeated !== true;
    updateIdlePulse(this.karelIdleVisual, this.visualTime, bossMoving ? 0 : 1);
    if (this.pickupTween && updatePickupTween(this.pickupTween, dt)) {
      const entity = this.findingEntity;
      if (entity !== null) this.finishPickup(entity);
      else this.pickupTween = null;
    }
    this.updateParticles(dt);
  }

  updateParticles(dt) {
    if (this.dustEmitter) this.dustEmitter.update(dt);
    if (this.sparkleEmitter) this.sparkleEmitter.update(dt);
  }

  updateHud() {
    this.emitHud(false);
  }

  performInteraction(available) {
    const kind = available.interaction.kind;
    if (kind === "talk") this.showGuideDialog();
    else if (kind === "discover") this.discoverTrace(available.entity);
    else if (kind === "dig") this.startDig(available.entity);
    else if (kind === "collect") this.collectHedgehog();
    else if (kind === "recover") this.recoverHedgehog();
  }

  showGuideDialog() {
    const dialogue = getDialogueDefinition("besednice-guide");
    this.modal = "dialog";
    this.app.input.reset("dialog-open");
    this.screens.showDialog({
      name: dialogue.speaker.name,
      avatar: "P",
      text: dialogue.lines.join(" "),
      buttonLabel: dialogue.actionLabel,
      onConfirm: () => {
        this.app.world.get(this.guideEntity, "interaction").enabled = false;
        for (const entity of this.traceEntities) {
          this.app.world.get(entity, "interaction").enabled = true;
          const visual = this.traceVisuals.get(entity);
          if (visual) visual.visible = true;
        }
        this.modal = null;
        this.screens.play();
        this.app.input.reset("dialog-confirm");
        this.emitHud(true);
      }
    });
    if (!dialogue || this.briefingComplete) return false;
    this.modal = "dialog";
    this.app.input.reset("besednice-guide-open");
    this.screens.showDialog({
      name: dialogue.speaker.name,
      avatar: "M",
      text: dialogue.lines.join(" "),
      buttonLabel: dialogue.actionLabel,
      onConfirm: () => {
        this.briefingComplete = true;
        const interaction = this.app.world.get(this.guideEntity, "interaction");
        if (interaction) interaction.enabled = false;
        this.modal = null;
        this.syncLocks();
        this.screens.play();
        this.app.input.reset("besednice-guide-confirm");
        this.emitHud(true);
      }
    });
    return true;
  }

  discoverTrace(entity) {
    if (!this.briefingComplete) return false;
    const clue = this.app.world.get(entity, "clue");
    const interaction = this.app.world.get(entity, "interaction");
    if (!clue || clue.discovered === true) return false;
    clue.discovered = true;
    interaction.enabled = false;
    const visual = this.traceVisuals.get(entity);
    if (visual) visual.visible = false;
    this.availableInteraction = null;
    this.interactions.clear();
    this.syncLocks();
    this.app.input.reset("besednice-trace-discovered");
    this.emitHud(true);
    return true;
  }

  syncLocks() {
    for (const entity of this.traceEntities) {
      const clue = this.app.world.get(entity, "clue");
      const interaction = this.app.world.get(entity, "interaction");
      const enabled = this.briefingComplete && clue?.discovered !== true;
      if (interaction) interaction.enabled = enabled;
      const visual = this.traceVisuals.get(entity);
      if (visual) visual.visible = enabled;
    }
    if (this.hedgehogEntity === null) return;
    const interaction = this.app.world.get(this.hedgehogEntity, "interaction");
    const spot = this.app.world.get(this.hedgehogEntity, "digSpot");
    const unlocked = this.briefingComplete && this.clueCount() >= 3 && spot?.dug !== true;
    if (interaction) interaction.enabled = unlocked;
    const visual = this.renderer.objectByEntity.get(this.hedgehogEntity);
    if (visual) visual.visible = unlocked;
  }

  startDig(entity) {
    if (!this.briefingComplete || entity !== this.hedgehogEntity || this.clueCount() < 3) return false;
    const spot = this.app.world.get(entity, "digSpot");
    if (!spot || spot.dug || this.dig.start(this.externalIdByEntity.get(entity)) !== true) return false;
    this.modal = "dig";
    this.session.setPhase("digging");
    this.app.input.reset("besednice-dig-open");
    this.screens.showDig({
      title: "Ježkový profil: tři zásahy",
      buttonLabel: "AKCE",
      hits: 0,
      marker: 0,
      requiredHits: DIG_REQUIRED_HITS,
      sweetMin: this.dig.sweetMin,
      sweetMax: this.dig.sweetMax,
      onAction: () => this.strikeDig()
    });
    return true;
  }

  async strikeDig() {
    const result = this.dig.strike();
    if (!result) return;
    if (result.hit) this.totalDigHits += 1;
    this.screens.updateDig({
      ...result,
      marker: result.position,
      requiredHits: DIG_REQUIRED_HITS,
      sweetMin: this.dig.sweetMin,
      sweetMax: this.dig.sweetMax,
      info: result.hit ? `Zásah ${result.hits}/${DIG_REQUIRED_HITS}` : "Mimo rytmus — zkus to znovu."
    });
    if (!result.complete) return;
    const spot = this.app.world.get(this.hedgehogEntity, "digSpot");
    spot.digQuality = this.dig.averageQuality();
    spot.perfectDig = this.dig.perfectDig();
    spot.cleanDig = result.hits === DIG_REQUIRED_HITS && result.misses === 0;
    const interaction = this.app.world.get(this.hedgehogEntity, "interaction");
    this.dig.finish();
    spot.dug = true;
    interaction.enabled = false;
    const marker = this.renderer.objectByEntity.get(this.hedgehogEntity);
    if (marker) marker.visible = false;
    await this.spawnFinding(spot.findingId);
    if (spot.cleanDig) this.events.emit("dig:clean", { spot: spot.findingId });
    this.modal = null;
    this.session.setPhase("playing");
    this.availableInteraction = null;
    this.interactions.clear();
    this.screens.play();
    this.app.input.reset("besednice-dig-complete");
    this.emitHud(true);
  }

  async spawnFinding(findingId) {
    if (this.findingEntity !== null) return;
    const profile = this.app.world.get(this.hedgehogEntity, "transform");
    this.findingEntity = this.app.world.createEntity({
      transform: { x: profile.x + 34, y: profile.y + 18, rotation: 0, scale: 1 },
      previousTransform: { x: profile.x + 34, y: profile.y + 18, rotation: 0, scale: 1 },
      interaction: { kind: "collect", label: "SEBRAT JEŽEK", action: "action", range: 76, priority: 95, enabled: true }
    });
    this.externalIdByEntity.set(this.findingEntity, findingId);
    try {
      const mesh = createBesedniceMoldavite(this.THREE);
      this.renderer.bindEntity(this.findingEntity, mesh, "effects");
    } catch (error) {
      console.warn("Procedural moldavite failed, falling back to sprite", error);
      const texture = await this.texture("finding-vltavin-besednice-hedgehog");
      const sprite = this.renderer.createSprite(texture, {
        width: 58, height: 58, z: 15, anchorX: 0.5, anchorY: 0.2, color: 0xb6ff8b,
        assetId: "finding-vltavin-besednice-hedgehog"
      });
      this.renderer.bindEntity(this.findingEntity, sprite, "effects");
    }
  }

  collectHedgehog() {
    if (this.findingEntity === null) return false;
    const spot = this.app.world.get(this.hedgehogEntity, "digSpot") ?? {};
    const quality = spot.digQuality ?? 0;
    const perfect = spot.perfectDig === true;
    const variant = resolveVariant(BESEDNICE_FINDING_VARIANTS, quality, this.rng);
    this.objectives.recordFinding(createFinding(variant, "besednice-hedgehog-1", "besednice", quality, perfect));
    const entity = this.findingEntity;
    this.collectingEntity = entity;
    this.collectingElapsed = 0;
    this.findingEntity = null;
    const moldavite = createProceduralMoldavite(this.THREE, {
      locality: "besednice",
      rarity: "A",
      seed: this.session.state.seed ^ 0x42454649,
      z: 15,
      rotationX: 0.34,
      rotationY: -0.18
    });
    this.renderer.bindEntity(this.findingEntity, moldavite, "effects");
  }

  collectHedgehog() {
    if (this.findingEntity === null || this.pickupTween) return false;
    const entity = this.findingEntity;
    const interaction = this.app.world.get(entity, "interaction");
    if (interaction) interaction.enabled = false;
    const spot = this.app.world.get(this.hedgehogEntity, "digSpot") ?? {};
    const quality = spot.digQuality ?? 0;
    const cleanDig = spot.cleanDig === true;
    const variant = resolveVariant(BESEDNICE_FINDING_VARIANTS, quality, this.rng);
    this.objectives.recordFinding(createFinding(variant, "besednice-hedgehog-1", "besednice", quality, {
      scoreMultiplier: cleanDig ? CLEAN_DIG_SCORE_MULTIPLIER : 1
    }));
    this.boss.start(this.app.world, this.karelEntity);
    const visual = this.renderer.objectByEntity.get(entity);
    this.pickupTween = createPickupTween(visual, { duration: 0.15, targetScale: 1.25 });
    this.availableInteraction = null;
    this.interactions.clear();
    this.app.input.reset("besednice-boss-start");
    this.emitHud(true);
    if (!this.pickupTween) this.finishPickup(entity);
    return true;
  }

  finishPickup(entity) {
    this.renderer.unbindEntity(entity);
    this.app.world.destroyEntity(entity);
    this.externalIdByEntity.delete(entity);
    if (this.findingEntity === entity) this.findingEntity = null;
    this.pickupTween = null;
  }

  recoverHedgehog() {
    const interaction = this.app.world.get(this.karelEntity, "interaction");
    if (interaction?.enabled !== true) return false;
    if (!this.boss.defeat(this.app.world, this.karelEntity)) return false;
    this.availableInteraction = null;
    this.interactions.clear();
    this.app.input.reset("besednice-boss-defeated");
    this.emitHud(true);
    return true;
  }

  clueCount() {
    return this.traceEntities.filter(entity => this.app.world.get(entity, "clue")?.discovered === true).length;
  }

  hasHedgehog() {
    return this.session.state.findings.some(entry => entry.findingId === "besednice-hedgehog-1");
  }

  objectiveRuntime() {
    const boss = this.app.world.get(this.karelEntity, "boss") ?? {};
    return {
      briefingComplete: this.briefingComplete,
      clues: this.clueCount(),
      hedgehog: this.hasHedgehog(),
      bossStarted: boss.started === true,
      bossDefeated: boss.defeated === true
    };
  }

  objectiveSnapshot() {
    return this.objectives.snapshot(this.objectiveRuntime());
  }

  showResult() {
    this.resultShown = true;
    this.session.setPhase("complete");
    this.levelComplete = Object.freeze({ levelId: "besednice", nextLevelId: "slavia", score: this.session.state.score });
    this.app.input.reset("besednice-complete");
    this.screens.showLevelResult({
      kicker: "BESEDNICE DOKONČENA",
      title: "Ježek je zpět ve sbírce",
      text: "Milanovy tři stopy odkryly ježkovou vrstvu a Karel odchází bez cizího nálezu.",
      score: this.session.state.score,
      stats: [
        { label: "STOPY", value: `${this.clueCount()}/3` },
        { label: "KOPÁNÍ", value: `${this.totalDigHits}/${DIG_REQUIRED_HITS}` },
        { label: "JEŽEK", value: this.hasHedgehog() ? "ANO" : "NE" },
        { label: "KAREL", value: this.app.world.get(this.karelEntity, "boss")?.defeated ? "PORAŽEN" : "AKTIVNÍ" }
      ],
      buttonLabel: "POKRAČOVAT DO SLAVIE",
      onContinue: () => this.app.changeScene("slavia").catch(error => console.error("Scene transition:", error))
    });
  }

  pause() {
    this.session.setPhase("paused");
    this.app.input.reset("pause-overlay");
    this.screens.showPause({
      onResume: () => this.resume(),
      onMenu: () => this.app.changeScene("title").catch(error => console.error("Scene transition:", error)),
      placeLabel: this.level.name,
      objective: this.objectiveSnapshot().text,
      progress: this.objectiveSnapshot().progress
    });
    this.emitHud(true);
  }

  resume() {
    this.session.setPhase("playing");
    this.app.input.reset("resume-overlay");
    this.screens.play();
    this.emitHud(true);
  }

  setCameraToPlayer() {
    if (this.playerEntity === null) return;
    const transform = this.app.world.get(this.playerEntity, "transform");
    const zoom = resolveBesedniceV7CameraZoom(
      this.renderer.width,
      this.renderer.height,
      this.renderer.viewHeight,
      this.level.bounds.width
    );
    setBoundedCameraCenter(this.renderer, this.level.bounds, transform.x, transform.y, zoom);
  }

  hudModel() {
    const objective = this.objectiveSnapshot();
    const available = this.availableInteraction;
    let hint = objective.text;
    if (this.session.state.phase === "paused") hint = "Výprava čeká.";
    else if (available) {
      if (available.interaction.kind === "talk") hint = "Místní znalec Milan ti ukáže, jak číst ježkovou vrstvu.";
      else if (available.interaction.kind === "discover") hint = "Prozkoumej stopu v odkryté vrstvě.";
      else if (available.interaction.kind === "dig") hint = "Ježkový profil vyžaduje přesně tři zásahy.";
      else if (available.interaction.kind === "collect") hint = "Vyzvedni kvalitní ježkový vltavín.";
      else if (available.interaction.kind === "recover") hint = "Karel je na dosah — vezmi ježek zpět.";
    }
    const bossState = this.app.world.get(this.karelEntity, "boss") ?? {};
    const bossActive = bossState.started === true && bossState.defeated !== true;
    return {
      missionNumber: this.level.order + 1,
      placeLabel: this.level.name,
      objective: objective.text,
      objectiveProgress: objective.progress,
      findings: this.session.state.findings.length,
      danger: bossActive ? 0.65 : 0,
      dangerMessage: bossActive ? "KAREL MÁ JEŽEK · ZASTAV HO" : "",
      hint,
      actionReady: Boolean(available && !this.modal && this.session.state.phase === "playing"),
      actionLabel: available?.interaction.label ?? "AKCE",
      actionIcon: available?.interaction.kind === "talk" ? "…"
        : available?.interaction.kind === "discover" ? "⌕"
          : available?.interaction.kind === "dig" ? "⛏"
            : available?.interaction.kind === "collect" ? "◆"
              : available?.interaction.kind === "recover" ? "✦" : "◉"
    };
  }

  emitHud(force) {
    const model = this.hudModel();
    const signature = JSON.stringify(model);
    if (!force && signature === this.hudSignature) return;
    this.hudSignature = signature;
    this.events.emit("hud:model:changed", { revision: ++this.hudRevision, model });
  }

  render(alpha) {
    this.renderer.syncWorld(this.app.world, alpha);
  }

  snapshot() {
    const player = this.playerEntity === null ? null : this.app.world.get(this.playerEntity, "transform");
    const boss = this.karelEntity === null ? null : this.boss.snapshot(this.app.world, this.karelEntity);
    const hedgehogSpot = this.hedgehogEntity === null ? null : this.app.world.get(this.hedgehogEntity, "digSpot");
    return {
      level: this.level.id,
      session: this.session.state,
      objective: this.objectiveSnapshot(),
      runtime: {
        modal: this.modal,
        briefingComplete: this.briefingComplete,
        totalDigHits: this.totalDigHits,
        dig: this.dig.snapshot(),
        resultShown: this.resultShown,
        player: player ? { x: player.x, y: player.y } : null,
        clues: this.clueCount(),
        traces: this.traceEntities.map(entity => {
          const clue = this.app.world.get(entity, "clue");
          const interaction = this.app.world.get(entity, "interaction");
          const transform = this.app.world.get(entity, "transform");
          return {
            id: this.externalIdByEntity.get(entity),
            x: transform.x,
            y: transform.y,
            discovered: clue?.discovered === true,
            enabled: interaction?.enabled === true
          };
        }),
        hedgehog: {
          dug: hedgehogSpot?.dug === true,
          cleanDig: hedgehogSpot?.cleanDig === true,
          collected: this.hasHedgehog()
        },
        boss,
        available: this.availableInteraction ? {
          entity: this.externalIdByEntity.get(this.availableInteraction.entity) ?? this.availableInteraction.entity,
          kind: this.availableInteraction.interaction.kind,
          label: this.availableInteraction.interaction.label
        } : null,
        loadedAssets: [...this.assetEntries.keys()].sort(),
        karelIdleScaleY: this.karelIdleVisual?.scale?.y ?? null,
        pickupActive: Boolean(this.pickupTween)
      },
      levelComplete: this.levelComplete
    };
  }

  destroyVisualWorld() {
    if (!this.renderer?.objectByEntity) return;
    if (this.pickupTween) cancelPickupTween(this.pickupTween);
    this.pickupTween = null;
    if (this.dustEmitter) {
      this.renderer.remove(this.dustEmitter.object);
      this.dustEmitter.dispose();
      this.dustEmitter = null;
    }
    if (this.sparkleEmitter) {
      this.renderer.remove(this.sparkleEmitter.object);
      this.sparkleEmitter.dispose();
      this.sparkleEmitter = null;
    }
    for (const entity of [...this.renderer.objectByEntity.keys()]) this.renderer.unbindEntity(entity);
    if (this.visualRoot) {
      this.renderer.remove(this.visualRoot);
      this.renderer.disposeObject(this.visualRoot);
      this.visualRoot = null;
    }
    if (this.foregroundRoot) {
      this.renderer.remove(this.foregroundRoot);
      this.renderer.disposeObject(this.foregroundRoot);
      this.foregroundRoot = null;
    }
    this.karelIdleVisual = null;
    this.visualTime = 0;
  }

  onDigHit(position) {
    if (!this.dustEmitter) return;
    const x = position?.x ?? 0;
    const y = position?.y ?? 0;
    const z = position?.z ?? 4;
    this.dustEmitter.emitBurst(x, y, z, 10, {
      speed: 2.2,
      spread: 0.6,
      lifetime: 0.4,
      size: 2.2
    });
  }

  onDigClean() {
    if (!this.sparkleEmitter) return;
    const transform = this.app.world.get(this.hedgehogEntity, "transform");
    if (!transform) return;
    this.sparkleEmitter.emitBurst(transform.x, transform.y, 6, 18, {
      speed: 3.2,
      spread: 0.8,
      lifetime: 0.5,
      size: 1.8
    });
  }

  unloadAssets() {
    for (const entry of this.assetEntries.values()) this.app.assets.unload(entry.id, entry.type);
    this.loadedModels.clear();
    this.app.assets.unload(MANIFEST_ENTRY.id, MANIFEST_ENTRY.type);
  }

  async exit() {
    this.modal = null;
    this.interactions.clear();
    this.dig.cancel();
    this.app.input.reset("besednice-exit");
    this.destroyVisualWorld();
    this.unloadAssets();
    this.app.world.clear();
    this.app.collisions.reset();
    this.assetEntries.clear();
    this.entityByExternalId.clear();
    this.externalIdByEntity.clear();
    this.traceVisuals.clear();
    this.hudSignature = "";
  }

  async dispose() {
    await this.exit();
  }
}