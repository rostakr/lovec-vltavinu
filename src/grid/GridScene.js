import { TileGrid } from "./TileGrid.js";
import { IsometricRenderer } from "./IsometricRenderer.js";
import { GridSceneVisuals } from "./GridSceneVisuals.js";
import { getGridLevel, getSpawnPoint, gridSizeToWorldBounds } from "./GridLevels.js";
import { TILE_SIZE } from "./TileDefinitions.js";
import { gameplayMechanics } from "../gameplay/GameplayMechanics.js";
import { EnvironmentTheme } from "../render/EnvironmentTheme.js";
import { DigMechanics, createDigSite } from "../gameplay/DigMechanics.js";
import { DialogueSystem } from "../gameplay/DialogueSystem.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class GridScene {
  constructor(options) {
    this.app = options.app;
    this.events = options.events;
    this.renderer = options.renderer;
    this.THREE = options.three;
    this.screens = options.screens;
    this.session = options.session;
    this.levelId = options.levelId ?? "chlum";
    this.resetRuntime();
  }

  resetRuntime() {
    this.grid = null;
    this.isometricRenderer = null;
    this.visuals = null;
    this.visualRoot = null;
    this.playerGridX = 0;
    this.playerGridY = 0;
    this.playerMesh = null;
    this.playerDirection = 4;
    this.entities = new Map();
    this.npcs = new Map();
    this.digSites = new Map();
    this.documents = new Map();
    this.modal = null;
    this.resultShown = false;
    this.levelStartTime = null;
    this.levelFindings = [];
    this.environmentTheme = new EnvironmentTheme(this.THREE);
    this.digMechanics = new DigMechanics({ rng: () => Math.random() });
    this.dialogueSystem = new DialogueSystem();
    this.currentScore = 0;
    this.digSitesCompleted = new Set();
  }

  async enter() {
    this.resetRuntime();
    this.session.enterLevel(this.levelId);
    this.grid = getGridLevel(this.levelId);
    if (!this.grid) throw new Error(`Unknown level: ${this.levelId}`);

    this.instantiateWorld();
    this.createVisualWorld();
    this.setCameraToPlayer();
    this.levelStartTime = Date.now();

    const levelDef = gameplayMechanics.getLevelDefinition(this.levelId) || {};
    this.screens.showBrief(
      {
        title: levelDef.name || `Úroveň ${this.levelId}`,
        goal: levelDef.description || "Splň cíl úrovně"
      },
      4,
      () => this.beginPlaying()
    );
  }

  instantiateWorld() {
    const worldEntity = this.app.world.create();
    this.app.world.set(worldEntity, "transform", {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0
    });

    const spawn = getSpawnPoint(this.levelId);
    this.playerGridX = spawn.gridX;
    this.playerGridY = spawn.gridY;

    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        const meta = this.grid.metadata.get(`${x},${y}`);
        if (!meta) continue;

        const entity = this.app.world.create();
        this.entities.set(`${x},${y}`, entity);

        if (meta.type === "npc") {
          this.npcs.set(meta.npc, { entity, gridX: x, gridY: y });
        } else if (meta.type === "dig-site") {
          this.digSites.set(meta.index, { entity, gridX: x, gridY: y });
        } else if (meta.type === "document") {
          this.documents.set(meta.index, { entity, gridX: x, gridY: y });
        }
      }
    }
  }

  createVisualWorld() {
    const THREE = this.THREE;
    const root = new THREE.Group();
    root.name = `grid-scene-${this.levelId}`;

    this.isometricRenderer = new IsometricRenderer(THREE);
    const gridGroup = this.isometricRenderer.renderGrid(this.grid);
    root.add(gridGroup);

    this.visuals = new GridSceneVisuals(THREE, this.isometricRenderer);
    this.visuals.addToScene(root);

    this.createPlayerMesh();
    root.add(this.playerMesh);

    this.visualRoot = root;
    this.renderer.add(root, "ground");

    // Apply environment theme (lighting and atmosphere)
    this.environmentTheme.apply(root, this.levelId);
  }

  createPlayerMesh() {
    const THREE = this.THREE;
    const geometry = new THREE.CircleGeometry(6, 8);
    const material = new THREE.MeshStandardMaterial({
      color: 0xf4a460,
      roughness: 0.7,
      metalness: 0.2
    });
    this.playerMesh = new THREE.Mesh(geometry, material);
    this.playerMesh.castShadow = true;
    this.playerMesh.receiveShadow = true;
    this.playerMesh.name = "player-mesh";
    this.updatePlayerPosition();
  }

  updatePlayerPosition() {
    const { x, y } = this.grid.gridToIsometric(this.playerGridX, this.playerGridY);
    this.playerMesh.position.set(x, y, 4);
  }

  beginPlaying() {
    this.session.setPhase("playing");
    this.screens.play();
    this.app.input.reset("grid-scene-start");
    this.highlightInteractiveElements();
  }

  highlightInteractiveElements() {
    if (!this.visuals) return;

    // Highlight dig sites
    for (const { gridX, gridY } of this.digSites.values()) {
      this.visuals.highlightDigSite(this.grid, gridX, gridY);
    }

    // Highlight NPCs
    for (const { gridX, gridY } of this.npcs.values()) {
      this.visuals.highlightNPC(this.grid, gridX, gridY);
    }
  }

  updateControl(dt, time, input) {
    if (!input.actions.pause?.pressed || this.modal || this.resultShown) return;
    if (this.session.state.phase === "playing") this.pause();
    else if (this.session.state.phase === "paused") this.resume();
  }

  updateMovement(dt, time, input) {
    if (this.session.state.phase !== "playing" || this.modal || this.resultShown) return;

    const move = input.axes.move ?? { x: 0, y: 0 };
    if (move.x === 0 && move.y === 0) return;

    const newX = this.playerGridX + (move.x > 0 ? 1 : move.x < 0 ? -1 : 0);
    const newY = this.playerGridY + (move.y > 0 ? 1 : move.y < 0 ? -1 : 0);

    if (this.grid.isWalkable(newX, newY)) {
      if (this.visuals) {
        this.visuals.createMovementIndicator(this.grid, this.playerGridX, this.playerGridY, newX, newY);
      }

      this.playerGridX = newX;
      this.playerGridY = newY;
      this.updatePlayerPosition();
      this.setCameraToPlayer();

      this.playerDirection = this.getDirection(move.x, move.y);
    }
  }

  getDirection(dx, dy) {
    if (dy < 0) return dx > 0 ? 1 : dx < 0 ? 7 : 0;
    if (dy > 0) return dx > 0 ? 3 : dx < 0 ? 5 : 4;
    return dx > 0 ? 2 : dx < 0 ? 6 : this.playerDirection;
  }

  updateGameplay(dt, time, input) {
    if (this.session.state.phase !== "playing" || this.modal || this.resultShown) return;

    if (input.actions.action?.pressed === true) {
      this.tryInteract();
    }
  }

  tryInteract() {
    const adjacentCells = this.grid.getNeighbors(this.playerGridX, this.playerGridY, true);

    for (const { x, y } of adjacentCells) {
      const meta = this.grid.metadata.get(`${x},${y}`);
      if (!meta) continue;

      if (meta.type === "dig-site") {
        this.performDig(x, y, meta.index);
        return;
      } else if (meta.type === "npc") {
        this.performNPCDialog(meta.npc);
        return;
      } else if (meta.type === "document") {
        this.collectDocument(meta.index);
        return;
      }
    }

    this.app.input.reset("grid-interact-fail");
  }

  performDig(gridX, gridY, siteIndex) {
    const site = this.digSites.get(siteIndex);
    if (!site) return;

    const difficulty = this.session.state.difficulty || "normal";
    const requiredHits = this.digMechanics.getRequiredHits(difficulty);

    this.screens.showDig({
      title: `Vykopávka ${siteIndex + 1}`,
      requiredHits,
      onAction: () => this.completeDig(siteIndex)
    });
  }

  completeDig(siteIndex) {
    const site = this.digSites.get(siteIndex);
    if (!site || this.digSitesCompleted.has(siteIndex)) return;

    this.screens.show(null, { playing: true });

    if (this.visuals) {
      this.visuals.createDigEffect(this.grid, site.gridX, site.gridY, 1);
    }

    // Resolve the dig using game mechanics
    const difficulty = this.session.state.difficulty || "normal";
    const digSiteData = createDigSite(this.levelId, siteIndex);

    if (digSiteData) {
      const digResult = this.digMechanics.resolveDig(digSiteData, difficulty);

      // Handle danger
      if (digResult.danger) {
        this.events.emit("danger:triggered", digResult.danger);
        this.session.setPhase("danger");
        this.screens.showDanger(digResult.danger.message, () => {
          this.session.setPhase("playing");
          this.screens.show(null, { playing: true });
        });
      }

      // Handle finding
      if (digResult.finding) {
        this.levelFindings.push(digResult.finding);
        this.currentScore += digResult.score;
        this.events.emit("finding:resolved", digResult.finding);

        const rarityIcons = { A: "💎", B: "⭐", C: "🔑" };
        const icon = rarityIcons[digResult.finding.rarity] || "🔑";
        this.screens.showFinding({
          finding: digResult.finding,
          icon,
          score: digResult.score,
          perfect: digResult.perfect
        });
      }

      this.digSitesCompleted.add(siteIndex);
    }

    this.emitDugEvent(site.gridX, site.gridY);
    this.app.input.reset("grid-dig-complete");
  }

  emitDugEvent(gridX, gridY) {
    this.events.emit("dig:hit", {
      position: this.grid.gridToIsometric(gridX, gridY)
    });
    this.events.emit("dig:clean", {});
  }

  performNPCDialog(npcId) {
    this.modal = "dialog";
    const dialogue = this.dialogueSystem.getConversation(npcId);

    if (!dialogue) {
      this.modal = null;
      return;
    }

    const options = dialogue.options || [];
    const primaryOptionIndex = 0;

    this.screens.showDialog({
      name: dialogue.name || npcId.toUpperCase(),
      text: dialogue.text,
      avatar: dialogue.avatar || npcId[0].toUpperCase(),
      buttonLabel: options[primaryOptionIndex]?.text || "OK",
      onConfirm: () => {
        const result = this.dialogueSystem.handleChoice(npcId, primaryOptionIndex);

        // Handle any effects
        if (result?.effect) {
          this.events.emit("npc:effect", { npcId, effect: result.effect });
        }

        this.modal = null;
        this.screens.show(null, { playing: true });
      }
    });
  }

  collectDocument(docIndex) {
    const doc = this.documents.get(docIndex);
    if (!doc) return;

    this.screens.show(null, { playing: true });
    this.documents.delete(docIndex);
    this.events.emit("document:collected", { index: docIndex });
    this.app.input.reset("grid-collect-doc");
  }

  pause() {
    this.session.setPhase("paused");
    this.screens.showPause({
      onResume: () => this.resume(),
      onMenu: () => this.app.changeScene("title"),
      placeLabel: this.levelId,
      objective: "Prozkoumej lokalitu",
      progress: 0.5
    });
  }

  resume() {
    this.session.setPhase("playing");
    this.screens.show(null, { playing: true });
  }

  setCameraToPlayer() {
    const { x, y } = this.grid.gridToIsometric(this.playerGridX, this.playerGridY);
    const cameraZ = Math.max(120, this.grid.width * TILE_SIZE / 3);
    if (this.renderer.camera) {
      this.renderer.camera.position.set(x, y - 40, cameraZ);
      this.renderer.camera.lookAt(x, y, 0);
    }
  }

  update(dt) {
    if (this.visuals) {
      this.visuals.update();
    }
  }

  destroyVisualWorld() {
    if (this.visuals) {
      this.visuals.dispose();
      this.visuals = null;
    }
    if (this.visualRoot) {
      this.renderer.remove(this.visualRoot);
      this.renderer.disposeObject(this.visualRoot);
      this.visualRoot = null;
    }
    if (this.isometricRenderer) {
      this.isometricRenderer.dispose();
      this.isometricRenderer = null;
    }
  }

  exit() {
    this.modal = null;
    this.app.input.reset("grid-exit");
    this.destroyVisualWorld();
    this.app.world.clear();
    this.app.collisions.reset();
  }

  dispose() {
    this.exit();
  }

  snapshot() {
    return {
      levelId: this.levelId,
      playerGridX: this.playerGridX,
      playerGridY: this.playerGridY,
      playerDirection: this.playerDirection,
      phase: this.session.state.phase,
      digSites: this.digSites.size,
      documents: this.documents.size
    };
  }
}
