import { LEVEL_ORDER, getLevelDefinition } from "../data/levels.js";
import { CHLUM_ENTITY_DEFINITIONS, CHLUM_FINDING_VARIANTS } from "../data/chlum.js";
import { getDialogueDefinition } from "../data/dialogues.js";
import { InteractionSystem } from "../gameplay/InteractionSystem.js";
import { DangerSystem } from "../gameplay/DangerSystem.js";
import { ObjectiveSystem } from "../gameplay/ObjectiveSystem.js";
import { createRng } from "../gameplay/SessionRng.js";
import { resolveVariant, createFinding } from "../gameplay/FindingResolver.js";
import { ModelFactory } from "../render/ModelFactory.js";
import { setBoundedCameraCenter } from "../render/CameraBounds.js";

const MANIFEST_ENTRY = Object.freeze({ id: "chlum-runtime-assets", type: "json", url: "./assets/manifests/assets.json" });
const cloneData = value => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class ChlumScene {
  constructor(options) {
    this.app = options.app;
    this.events = options.events;
    this.renderer = options.renderer;
    this.THREE = options.three;
    this.screens = options.screens;
    this.session = options.session;
    this.level = getLevelDefinition("chlum");
    this.modelFactory = new ModelFactory({ renderer: this.renderer });
    this.visualRoot = null;
    this.assetEntries = new Map();
    this.loadedTextureIds = new Set();
    this.loadedModelIds = new Set();
    this.loadedModels = new Map();
    this.entityByExternalId = new Map();
    this.externalIdByEntity = new Map();
    this.playerEntity = null;
    this.farmerEntity = null;
    this.searchEntity = null;
    this.tractorEntity = null;
    this.findingEntity = null;
    this.availableInteraction = null;
    this.collisions = [];
    this.modal = null;
    this.surfaceSearched = false;
    this.radarEnabled = false;
    this.radarPulseCount = 0;
    this.radarMessage = "";
    this.rng = null;
    this.resultShown = false;
    this.levelComplete = null;
    this.hudRevision = 0;
    this.hudSignature = "";
    this.npcIdleTime = 0;
    this.interactions = new InteractionSystem({ events: this.events });
    this.danger = new DangerSystem({ events: this.events, session: this.session });
    this.objectives = new ObjectiveSystem({ events: this.events, session: this.session, levelId: "chlum" });
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
    this.danger.reset();
    this.objectives.reset();
    this.assetEntries.clear();
    this.loadedTextureIds.clear();
    this.loadedModelIds.clear();
    this.loadedModels.clear();
    this.entityByExternalId.clear();
    this.externalIdByEntity.clear();
    this.playerEntity = null;
    this.farmerEntity = null;
    this.searchEntity = null;
    this.tractorEntity = null;
    this.findingEntity = null;
    this.availableInteraction = null;
    this.collisions = [];
    this.modal = null;
    this.surfaceSearched = false;
    this.radarEnabled = false;
    this.radarPulseCount = 0;
    this.radarMessage = "";
    this.rng = createRng(this.session.state.seed ^ 0x43484C4D);
    this.resultShown = false;
    this.levelComplete = null;
    this.hudSignature = "";
  }

  async loadAssets() {
    const manifest = await this.app.assets.load(MANIFEST_ENTRY);
    if (!Array.isArray(manifest)) throw new Error("Chlum asset manifest must be an array.");
    this.app.assets.setManifest(manifest);
    const selected = this.app.assets.selectPreload(this.level.assetGroups);
    this.assetEntries = new Map(selected.map(entry => [entry.id, entry]));
    const loaded = await this.app.assets.loadAll(selected);
    for (const [id, asset] of loaded) {
      const entry = this.requireAsset(id);
      if (entry.type === "texture" || entry.type === "spritesheet") {
        this.configureTexture(entry, asset);
        this.loadedTextureIds.add(id);
      } else if (entry.type === "gltf") {
        asset.userData.assetId = id;
        this.loadedModelIds.add(id);
        this.loadedModels.set(id, asset);
      }
    }
  }

  requireAsset(id) {
    const entry = this.assetEntries.get(id);
    if (!entry) throw new Error(`Missing Chlum asset entry: ${id}`);
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

  texture(id) {
    const entry = this.requireAsset(id);
    if (entry.type !== "texture" && entry.type !== "spritesheet") throw new Error(`Asset ${id} is not a texture.`);
    const texture = this.app.assets.get(id, entry.type);
    if (!texture) throw new Error(`Texture is not loaded: ${id}`);
    return texture;
  }
  model(id) {
    const model = this.loadedModels.get(id);
    if (!model) throw new Error(`Model is not loaded: ${id}`);
    return model;
  }

  instantiateWorld() {
    for (const definition of CHLUM_ENTITY_DEFINITIONS) {
      const components = cloneData(definition.components);
      components.previousTransform = { ...components.transform };
      const entity = this.app.world.createEntity(components);
      this.entityByExternalId.set(definition.id, entity);
      this.externalIdByEntity.set(entity, definition.id);
    }
    this.playerEntity = this.entityByExternalId.get("player");
    this.farmerEntity = this.entityByExternalId.get("farmer-vaclav");
    this.searchEntity = this.entityByExternalId.get("chlum-search-site");
    this.tractorEntity = this.entityByExternalId.get("tractor");
  }

  async createVisualWorld() {
    const THREE = this.THREE;
    const root = new THREE.Group();
    root.name = "chlum-vertical-slice";
    const [fieldTexture, furrowTexture, playerTexture, farmerTexture] = await Promise.all([
      this.texture("terrain-chlum-field"),
      this.texture("terrain-chlum-furrows"),
      this.texture("player-hunter-walk"),
      this.texture("npc-farmer-vaclav")
    ]);
    fieldTexture.repeat.set(2.4, 1.8);
    furrowTexture.repeat.set(3.2, 2.1);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(this.level.bounds.width, this.level.bounds.height), new THREE.MeshBasicMaterial({ map: fieldTexture }));
    ground.position.set(this.level.bounds.x + this.level.bounds.width / 2, this.level.bounds.y + this.level.bounds.height / 2, -4);
    root.add(ground);
    const furrows = new THREE.Mesh(new THREE.PlaneGeometry(this.level.bounds.width * 0.96, this.level.bounds.height * 0.86), new THREE.MeshBasicMaterial({ map: furrowTexture, transparent: true, opacity: 0.34, depthWrite: false }));
    furrows.position.set(800, 620, -3);
    root.add(furrows);
    const light = new THREE.HemisphereLight(0xfff4d0, 0x28402d, 2.2);
    const sun = new THREE.DirectionalLight(0xffe0a0, 2.6);
    sun.position.set(-240, 360, 480);
    root.add(light, sun);
    this.addDecorModel(root, "model-chlum-field-fence-segment", { x: 310, y: 300, scale: 58 });
    this.addDecorModel(root, "model-chlum-field-fence-segment", { x: 570, y: 300, scale: 58 });
    this.addDecorModel(root, "model-chlum-hay-bale", { x: 1270, y: 930, scale: 52, rotationZ: 0.4 });
    this.addDecorModel(root, "model-chlum-hay-bale", { x: 1360, y: 860, scale: 44, rotationZ: -0.25 });
    this.visualRoot = root;
    this.renderer.add(root, "ground");
    playerTexture.repeat.set(0.25, 0.25);
    playerTexture.offset.set(0, 0.75);
    const player = this.renderer.createSprite(playerTexture, { width: 82, height: 108, z: 12, anchorX: 0.5, anchorY: 0.08, assetId: "player-hunter-walk" });
    const farmer = this.renderer.createSprite(farmerTexture, { width: 82, height: 108, z: 12, anchorX: 0.5, anchorY: 0.08, assetId: "npc-farmer-vaclav" });
    this.renderer.bindEntity(this.playerEntity, player, "actors");
    this.renderer.bindEntity(this.farmerEntity, farmer, "actors");
    const marker = this.modelFactory.bind(this.searchEntity, this.model("model-chlum-field-marker"), { assetId: "model-chlum-field-marker", layer: "props", rotationX: Math.PI / 2, scale: 48, z: 3 });
    marker.visible = false;
    this.modelFactory.bind(this.tractorEntity, this.model("model-chlum-tractor-no-driver"), { assetId: "model-chlum-tractor-no-driver", layer: "actors", rotationX: Math.PI / 2, scale: 44, z: 8 });
  }

  addDecorModel(root, id, options) {
    root.add(this.modelFactory.clone(this.model(id), {
      assetId: id,
      x: options.x,
      y: options.y,
      z: options.z ?? 1,
      rotationX: Math.PI / 2,
      rotationZ: options.rotationZ ?? 0,
      scale: options.scale ?? 40
    }));
  }

  beginPlaying() {
    this.session.setPhase("playing");
    this.screens.play();
    this.app.input.reset("chlum-start");
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
    const tractor = this.app.world.get(this.tractorEntity, "transform");
    const patrol = this.app.world.get(this.tractorEntity, "patrol");
    tractor[patrol.axis] += patrol.direction * patrol.speed * dt;
    if (tractor[patrol.axis] >= patrol.max) { tractor[patrol.axis] = patrol.max; patrol.direction = -1; }
    else if (tractor[patrol.axis] <= patrol.min) { tractor[patrol.axis] = patrol.min; patrol.direction = 1; }
    tractor.rotation = patrol.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.setCameraToPlayer();
  }

  updateCollisions() {
    this.collisions = this.session.state.phase === "playing" && !this.modal ? this.app.collisions.update(this.app.world) : [];
  }

  updateGameplay(dt, _time, input) {
    if (this.session.state.phase !== "playing" || this.modal || this.resultShown) return;
    const danger = this.danger.update(this.app.world, this.playerEntity, this.collisions, dt);
    if (danger.caught) {
      const player = this.app.world.get(this.playerEntity, "transform");
      const previous = this.app.world.get(this.playerEntity, "previousTransform");
      Object.assign(player, this.level.spawn);
      Object.assign(previous, player);
      this.app.input.reset("tractor-caught");
      this.availableInteraction = null;
      this.interactions.clear();
      this.setCameraToPlayer();
      this.emitHud(true);
      return;
    }
    const available = this.interactions.update(this.app.world, this.playerEntity, input.actions.action?.pressed === true);
    this.availableInteraction = available;
    if (available?.performed) this.performInteraction(available);
    else if (input.actions.action?.pressed === true && this.radarEnabled && !this.surfaceSearched) this.activateRadar();
  }

  updateObjectives() {
    const objective = this.objectives.update({ searched: this.surfaceSearched });
    if (objective.complete && !this.resultShown) this.showResult();
  }

  updateAnimations(dt) {
    if (this.session.state.phase === "playing" && !this.modal) this.app.animations.update(this.app.world, dt);
    this.updateNpcIdleAnimation(dt);
  }

  updateNpcIdleAnimation(dt) {
    if (!this.farmerEntity || this.session.state.phase !== "playing" || this.modal) return;
    this.npcIdleTime += dt;
    const idleScale = 0.98 + 0.02 * Math.sin(this.npcIdleTime * 2 * Math.PI);
    const visual = this.renderer.getVisual(this.farmerEntity);
    if (visual) visual.scale.set(idleScale, idleScale, 1);
  }

  updateHud() { this.emitHud(false); }

  performInteraction(available) {
    if (available.interaction.kind === "permission") this.showPermissionDialog();
    else if (available.interaction.kind === "collect") this.collectFinding();
  }

  showPermissionDialog() {
    const dialogue = getDialogueDefinition("chlum-permission");
    this.modal = "dialog";
    this.app.input.reset("dialog-open");
    this.screens.showDialog({
      name: dialogue.speaker.name,
      avatar: "V",
      text: dialogue.lines.join(" "),
      buttonLabel: dialogue.actionLabel,
      onConfirm: () => {
        this.objectives.grantPermission();
        this.app.world.get(this.farmerEntity, "interaction").enabled = false;
        this.radarEnabled = true;
        this.radarMessage = "Radar je připravený. Stiskni AKCI a sleduj sílu signálu.";
        this.modal = null;
        this.screens.play();
        this.app.input.reset("dialog-confirm");
        this.emitHud(true);
      }
    });
  }

  activateRadar() {
    if (!this.radarEnabled || this.surfaceSearched) return;
    const player = this.app.world.get(this.playerEntity, "transform");
    const searchTransform = this.app.world.get(this.searchEntity, "transform");
    const searchSpot = this.app.world.get(this.searchEntity, "searchSpot");
    const distance = Math.hypot(player.x - searchTransform.x, player.y - searchTransform.y);
    this.radarPulseCount += 1;
    if (distance > searchSpot.detectionRange) {
      this.radarMessage = distance <= 480
        ? "Radar: silný signál. Vltavín je velmi blízko."
        : distance <= 760
          ? "Radar: slabý signál. Pokračuj v hledání po poli."
          : "Radar: bez signálu. Přesuň se dál od okraje pole.";
      this.app.input.reset("radar-pulse");
      this.emitHud(true);
      return;
    }
    this.surfaceSearched = true;
    this.radarEnabled = false;
    searchSpot.searched = true;
    this.radarMessage = "Radar odhalil vltavín. Přibliž se a stiskni SEBRAT.";
    this.spawnFinding();
    this.availableInteraction = null;
    this.interactions.clear();
    this.app.input.reset("surface-searched");
    this.emitHud(true);
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
    this.texture("finding-vltavin-standard").then(texture => {
      if (this.findingEntity === null) return;
      const sprite = this.renderer.createSprite(texture, { width: 48, height: 48, z: 14, anchorX: 0.5, anchorY: 0.2, assetId: "finding-vltavin-standard" });
      this.renderer.bindEntity(this.findingEntity, sprite, "effects");
    });
  }

  collectFinding() {
    if (this.findingEntity === null) return;
    const entity = this.findingEntity;
    const surfaceQuality = this.rng();
    const variant = resolveVariant(CHLUM_FINDING_VARIANTS, surfaceQuality, this.rng);
    this.objectives.recordFinding(createFinding(variant, "chlum-finding-1", "chlum", surfaceQuality));
    this.renderer.unbindEntity(entity);
    this.app.world.destroyEntity(entity);
    this.externalIdByEntity.delete(entity);
    this.findingEntity = null;
    this.radarMessage = "Vltavín byl bezpečně sebrán.";
    this.availableInteraction = null;
    this.interactions.clear();
    this.app.input.reset("finding-collected");
    this.emitHud(true);
  }

  showResult() {
    this.resultShown = true;
    this.session.setPhase("complete");
    this.levelComplete = Object.freeze({ levelId: "chlum", nextLevelId: "nesmen", score: this.session.state.score });
    this.app.input.reset("chlum-complete");
    this.screens.showLevelResult({
      kicker: "CHLUM DOKONČEN",
      title: "První vltavín je v bezpečí",
      text: "Václavovo povolení platí a nález je připravený pro další cestu. Nesměň bude zapojena v samostatném balíku.",
      score: this.session.state.score,
      stats: [
        { label: "POVOLENÍ", value: "ANO" },
        { label: "RADAR", value: `${this.radarPulseCount}×` },
        { label: "NÁLEZY", value: this.session.state.findings.length }
      ],
      buttonLabel: "ZPĚT DO MENU",
      onContinue: () => this.app.changeScene("title").catch(error => console.error("Scene transition:", error))
    });
  }

  pause() {
    this.session.setPhase("paused");
    this.app.input.reset("pause-overlay");
    const hud = this.hudModel();
    this.screens.showPause({ onResume: () => this.resume(), onMenu: () => this.app.changeScene("title").catch(error => console.error("Scene transition:", error)), placeLabel: hud.placeLabel, objective: hud.objective, progress: hud.objectiveProgress });
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
    setBoundedCameraCenter(this.renderer, this.level.bounds, transform.x, transform.y, 0.92);
  }

  objectiveSnapshot() { return this.objectives.snapshot({ searched: this.surfaceSearched }); }

  hudModel() {
    const objective = this.objectiveSnapshot();
    const available = this.availableInteraction;
    const danger = this.session.state.danger / 100;
    let hint = this.radarMessage || objective.text;
    if (this.session.state.phase === "paused") hint = "Výprava čeká.";
    else if (available) hint = available.interaction.label === "MLUVIT" ? "Václav ti může dát povolení." : "Vltavín leží na povrchu.";
    return {
      missionNumber: this.level.order + 1,
      placeLabel: this.level.name,
      objective: objective.text,
      objectiveProgress: objective.progress,
      findings: this.session.state.findings.length,
      danger,
      dangerMessage: danger >= 0.75 ? "TRAKTOR JE BLÍZKO · OBEJDI HO" : "",
      hint,
      actionReady: Boolean((available || this.radarEnabled) && !this.modal && this.session.state.phase === "playing"),
      actionLabel: available?.interaction.label ?? (this.radarEnabled ? "RADAR" : "AKCE"),
      actionIcon: available?.interaction.kind === "permission" ? "…" : available?.interaction.kind === "collect" ? "◆" : this.radarEnabled ? "⌕" : "◉"
    };
  }

  emitHud(force) {
    const model = this.hudModel();
    const signature = JSON.stringify(model);
    if (!force && signature === this.hudSignature) return;
    this.hudSignature = signature;
    this.events.emit("hud:model:changed", { revision: ++this.hudRevision, model });
  }

  render(alpha) { this.renderer.syncWorld(this.app.world, alpha); }

  snapshot() {
    const player = this.playerEntity === null ? null : this.app.world.get(this.playerEntity, "transform");
    const tractor = this.tractorEntity === null ? null : this.app.world.get(this.tractorEntity, "transform");
    return {
      level: this.level.id,
      session: this.session.state,
      objective: this.objectiveSnapshot(),
      runtime: {
        modal: this.modal,
        searched: this.surfaceSearched,
        radar: { enabled: this.radarEnabled, pulses: this.radarPulseCount, message: this.radarMessage },
        resultShown: this.resultShown,
        player: player ? { x: player.x, y: player.y } : null,
        tractor: tractor ? { x: tractor.x, y: tractor.y } : null,
        available: this.availableInteraction ? { entity: this.externalIdByEntity.get(this.availableInteraction.entity) ?? this.availableInteraction.entity, kind: this.availableInteraction.interaction.kind, label: this.availableInteraction.interaction.label } : null,
        loadedAssets: [...this.assetEntries.keys()].sort()
      },
      levelComplete: this.levelComplete
    };
  }

  destroyVisualWorld() {
    for (const entity of [...this.renderer.objectByEntity.keys()]) this.renderer.unbindEntity(entity);
    if (this.visualRoot) {
      this.renderer.remove(this.visualRoot);
      this.renderer.disposeObject(this.visualRoot);
      this.visualRoot = null;
    }
  }

  unloadAssets() {
    for (const id of this.loadedTextureIds) this.app.assets.unload(id, "texture", texture => texture?.dispose?.());
    for (const id of this.loadedModelIds) this.app.assets.unload(id, "gltf", model => this.renderer.disposeObject(model));
    this.loadedTextureIds.clear();
    this.loadedModelIds.clear();
    this.loadedModels.clear();
    this.app.assets.unload(MANIFEST_ENTRY.id, MANIFEST_ENTRY.type);
  }

  async exit() {
    this.modal = null;
    this.interactions.clear();
    this.danger.reset();
    this.app.input.reset("chlum-exit");
    this.destroyVisualWorld();
    this.unloadAssets();
    this.app.world.clear();
    this.app.collisions.reset();
    this.assetEntries.clear();
    this.entityByExternalId.clear();
    this.externalIdByEntity.clear();
    this.hudSignature = "";
  }

  async dispose() { await this.exit(); }
}
