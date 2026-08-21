import { LEVEL_ORDER, getLevelDefinition } from "../data/levels.js";
import { SLAVIA_DOCUMENT_IDS, SLAVIA_ENTITY_DEFINITIONS } from "../data/slavia.js";
import { InteractionSystem } from "../gameplay/InteractionSystem.js";
import { SlaviaObjectiveFlow } from "../gameplay/SlaviaObjectiveFlow.js";
import { evaluateSlaviaCollection } from "../gameplay/SlaviaEvaluation.js";
import { ModelFactory } from "../render/ModelFactory.js";
import { setBoundedCameraCenter } from "../render/CameraBounds.js";
import { createWaterOverlay } from "../render/WaterOverlay.js";

const MANIFEST_ENTRY = Object.freeze({ id: "slavia-runtime-assets", type: "json", url: "./assets/manifests/assets.json" });
const V7_PLATE_ASSET = "terrain-slavia-event-plate-v7";
const V7_FOREGROUND_ASSET = "foreground-slavia-event-edge-v7";
const cloneData = value => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Czech counted nouns use three forms: 1, 2–4 and 0/5+.
export function czechCount(count, one, few, many) {
  const value = Number.isFinite(Number(count)) ? Math.trunc(Number(count)) : 0;
  const form = Math.abs(value) === 1 ? one : Math.abs(value) >= 2 && Math.abs(value) <= 4 ? few : many;
  return `${value} ${form}`;
}

export function resolveSlaviaV7CameraZoom(viewportWidth, viewportHeight, viewHeight = 720, boundsWidth = 1800) {
  const width = Math.max(1, Number(viewportWidth) || 1);
  const height = Math.max(1, Number(viewportHeight) || 1);
  const safeViewHeight = Math.max(1, Number(viewHeight) || 720);
  const safeBoundsWidth = Math.max(1, Number(boundsWidth) || 1800);
  const fitZoom = (safeViewHeight * (width / height)) / safeBoundsWidth;
  const boundsSafeZoom = Math.ceil(fitZoom * 100) / 100 + 0.01;
  return Math.max(0.9, boundsSafeZoom);
}

export class SlaviaScene {
  constructor(options) {
    this.app = options.app;
    this.events = options.events;
    this.renderer = options.renderer;
    this.THREE = options.three;
    this.screens = options.screens;
    this.session = options.session;
    this.level = getLevelDefinition("slavia");
    this.modelFactory = new ModelFactory({ renderer: this.renderer });
    this.interactions = new InteractionSystem({ events: this.events });
    this.flow = new SlaviaObjectiveFlow();
    this.resetRuntime();
  }

  async enter() {
    this.resetRuntime();
    this.session.enterLevel("slavia");
    await this.loadAssets();
    this.instantiateWorld();
    await this.createVisualWorld();
    this.syncInteractions();
    this.setCameraToPlayer();
    this.screens.showBrief(this.level, LEVEL_ORDER.length, () => this.beginPlaying());
    this.emitHud(true);
  }

  resetRuntime() {
    this.destroyVisualWorld?.();
    this.app?.world?.clear?.();
    this.app?.collisions?.reset?.();
    this.interactions?.clear?.();
    this.flow?.reset?.();
    this.assetEntries = new Map();
    this.loadedModels = new Map();
    this.loadedTextures = new Map();
    this.entityByExternalId = new Map();
    this.externalIdByEntity = new Map();
    this.visualRoot = null;
    this.foregroundRoot = null;
    this.waterOverlay = null;
    this.visualMode = "uninitialized";
    this.cameraZoom = 0.9;
    this.playerEntity = null;
    this.availableInteraction = null;
    this.modal = null;
    this.resultShown = false;
    this.restartPending = false;
    this.evaluation = null;
    this.hudRevision = this.hudRevision ?? 0;
    this.hudSignature = "";
  }

