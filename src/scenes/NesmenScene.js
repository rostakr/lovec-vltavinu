import { DIG_REQUIRED_HITS, LEVEL_ORDER, getLevelDefinition } from "../data/levels.js";
import { NESMEN_ENTITY_DEFINITIONS, NESMEN_PROFILE_IDS, NESMEN_FINDING_VARIANTS } from "../data/nesmen.js";
import { getDialogueDefinition } from "../data/dialogues.js";
import { InteractionSystem } from "../gameplay/InteractionSystem.js";
import { DigSystem } from "../gameplay/DigSystem.js";
import { ObjectiveSystem } from "../gameplay/ObjectiveSystem.js";
import { createRng } from "../gameplay/SessionRng.js";
import { CLEAN_DIG_SCORE_MULTIPLIER, resolveVariant, createFinding } from "../gameplay/FindingResolver.js";
import { ModelFactory } from "../render/ModelFactory.js";
import { setBoundedCameraCenter } from "../render/CameraBounds.js";
import { createProceduralMoldavite } from "../render/ProceduralMoldavite.js";
import { createIdleWrapper, updateIdlePulse, createPickupTween, updatePickupTween, cancelPickupTween } from "../render/VisualEffects.js";
import { createDustEmitter, createSparkleEmitter } from "../render/ParticleSystem.js";

const MANIFEST_ENTRY = Object.freeze({ id: "nesmen-runtime-assets", type: "json", url: "./assets/manifests/assets.json" });
const V7_PLATE_ASSET = "terrain-nesmen-forest-plate-v7";
const V7_FOREGROUND_ASSET = "foreground-nesmen-forest-edge-v7";
const cloneData = value => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const NESMEN_DIG_CONFIG = Object.freeze({ sweetMin: 0.35, sweetMax: 0.65, speed: 1.05 });

export function resolveNesmenV7CameraZoom(viewportWidth, viewportHeight) {
  const width = Math.max(1, Number(viewportWidth) || 1);
  const height = Math.max(1, Number(viewportHeight) || 1);
  const aspect = width / height;
  if (aspect >= 2) return 1.12;
  if (aspect >= 1.5) return 1.04;
  if (aspect <= 0.75) return 0.94;
  return 1;
}

function moldaviteNoise(x, y, z) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