  async loadAssets() {
    const manifest = await this.app.assets.load(MANIFEST_ENTRY);
    if (!Array.isArray(manifest)) throw new Error("Slavia asset manifest must be an array.");
    this.app.assets.setManifest(manifest);
    const selected = this.app.assets.selectPreload(this.level.assetGroups);
    this.assetEntries = new Map(selected.map(entry => [entry.id, entry]));
    const loaded = await this.app.assets.loadAll(selected);
    for (const [id, asset] of loaded) {
      const entry = this.requireAsset(id);
      if (entry.type === "texture" || entry.type === "spritesheet") {
        this.loadedTextures.set(id, this.configureTexture(entry, asset));
      } else if (entry.type === "gltf") {
        asset.userData.assetId = id;
        this.loadedModels.set(id, asset);
      }
    }
  }

  requireAsset(id) {
    const entry = this.assetEntries.get(id);
    if (!entry) throw new Error(`Missing Slavia asset entry: ${id}`);
    return entry;
  }

  configureTexture(_entry, texture) {
    texture.colorSpace = this.THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  texture(id) {
    const texture = this.loadedTextures.get(id);
    if (!texture) throw new Error(`Texture is not loaded: ${id}`);
    return texture;
  }

  model(id) {
    const model = this.loadedModels.get(id);
    if (!model) throw new Error(`Model is not loaded: ${id}`);
    return model;
  }

  instantiateWorld() {
    for (const definition of SLAVIA_ENTITY_DEFINITIONS) {
      const components = cloneData(definition.components);
      components.previousTransform = { ...components.transform };
      const entity = this.app.world.createEntity(components);
      this.entityByExternalId.set(definition.id, entity);
      this.externalIdByEntity.set(entity, definition.id);
    }
    this.playerEntity = this.entityByExternalId.get("player");
    if (!Number.isInteger(this.playerEntity)) throw new Error("Slavia player entity is missing.");
  }

  async createVisualWorld() {
    const THREE = this.THREE;
    const root = new THREE.Group();
    root.name = "slavia-vertical-slice";
    const environmentTexture = this.texture(V7_PLATE_ASSET);
    const ground = this.renderer.createTerrainPlate(environmentTexture, {
      x: this.level.bounds.x,
      y: this.level.bounds.y,
      width: this.level.bounds.width,
      height: this.level.bounds.height,
      z: -12,
      assetId: V7_PLATE_ASSET
    });
    ground.name = "slavia-v7-main-plate";
    this.visualMode = "event-plaza-v7";
    // The authored plate already carries its final daylight; the lights below only
    // serve the 3D props that stay bound to canonical entities.
    const ambient = new THREE.HemisphereLight(0xffedd0, 0x27302a, 1.55);
    const sun = new THREE.DirectionalLight(0xffe6bd, 1.75);
    sun.position.set(-220, 400, 560);
    root.add(ground, ambient, sun);

    const buildingEntity = this.entityByExternalId.get("kd-slavia");
    const building = this.modelFactory.clone(this.model("model-slavia-kd-building"), {
      assetId: "model-slavia-kd-building",
      rotationX: Math.PI / 2,
      scale: 104,
      z: 2
    });
    // The environment plate already contains the detailed, correctly scaled facade.
    // Keep the canonical model bound to the destination entity without covering it.
    building.visible = false;
    this.renderer.bindEntity(buildingEntity, building, "props");

    const playerTexture = this.texture("player-hunter-walk");
    playerTexture.repeat.set(0.25, 0.25);
    playerTexture.offset.set(0, 0.75);
    this.renderer.bindEntity(this.playerEntity, this.renderer.createSprite(playerTexture, {
      width: 82,
      height: 108,
      z: 12,
      anchorX: 0.5,
      anchorY: 0.08,
      assetId: "player-hunter-walk"
    }), "actors");

    for (const [entityId, assetId] of [["expert-eva", "npc-expert-eva"], ["thief-franta", "npc-thief-franta"]]) {
      const entity = this.entityByExternalId.get(entityId);
      const sprite = this.renderer.createSprite(this.texture(assetId), {
        width: 82,
        height: 108,
        z: 12,
        anchorX: 0.5,
        anchorY: 0.08,
        assetId
      });
      this.renderer.bindEntity(entity, sprite, "actors");
    }

    for (const documentId of SLAVIA_DOCUMENT_IDS) {
      const entity = this.entityByExternalId.get(documentId);
      const folder = this.modelFactory.clone(this.model("model-slavia-document-folder"), {
        assetId: "model-slavia-document-folder",
        rotationX: Math.PI / 2,
        scale: 18,
        z: 5
      });
      this.renderer.bindEntity(entity, folder, "props");
    }

    this.visualRoot = root;
    this.renderer.add(root, "ground");

    // Foreground occlusion is its own render layer: crowns and bunting may cover the
    // upper part of actors and create depth without touching collisions or gameplay.
    const foreground = new THREE.Group();
    foreground.name = "slavia-v7-foreground-occlusion";
    const eventEdge = this.renderer.createSprite(this.texture(V7_FOREGROUND_ASSET), {
      x: this.level.bounds.x + this.level.bounds.width / 2,
      y: this.level.bounds.y + this.level.bounds.height / 2,
      z: 30,
      width: this.level.bounds.width,
      height: this.level.bounds.height,
      anchorX: 0.5,
      anchorY: 0.5,
      assetId: V7_FOREGROUND_ASSET
    });
    eventEdge.name = "slavia-v7-event-edge";
    foreground.add(eventEdge);
    this.foregroundRoot = foreground;
    this.renderer.add(foreground, "foreground");

    this.waterOverlay = createWaterOverlay(THREE, this.level.bounds, { opacity: 0.25 });
    this.renderer.add(this.waterOverlay.object, "ground");
  }

  beginPlaying() {
    this.session.setPhase("playing");
    this.screens.play();
    this.app.input.reset("slavia-start");
    this.emitHud(true);
  }

  beginFixed() {
    for (const [, transform, previous] of this.app.world.query("transform", "previousTransform")) Object.assign(previous, transform);
  }

  updateControl(_dt, _time, input) {
    if (!input.actions.pause?.pressed || this.modal || this.resultShown) return;
    if (this.session.state.phase === "playing") this.pause();
    else if (this.session.state.phase === "paused") this.resume();
  }

  updateMovement(dt, _time, input) {
    if (this.session.state.phase !== "playing" || this.modal || this.resultShown) return;
    const transform = this.app.world.get(this.playerEntity, "transform");
    const player = this.app.world.get(this.playerEntity, "player");
    const move = input.axes.move ?? { x: 0, y: 0 };
    const speed = player?.speed ?? 220;
    const walkable = this.level.walkable ?? this.level.bounds;
    transform.x = clamp(transform.x + (move.x ?? 0) * speed * dt, walkable.x + 28, walkable.x + walkable.width - 28);
    transform.y = clamp(transform.y + (move.y ?? 0) * speed * dt, walkable.y + 28, walkable.y + walkable.height - 28);
    this.setCameraToPlayer();
  }

  updateCollisions() {
    if (this.session.state.phase === "playing" && !this.modal) this.app.collisions.update(this.app.world);
  }

  updateGameplay(_dt, _time, input) {
    if (this.session.state.phase !== "playing" || this.modal || this.resultShown) return;
    this.syncInteractions();
    const available = this.interactions.update(this.app.world, this.playerEntity, input.actions.action?.pressed === true);
    this.availableInteraction = available;
    if (available?.performed) this.performInteraction(available);
  }

  updateObjectives() {
    const state = this.flow.snapshot();
    this.session.setObjectiveProgress(this.objectiveProgress(state), state.complete);
    if (state.complete && !this.resultShown) this.showFinalResult();
  }

  updateAnimations(dt) {
    if (this.session.state.phase === "playing" && !this.modal) this.app.animations.update(this.app.world, dt);
    if (this.waterOverlay) this.waterOverlay.update(dt);
  }

  updateHud() {
    this.emitHud(false);
  }

  performInteraction(available) {
    const externalId = this.externalIdByEntity.get(available.entity);
    const kind = available.interaction.kind;
    if (kind === "collect-document") this.collectDocument(externalId, available.entity);
    else if (kind === "register-collection") this.consultExpert();
    else if (kind === "recover-best-finding") this.recoverFinding();
    else if (kind === "receive-certificate") this.receiveCertificate();
    else if (kind === "enter-event") this.enterEvent();
  }

  collectDocument(id, entity) {
    this.flow.collectDocument(id);
    const document = this.app.world.get(entity, "document");
    const interaction = this.app.world.get(entity, "interaction");
    if (document) document.collected = true;
    if (interaction) interaction.enabled = false;
    this.renderer.unbindEntity(entity);
    this.availableInteraction = null;
    this.app.input.reset("slavia-document");
    this.emitHud(true);
  }

  consultExpert() {
    this.flow.consultExpert();
    this.modal = "expert";
    this.app.input.reset("slavia-expert");
    this.screens.showDialog({
      name: "Eva — znalkyně",
      text: "Dokumentace sedí. Franta se ale pokusil odnést nejlepší kus; zastav ho a vrať se pro certifikát.",
      avatar: "EV",
      buttonLabel: "ZASTAVIT FRANTU",
      onConfirm: () => {
        this.modal = null;
        this.screens.play();
        this.syncInteractions();
        this.app.input.reset("slavia-expert-close");
      }
    });
  }

  recoverFinding() {
    this.flow.defeatThief();
    const franta = this.entityByExternalId.get("thief-franta");
    const boss = this.app.world.get(franta, "boss");
    if (boss) {
      boss.started = true;
      boss.defeated = true;
      boss.state = "defeated";
    }
    this.availableInteraction = null;
    this.app.input.reset("slavia-franta-defeated");
    this.emitHud(true);
  }

  receiveCertificate() {
    this.flow.receiveCertificate();
    this.session.setFlag("slaviaCertificate", true);
    this.modal = "certificate";
    this.app.input.reset("slavia-certificate");
    this.screens.showDialog({
      name: "Eva — porota",
      text: "Sbírka je ověřena a může do finálního hodnocení akce Na Zelené Vlně.",
      avatar: "EV",
      buttonLabel: "KE VSTUPU",
      onConfirm: () => {
        this.modal = null;
        this.screens.play();
        this.syncInteractions();
        this.app.input.reset("slavia-certificate-close");
      }
    });
  }

  enterEvent() {
    this.flow.enterEvent();
    const venue = this.entityByExternalId.get("kd-slavia");
    const destination = this.app.world.get(venue, "destination");
    if (destination) destination.entered = true;
    this.evaluation = evaluateSlaviaCollection(this.session.state);
  }

  syncInteractions() {
    const state = this.flow.snapshot();
    for (const documentId of SLAVIA_DOCUMENT_IDS) {
      const entity = this.entityByExternalId.get(documentId);
      const interaction = this.app.world.get(entity, "interaction");
      if (interaction) interaction.enabled = state.phase === "documents" && !state.documents.includes(documentId);
    }
    const eva = this.entityByExternalId.get("expert-eva");
    const evaInteraction = this.app.world.get(eva, "interaction");
    if (evaInteraction) {
      evaInteraction.kind = state.phase === "certification" ? "receive-certificate" : "register-collection";
      evaInteraction.label = state.phase === "certification" ? "CERTIFIKÁT" : "REGISTROVAT";
      evaInteraction.enabled = state.phase === "expert-consultation" || state.phase === "certification";
    }
    const franta = this.entityByExternalId.get("thief-franta");
    const frantaInteraction = this.app.world.get(franta, "interaction");
    if (frantaInteraction) frantaInteraction.enabled = state.phase === "thief-recovery";
    const venue = this.entityByExternalId.get("kd-slavia");
    const venueInteraction = this.app.world.get(venue, "interaction");
    if (venueInteraction) venueInteraction.enabled = state.phase === "event-entry";
  }

  objectiveProgress(state) {
    if (state.complete) return 7;
    if (state.certificateReceived) return 6;
    if (state.thiefDefeated) return 5;
    if (state.expertConsulted) return 4;
    return state.documents.length;
  }

  showFinalResult() {
    this.resultShown = true;
    this.session.setPhase("finale");
    const result = this.evaluation ?? evaluateSlaviaCollection(this.session.state);
    const awardTitle = result.award === "grand-prize"
      ? "Nejlepší sbírka akce"
      : result.award === "jury-recognition"
        ? "Uznání poroty"
        : "Účastnický certifikát";
    this.app.input.reset("slavia-complete");
    this.screens.showLevelResult({
      kicker: "NA ZELENÉ VLNĚ — FINÁLE",
      title: awardTitle,
      text: `Porota vyhodnotila ${czechCount(result.findingCount, "nález", "nálezy", "nálezů")} `
        + `ze ${czechCount(result.localityCount, "lokality", "lokalit", "lokalit")}.`,
      score: result.score,
      stats: [
        { label: "NÁLEZY", value: result.findingCount },
        { label: "LOKALITY", value: result.localityCount },
        { label: "HMOTNOST", value: `${result.totalWeight.toFixed(2)} g` },
        { label: "NEJLEPŠÍ ID", value: result.bestFindingId ?? "—" }
      ],
      buttonLabel: "NOVÁ VÝPRAVA",
      onContinue: () => {
        if (this.restartPending) return;
        this.restartPending = true;
        this.session.reset();
        this.app.changeScene("title").catch(error => console.error("Scene transition:", error));
      }
    });
  }

  pause() {
    this.session.setPhase("paused");
    this.app.input.reset("pause-overlay");
    this.screens.showPause({
      onResume: () => this.resume(),
      onMenu: () => this.app.changeScene("title").catch(error => console.error("Scene transition:", error)),
      placeLabel: this.level.name,
      objective: this.hudModel().objective,
      progress: this.hudModel().objectiveProgress
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
    this.cameraZoom = resolveSlaviaV7CameraZoom(
      this.renderer.width,
      this.renderer.height,
      this.renderer.viewHeight,
      this.level.bounds.width
    );
    setBoundedCameraCenter(this.renderer, this.level.bounds, transform.x, transform.y, this.cameraZoom);
  }

  hudModel() {
    const state = this.flow.snapshot();
    const labels = {
      documents: `Dokumentace ${state.documents.length}/3`,
      "expert-consultation": "Registruj sbírku u Evy",
      "thief-recovery": "Zastav Frantu a získej nález zpět",
      certification: "Vyzvedni certifikát poroty",
      "event-entry": "Vstup do KD Slavia",
      complete: "Finální hodnocení dokončeno"
    };
    return {
      missionNumber: this.level.order + 1,
      placeLabel: this.level.name,
      objective: labels[state.phase],
      objectiveProgress: this.objectiveProgress(state) / 7,
      findings: this.session.state.findings.length,
      danger: state.phase === "thief-recovery" ? 0.7 : 0,
      dangerMessage: state.phase === "thief-recovery" ? "FRANTA ODNÁŠÍ NÁLEZ · ZASTAV HO" : "",
      hint: this.availableInteraction?.interaction.label ?? labels[state.phase],
      actionReady: Boolean(this.availableInteraction && !this.modal && this.session.state.phase === "playing"),
      actionLabel: this.availableInteraction?.interaction.label ?? "AKCE",
      actionIcon: "◆"
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
      level: "slavia",
      session: this.session.state,
      flow: this.flow.snapshot(),
      evaluation: this.evaluation,
      runtime: {
        modal: this.modal,
        visualMode: this.visualMode,
        cameraZoom: this.cameraZoom,
        resultShown: this.resultShown,
        player: player ? { x: player.x, y: player.y } : null,
        available: this.availableInteraction ? {
          entity: this.externalIdByEntity.get(this.availableInteraction.entity),
          kind: this.availableInteraction.interaction.kind
        } : null,
        loadedAssets: [...this.assetEntries.keys()].sort()
      }
    };
  }

  destroyVisualWorld() {
    if (!this.renderer?.objectByEntity) return;
    for (const entity of [...this.renderer.objectByEntity.keys()]) this.renderer.unbindEntity(entity);
    if (this.waterOverlay) {
      this.renderer.remove(this.waterOverlay.object);
      this.waterOverlay.dispose();
      this.waterOverlay = null;
    }
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
  }

  unloadAssets() {
    for (const entry of this.assetEntries.values()) this.app.assets.unload(entry.id, entry.type);
    this.loadedModels.clear();
    this.loadedTextures.clear();
    this.app.assets.unload(MANIFEST_ENTRY.id, MANIFEST_ENTRY.type);
  }

  async exit() {
    this.modal = null;
    this.interactions.clear();
    this.app.input.reset("slavia-exit");
    this.destroyVisualWorld();
    this.unloadAssets();
    this.app.world.clear();
    this.app.collisions.reset();
    this.assetEntries.clear();
    this.entityByExternalId.clear();
    this.externalIdByEntity.clear();
    this.hudSignature = "";
  }

  async dispose() {
    await this.exit();
  }
}