export function createNesmenMoldavite(THREE) {
  if (!THREE?.IcosahedronGeometry || !THREE?.MeshStandardMaterial || !THREE?.Mesh) {
    throw new TypeError("Nesmen moldavite requires Three.js mesh primitives.");
  }

  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const position = geometry.attributes?.position;
  if (!position?.getX || !position?.setXYZ) throw new TypeError("Nesmen moldavite geometry must expose positions.");

  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const radial = 0.8 + moldaviteNoise(x, y, z) * 0.26;
    position.setXYZ(index, x * radial * 1.1, y * radial * 0.88, z * radial * 0.7);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals?.();

  const material = new THREE.MeshStandardMaterial({
    color: 0x2d5a32,
    emissive: 0x0a1f0d,
    emissiveIntensity: 0.2,
    roughness: 0.55,
    metalness: 0.01,
    transparent: true,
    opacity: 0.94
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "nesmen-moldavite-finding";
  mesh.position.z = 14;
  mesh.rotation.x = 0.32;
  mesh.rotation.y = -0.28;
  mesh.scale.set(4.5, 3.8, 2.8);
  mesh.userData.assetId = "procedural-nesmen-moldavite";
  mesh.userData.findingVisual = "moldavite";
  return mesh;
}

export class NesmenScene {
  constructor(options) {
    this.app = options.app;
    this.events = options.events;
    this.renderer = options.renderer;
    this.THREE = options.three;
    this.screens = options.screens;
    this.session = options.session;
    this.level = getLevelDefinition("nesmen");
    this.modelFactory = new ModelFactory({ renderer: this.renderer });
    this.visualRoot = null;
    this.foregroundRoot = null;
    this.foresterIdleVisual = null;
    this.pickupTween = null;
    this.dustEmitter = null;
    this.sparkleEmitter = null;
    this.visualTime = 0;
    this.visualMode = "uninitialized";
    this.assetEntries = new Map();
    this.loadedModels = new Map();
    this.entityByExternalId = new Map();
    this.externalIdByEntity = new Map();
    this.profileVisuals = new Map();
    this.playerEntity = null;
    this.foresterEntity = null;
    this.profileEntities = [];
    this.findingEntity = null;
    this.collectingEntity = null;
    this.collectingElapsed = 0;
    this.activeProfileEntity = null;
    this.availableInteraction = null;
    this.modal = null;
    this.totalDigHits = 0;
    this.rng = null;
    this.resultShown = false;
    this.levelComplete = null;
    this.hudRevision = 0;
    this.hudSignature = "";
    this.npcIdleTime = 0;
    this.interactions = new InteractionSystem({ events: this.events });
    this.dig = new DigSystem({ events: this.events, sweetMin: 0.35, sweetMax: 0.65, speed: 1.1 });
    this.dig = new DigSystem({ events: this.events, ...NESMEN_DIG_CONFIG });
    this.objectives = new ObjectiveSystem({ events: this.events, session: this.session, levelId: "nesmen" });
  }

  async enter() {
    this.resetRuntime();
    this.session.enterLevel(this.level.id);
    await this.loadAssets();
    this.instantiateWorld();
    await this.createVisualWorld();
    this.setCameraToPlayer();
    this.screens.showBrief(this.level, LEVEL_ORDER.length, () => this.beginPlaying());
    this.emitHud(true);
  }

  resetRuntime() {
    this.destroyVisualWorld();
    this.app.world.clear();
    this.app.collisions.reset();
    this.interactions.clear();
    this.dig.cancel();
    this.objectives.reset();
    this.assetEntries.clear();
    this.loadedModels.clear();
    this.entityByExternalId.clear();
    this.externalIdByEntity.clear();
    this.profileVisuals.clear();
    this.playerEntity = null;
    this.foresterEntity = null;
    this.profileEntities = [];
    this.findingEntity = null;
    this.collectingEntity = null;
    this.collectingElapsed = 0;
    this.activeProfileEntity = null;
    this.availableInteraction = null;
    this.modal = null;
    this.totalDigHits = 0;
    this.rng = createRng(this.session.state.seed ^ 0x4E45534D);
    this.resultShown = false;
    this.levelComplete = null;
    this.pickupTween = null;
    this.visualTime = 0;
    this.hudSignature = "";
  }

  async loadAssets() {
    const manifest = await this.app.assets.load(MANIFEST_ENTRY);
    if (!Array.isArray(manifest)) throw new Error("Nesměň asset manifest must be an array.");
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
    if (!entry) throw new Error(`Missing Nesměň asset entry: ${id}`);
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
    for (const definition of NESMEN_ENTITY_DEFINITIONS) {
      const components = cloneData(definition.components);
      components.previousTransform = { ...components.transform };
      const entity = this.app.world.createEntity(components);
      this.entityByExternalId.set(definition.id, entity);
      this.externalIdByEntity.set(entity, definition.id);
    }
    this.playerEntity = this.entityByExternalId.get("player");
    this.foresterEntity = this.entityByExternalId.get("forester");
    this.profileEntities = NESMEN_PROFILE_IDS.map(id => this.entityByExternalId.get(id));
    if (this.profileEntities.some(entity => !Number.isInteger(entity))) throw new Error("Nesměň profile entities are incomplete.");
  }

  async createVisualWorld() {
    const THREE = this.THREE;
    const root = new THREE.Group();
    root.name = "nesmen-vertical-slice";
    const [environmentTexture, foregroundTexture, sandTexture, playerTexture, foresterTexture] = await Promise.all([
      this.texture(V7_PLATE_ASSET),
      this.texture(V7_FOREGROUND_ASSET),
      this.texture("terrain-nesmen-sand-profile"),
      this.texture("player-hunter-walk"),
      this.texture("npc-forester-jan")
    ]);
    sandTexture.repeat.set(2.2, 1.2);

    const ground = this.renderer.createTerrainPlate(environmentTexture, {
      x: this.level.bounds.x,
      y: this.level.bounds.y,
      width: this.level.bounds.width,
      height: this.level.bounds.height,
      z: -12,
      assetId: V7_PLATE_ASSET
    });
    ground.name = "nesmen-v7-main-plate";
    root.add(ground);
    this.visualMode = "layered-forest-v7";

    const ambient = new THREE.HemisphereLight(0xc9e6bb, 0x17251c, 1.8);
    const sun = new THREE.DirectionalLight(0xffefc5, 1.9);
    sun.position.set(-220, 340, 520);
    root.add(ambient, sun);

    this.visualRoot = root;
    this.renderer.add(root, "ground");

    playerTexture.repeat.set(0.25, 0.25);
    playerTexture.offset.set(0, 0.75);
    const player = this.renderer.createSprite(playerTexture, {
      width: 82,
      height: 108,
      z: 12,
      anchorX: 0.5,
      anchorY: 0.08,
      assetId: "player-hunter-walk"
    });
    const forester = this.renderer.createSprite(foresterTexture, {
      width: 82,
      height: 108,
      z: 12,
      anchorX: 0.5,
      anchorY: 0.08,
      assetId: "npc-forester-jan"
    });
    const foresterIdle = createIdleWrapper(THREE, forester, {
      name: "nesmen-v7-forester-idle",
      amplitude: 0.018,
      frequency: 1.5,
      phase: 1.1
    });
    this.foresterIdleVisual = foresterIdle;
    this.renderer.bindEntity(this.playerEntity, player, "actors");
    this.renderer.bindEntity(this.foresterEntity, foresterIdle, "actors");

    for (const entity of this.profileEntities) {
      const group = new THREE.Group();
      group.name = `profile-${this.externalIdByEntity.get(entity)}`;
      const marker = this.modelFactory.clone(this.model("model-nesmen-profile-marker"), {
        assetId: "model-nesmen-profile-marker",
        rotationX: Math.PI / 2,
        scale: 44,
        z: 4
      });
      marker.visible = false;
      const hole = new THREE.Mesh(
        new THREE.CircleGeometry(42, 20),
        new THREE.MeshBasicMaterial({ map: sandTexture, color: 0x6f4b2d, transparent: true, opacity: 0.94 })
      );
      hole.position.z = 2;
      hole.scale.y = 0.62;
      hole.visible = false;
      group.add(hole, marker);
      this.renderer.bindEntity(entity, group, "props");
      this.profileVisuals.set(entity, { group, marker, hole });
    }

    const foreground = new THREE.Group();
    foreground.name = "nesmen-v7-foreground-occlusion";
    const lowerEdge = this.renderer.createSprite(foregroundTexture, {
      x: 1180,
      y: 1080,
      z: 30,
      width: 500,
      height: 333,
      anchorX: 0.5,
      anchorY: 0.08,
      assetId: V7_FOREGROUND_ASSET
    });
    lowerEdge.name = "nesmen-v7-lower-forest-edge";
    foreground.add(lowerEdge);

    const upperEdge = this.renderer.createSprite(foregroundTexture, {
      x: 165,
      y: 500,
      z: 30,
      width: 360,
      height: 240,
      anchorX: 0.5,
      anchorY: 0.08,
      assetId: V7_FOREGROUND_ASSET
    });
    upperEdge.name = "nesmen-v7-upper-forest-edge";
    upperEdge.scale.x *= -1;
    foreground.add(upperEdge);
    this.foregroundRoot = foreground;
    this.renderer.add(foreground, "foreground");

    this.dustEmitter = createDustEmitter(THREE, { color: 0x8B7355 });
    this.renderer.add(this.dustEmitter.object, "effects");
    this.sparkleEmitter = createSparkleEmitter(THREE, { color: 0x2f6038 });
    this.renderer.add(this.sparkleEmitter.object, "effects");

    this.events.on("dig:hit", ({ position }) => this.onDigHit(position));
    this.events.on("dig:clean", () => this.onDigClean());
  }

  beginPlaying() {
    this.session.setPhase("playing");
    this.screens.play();
    this.app.input.reset("nesmen-start");
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
    const available = this.interactions.update(this.app.world, this.playerEntity, input.actions.action?.pressed === true);
    this.availableInteraction = available;
    if (available?.performed) this.performInteraction(available);
  }

  updateObjectives() {
    const objective = this.objectives.update({ dug: this.dugCount(), filled: this.filledCount() });
    if (objective.complete && !this.resultShown) this.showResult();
  }

  updateAnimations(dt) {
    if (this.session.state.phase === "playing" && !this.modal) this.app.animations.update(this.app.world, dt);
    this.updateCollectionAnimation(dt);
    this.updateNpcIdleAnimation(dt);
    this.updateParticles(dt);
  }

  updateParticles(dt) {
    if (this.dustEmitter) this.dustEmitter.update(dt);
    if (this.sparkleEmitter) this.sparkleEmitter.update(dt);
  }

  updateCollectionAnimation(dt) {
    if (this.collectingEntity === null) return;
    this.collectingElapsed += dt;
    const duration = 0.3;
    if (this.collectingElapsed >= duration) {
      this.renderer.unbindEntity(this.collectingEntity);
      this.app.world.destroyEntity(this.collectingEntity);
      this.externalIdByEntity.delete(this.collectingEntity);
      this.collectingEntity = null;
      this.collectingElapsed = 0;
      return;
    }
    const t = this.collectingElapsed / duration;
    const scale = 1 + t * 0.5;
    const visual = this.renderer.getVisual(this.collectingEntity);
    if (visual && visual.material) {
      visual.scale.set(scale, scale, 1);
      visual.material.opacity = Math.max(0, 1 - t);
    }
  }

  updateNpcIdleAnimation(dt) {
    if (!this.foresterEntity || this.session.state.phase !== "playing" || this.modal) return;
    this.npcIdleTime += dt;
    const idleScale = 0.98 + 0.02 * Math.sin(this.npcIdleTime * 2 * Math.PI);
    const visual = this.renderer.getVisual(this.foresterEntity);
    if (visual) visual.scale.set(idleScale, idleScale, 1);
    this.visualTime += Math.max(0, Number(dt) || 0);
    updateIdlePulse(this.foresterIdleVisual, this.visualTime);
    if (this.pickupTween && updatePickupTween(this.pickupTween, dt)) {
      const entity = this.findingEntity;
      if (entity !== null) this.finishPickup(entity);
      else this.pickupTween = null;
    }
  }

  updateHud() {
    this.emitHud(false);
  }

  performInteraction(available) {
    const kind = available.interaction.kind;
    if (kind === "permission") this.showPermissionDialog();
    else if (kind === "dig") this.startDig(available.entity);
    else if (kind === "fill") this.fillProfile(available.entity);
    else if (kind === "collect") this.collectFinding();
  }

  showPermissionDialog() {
    const dialogue = getDialogueDefinition("nesmen-permission");
    this.modal = "dialog";
    this.app.input.reset("dialog-open");
    this.screens.showDialog({
      name: dialogue.speaker.name,
      avatar: "J",
      text: dialogue.lines.join(" "),
      buttonLabel: dialogue.actionLabel,
      onConfirm: () => {
        this.objectives.grantPermission();
        this.app.world.get(this.foresterEntity, "interaction").enabled = false;
        for (const entity of this.profileEntities) {
          this.app.world.get(entity, "interaction").enabled = true;
          const visual = this.profileVisuals.get(entity);
          if (visual) visual.marker.visible = true;
        }
        this.modal = null;
        this.screens.play();
        this.app.input.reset("dialog-confirm");
        this.emitHud(true);
      }
    });
  }

  startDig(entity) {
    const spot = this.app.world.get(entity, "digSpot");
    if (!spot || spot.dug || this.dig.start(this.externalIdByEntity.get(entity)) !== true) return;
    this.activeProfileEntity = entity;
    this.modal = "dig";
    this.session.setPhase("digging");
    this.app.input.reset("dig-open");
    this.screens.showDig({
      title: `Profil ${spot.profileIndex + 1}: tři zásahy`,
      buttonLabel: "AKCE",
      hits: 0,
      marker: 0,
      requiredHits: DIG_REQUIRED_HITS,
      sweetMin: this.dig.sweetMin,
      sweetMax: this.dig.sweetMax,
      onAction: () => this.strikeDig()
    });
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
    if (!result.complete || this.activeProfileEntity === null) return;

    const entity = this.activeProfileEntity;
    const spot = this.app.world.get(entity, "digSpot");
    spot.digQuality = this.dig.averageQuality();
    spot.perfectDig = this.dig.perfectDig();
    spot.cleanDig = result.hits === DIG_REQUIRED_HITS && result.misses === 0;
    const interaction = this.app.world.get(entity, "interaction");
    this.dig.finish();
    spot.dug = true;
    interaction.kind = "fill";
    interaction.label = "ZAHRABAT";
    interaction.enabled = true;
    const visual = this.profileVisuals.get(entity);
    if (visual) {
      visual.marker.visible = false;
      visual.hole.visible = true;
    }
    if (spot.findingId) {
      await this.spawnFinding(entity, spot.findingId, spot.digQuality, spot.perfectDig);
      if (spot.perfectDig) this.events.emit("dig:clean", { spot: spot.findingId });
    }

    this.activeProfileEntity = null;
    this.modal = null;
    this.session.setPhase("playing");
    this.availableInteraction = null;
    this.interactions.clear();
    this.screens.play();
    this.app.input.reset("dig-complete");
    this.emitHud(true);
  }

  fillProfile(entity) {
    const spot = this.app.world.get(entity, "digSpot");
    const interaction = this.app.world.get(entity, "interaction");
    if (!spot?.dug || spot.filled) return;
    spot.filled = true;
    interaction.enabled = false;
    const visual = this.profileVisuals.get(entity);
    if (visual) visual.hole.visible = false;
    this.availableInteraction = null;
    this.interactions.clear();
    this.app.input.reset("profile-filled");
    this.emitHud(true);
  }

  async spawnFinding(profileEntity, findingId, digQuality, perfect) {
    if (this.findingEntity !== null) return;
    const profile = this.app.world.get(profileEntity, "transform");
    this.findingEntity = this.app.world.createEntity({
      transform: { x: profile.x + 30, y: profile.y + 18, rotation: 0, scale: 1 },
      previousTransform: { x: profile.x + 30, y: profile.y + 18, rotation: 0, scale: 1 },
      interaction: { kind: "collect", label: "SEBRAT", action: "action", range: 72, priority: 90, enabled: true },
      findingQuality: { value: digQuality, perfect: perfect === true }
    });
    this.externalIdByEntity.set(this.findingEntity, findingId);
    try {
      const mesh = createNesmenMoldavite(this.THREE);
      this.renderer.bindEntity(this.findingEntity, mesh, "effects");
    } catch (error) {
      console.warn("Procedural moldavite failed, falling back to sprite", error);
      const texture = await this.texture("finding-vltavin-nesmen");
      if (this.findingEntity === null) return;
      const sprite = this.renderer.createSprite(texture, {
        width: 50,
        height: 50,
        z: 14,
        anchorX: 0.5,
        anchorY: 0.2,
        assetId: "finding-vltavin-nesmen"
      });
      this.renderer.bindEntity(this.findingEntity, sprite, "effects");
    }
    const moldavite = createProceduralMoldavite(this.THREE, {
      locality: "nesmen",
      rarity: "B",
      seed: this.session.state.seed ^ 0x4e534649,
      rotationX: 0.22,
      rotationY: -0.24
    });
    this.renderer.bindEntity(this.findingEntity, moldavite, "effects");
  }

  collectFinding() {
    if (this.findingEntity === null || this.pickupTween) return;
    const entity = this.findingEntity;
    const fq = this.app.world.get(entity, "findingQuality") ?? {};
    const quality = fq.value ?? 0;
    const perfect = fq.perfect === true;
    const variant = resolveVariant(NESMEN_FINDING_VARIANTS, quality, this.rng);
    this.objectives.recordFinding(createFinding(variant, "nesmen-finding-1", "nesmen", quality, { perfect }));
    this.collectingEntity = entity;
    this.collectingElapsed = 0;
    this.findingEntity = null;
    const interaction = this.app.world.get(entity, "interaction");
    if (interaction) interaction.enabled = false;
    const visual = this.renderer.objectByEntity.get(entity);
    this.pickupTween = createPickupTween(visual, { duration: 0.15, targetScale: 1.25 });
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

  dugCount() {
    return this.profileEntities.filter(entity => this.app.world.get(entity, "digSpot")?.dug === true).length;
  }

  filledCount() {
    return this.profileEntities.filter(entity => this.app.world.get(entity, "digSpot")?.filled === true).length;
  }

  showResult() {
    this.resultShown = true;
    this.session.setPhase("complete");
    this.levelComplete = Object.freeze({ levelId: "nesmen", nextLevelId: "besednice", score: this.session.state.score });
    this.app.input.reset("nesmen-complete");
    this.screens.showLevelResult({
      kicker: "NESMĚŇ DOKONČENA",
      title: "V lese nezůstala jediná díra",
      text: "Tři profily jsou prohlédnuté, nález je zaznamenaný a les je vrácený do původního stavu.",
      score: this.session.state.score,
      stats: [
        { label: "POVOLENÍ", value: "ANO" },
        { label: "PROFILY", value: `${this.dugCount()}/3` },
        { label: "ZASYPÁNO", value: `${this.filledCount()}/3` },
        { label: "NÁLEZY", value: this.session.state.findings.filter(entry => entry.locality === "nesmen").length }
      ],
      buttonLabel: "ZPĚT DO MENU",
      onContinue: () => this.app.changeScene("title").catch(error => console.error("Scene transition:", error))
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
    const zoom = resolveNesmenV7CameraZoom(this.renderer.width, this.renderer.height);
    setBoundedCameraCenter(this.renderer, this.level.bounds, transform.x, transform.y, zoom, {
      deadZoneRatio: 0.06,
      damping: 0.18,
      snapDistanceRatio: 0.55
    });
  }

  objectiveSnapshot() {
    return this.objectives.snapshot({ dug: this.dugCount(), filled: this.filledCount() });
  }

  hudModel() {
    const objective = this.objectiveSnapshot();
    const available = this.availableInteraction;
    let hint = objective.text;
    if (this.session.state.phase === "paused") hint = "Výprava čeká.";
    else if (available) {
      if (available.interaction.kind === "permission") hint = "Lesník Jan vysvětlí pravidla průzkumu.";
      else if (available.interaction.kind === "dig") hint = "Odkryj vyznačený profil třemi zásahy.";
      else if (available.interaction.kind === "fill") hint = "Zasyp odkrytou díru.";
      else if (available.interaction.kind === "collect") hint = "Vltavín leží vedle profilu.";
    }
    return {
      missionNumber: this.level.order + 1,
      placeLabel: this.level.name,
      objective: objective.text,
      objectiveProgress: objective.progress,
      findings: this.session.state.findings.length,
      danger: 0,
      dangerMessage: "",
      hint,
      actionReady: Boolean(available && !this.modal && this.session.state.phase === "playing"),
      actionLabel: available?.interaction.label ?? "AKCE",
      actionIcon: available?.interaction.kind === "permission"
        ? "…"
        : available?.interaction.kind === "dig"
          ? "⛏"
          : available?.interaction.kind === "fill"
            ? "●"
            : available?.interaction.kind === "collect" ? "◆" : "◉"
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
    return {
      level: this.level.id,
      session: this.session.state,
      objective: this.objectiveSnapshot(),
      runtime: {
        modal: this.modal,
        totalDigHits: this.totalDigHits,
        dig: this.dig.snapshot(),
        resultShown: this.resultShown,
        player: player ? { x: player.x, y: player.y } : null,
        profiles: this.profileEntities.map(entity => {
          const spot = this.app.world.get(entity, "digSpot");
          const transform = this.app.world.get(entity, "transform");
          return {
            id: this.externalIdByEntity.get(entity),
            x: transform.x,
            y: transform.y,
            dug: spot.dug === true,
            filled: spot.filled === true,
            cleanDig: spot.cleanDig === true
          };
        }),
        available: this.availableInteraction ? {
          entity: this.externalIdByEntity.get(this.availableInteraction.entity) ?? this.availableInteraction.entity,
          kind: this.availableInteraction.interaction.kind,
          label: this.availableInteraction.interaction.label
        } : null,
        loadedAssets: [...this.assetEntries.keys()].sort(),
        visualMode: this.visualMode,
        cameraZoom: this.renderer.camera?.zoom ?? null,
        foresterIdleScaleY: this.foresterIdleVisual?.scale?.y ?? null,
        pickupActive: Boolean(this.pickupTween)
      },
      levelComplete: this.levelComplete
    };
  }

  destroyVisualWorld() {
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
    this.foresterIdleVisual = null;
    this.visualTime = 0;
    this.visualMode = "uninitialized";
  }

  unloadAssets() {
    for (const entry of this.assetEntries.values()) this.app.assets.unload(entry.id, entry.type);
    this.loadedModels.clear();
    this.app.assets.unload(MANIFEST_ENTRY.id, MANIFEST_ENTRY.type);
  }

  onDigHit(position) {
    if (!this.dustEmitter) return;
    const x = position?.x ?? 0;
    const y = position?.y ?? 0;
    const z = position?.z ?? 4;
    this.dustEmitter.emitBurst(x, y, z, 12, {
      speed: 2.5,
      spread: 0.7,
      lifetime: 0.35,
      size: 2
    });
  }

  onDigClean() {
    if (!this.sparkleEmitter) return;
    const activeEntity = this.activeProfileEntity;
    if (!activeEntity) return;
    const transform = this.app.world.get(activeEntity, "transform");
    if (!transform) return;
    this.sparkleEmitter.emitBurst(transform.x, transform.y, 6, 15, {
      speed: 3,
      spread: 0.8,
      lifetime: 0.45,
      size: 1.5
    });
  }

  async exit() {
    this.modal = null;
    this.interactions.clear();
    this.dig.cancel();
    this.app.input.reset("nesmen-exit");
    this.destroyVisualWorld();
    this.unloadAssets();
    this.app.world.clear();
    this.app.collisions.reset();
    this.assetEntries.clear();
    this.entityByExternalId.clear();
    this.externalIdByEntity.clear();
    this.profileVisuals.clear();
    this.hudSignature = "";
  }

  async dispose() {
    await this.exit();
  }
}