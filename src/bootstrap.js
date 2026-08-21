import * as THREE from "../vendor/three.module.min.js";
import { AudioEngine } from "./audio/AudioEngine.js";
import { EventBus } from "./core/EventBus.js";
import { EVENT_CONTRACTS, validateEventPayload } from "./core/GameEvents.js";
import { GameApp } from "./core/GameApp.js";
import { createGameSession } from "./gameplay/GameSession.js";
import { ThreeRenderer } from "./render/ThreeRenderer.js";
import { GltfAssetLoader, GLTF_LOADER_REVISION } from "./render/GltfAssetLoader.js";
import { disposeObject3D, disposeTexture } from "./render/AssetDisposal.js";
import { ScreenController } from "./ui/ScreenController.js";
import { SceneTransition } from "./ui/SceneTransition.js";
import { HudController } from "./ui/HudController.js";
import { DomInputAdapter } from "./input/DomInputAdapter.js";
import { TitleScene } from "./scenes/TitleScene.js";
import { ChlumV7Scene } from "./scenes/ChlumV7Scene.js";
import { NesmenBesedniceBridgeScene } from "./scenes/NesmenBesedniceBridgeScene.js";
import { BesedniceScene } from "./scenes/BesedniceScene.js";
import { SlaviaScene } from "./scenes/SlaviaScene.js";
import { ChlumGridScene } from "./grid/ChlumGridScene.js";
import { NesmenGridScene } from "./grid/NesmenGridScene.js";
import { BesedniceGridScene } from "./grid/BesedniceGridScene.js";
import { SlaviaGridScene } from "./grid/SlaviaGridScene.js";

const documentRef = globalThis.document;
const windowRef = globalThis.window;
const canvas = documentRef.getElementById("game");
if (!canvas) throw new Error("Missing #game canvas.");
if (String(THREE.REVISION) !== GLTF_LOADER_REVISION) {
  throw new Error(`Three.js revision ${THREE.REVISION} does not match GLTFLoader revision ${GLTF_LOADER_REVISION}.`);
}

const events = new EventBus({
  contracts: EVENT_CONTRACTS,
  strict: true,
  validatePayload: validateEventPayload
});
const renderer = new ThreeRenderer({
  three: THREE,
  canvas,
  viewHeight: 720,
  pixelRatioCap: 2,
  maxInternalPixels: 1_800_000,
  clearColor: 0x17150f,
  antialias: true
});
const transition = new SceneTransition(documentRef);
const app = new GameApp({ events, renderer, transition });
const session = createGameSession();
const screens = new ScreenController(documentRef);
const hud = new HudController({ document: documentRef, events });
const audio = new AudioEngine({
  events,
  assets: app.assets,
  document: documentRef,
  window: windowRef,
  button: documentRef.getElementById("soundButton")
});
const lifecycle = new AbortController();

function resize() {
  renderer.resizeToElement(canvas);
  app.scenes.activeScene?.setCameraToPlayer?.();
}

const inputAdapter = new DomInputAdapter({
  input: app.input,
  document: documentRef,
  window: windowRef,
  onResize: resize
});

const textureLoader = new THREE.TextureLoader();
const loadJson = async entry => {
  const response = await fetch(entry.url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${entry.url}`);
  return response.json();
};
const loadTexture = entry => new Promise((resolve, reject) => {
  textureLoader.load(entry.url, resolve, undefined, reject);
});
const gltfLoader = new GltfAssetLoader();

app.assets.register("json", loadJson);
app.assets.register("texture", loadTexture, disposeTexture);
app.assets.register("spritesheet", loadTexture, disposeTexture);
app.assets.register("gltf", entry => gltfLoader.load(entry), disposeObject3D);
app.assets.register("audio", entry => audio.load(entry));

const chlum = new ChlumV7Scene({
  app,
  events,
  renderer,
  three: THREE,
  screens,
  session
});
const nesmen = new NesmenBesedniceBridgeScene({
  app,
  events,
  renderer,
  three: THREE,
  screens,
  session
});
const besednice = new BesedniceScene({
  app,
  events,
  renderer,
  three: THREE,
  screens,
  session
});
const slavia = new SlaviaScene({
  app,
  events,
  renderer,
  three: THREE,
  screens,
  session
});
const title = new TitleScene({
  document: documentRef,
  screens,
  onStart: () => startNewRun().catch(showFatalError)
});

const chlumGrid = new ChlumGridScene({
  app,
  events,
  renderer,
  three: THREE,
  screens,
  session
});
const nesmenGrid = new NesmenGridScene({
  app,
  events,
  renderer,
  three: THREE,
  screens,
  session
});
const besedniceGrid = new BesedniceGridScene({
  app,
  events,
  renderer,
  three: THREE,
  screens,
  session
});
const slaviaGrid = new SlaviaGridScene({
  app,
  events,
  renderer,
  three: THREE,
  screens,
  session
});

app.scenes.register("title", title);
app.scenes.register("chlum", chlum);
app.scenes.register("nesmen", nesmen);
app.scenes.register("besednice", besednice);
app.scenes.register("slavia", slavia);
app.scenes.register("chlum-grid", chlumGrid);
app.scenes.register("nesmen-grid", nesmenGrid);
app.scenes.register("besednice-grid", besedniceGrid);
app.scenes.register("slavia-grid", slaviaGrid);

async function startNewRun() {
  session.reset();
  await app.changeScene("chlum");
}

function showFatalError(error) {
  console.error(error);
  const message = error instanceof Error ? error.message : String(error);
  screens.showFatal({
    title: "Hru se nepodařilo spustit",
    text: message,
    onRetry: () => windowRef.location.reload()
  });
}

function installLifecycleHandlers() {
  const { signal } = lifecycle;
  documentRef.addEventListener("visibilitychange", () => {
    if (documentRef.hidden) app.stop();
    else if (!app.disposed) app.start();
  }, { signal });
  windowRef.addEventListener("pagehide", () => app.input.reset("page-hide"), { signal });
  windowRef.addEventListener("beforeunload", () => {
    lifecycle.abort();
    inputAdapter.dispose();
    hud.dispose();
    screens.dispose();
    void audio.dispose();
    void app.dispose();
  }, { signal });
}

function installDebugApi() {
  windowRef.__lovecRuntime = Object.freeze({
    snapshot: () => ({
      stable: !app.disposed,
      scene: app.scenes.activeId,
      running: app.loop.running,
      screen: screens.activeId ?? "playing",
      renderer: {
        width: renderer.width,
        height: renderer.height,
        pixelRatio: renderer.pixelRatio,
        type: "three-webgl-orthographic"
      },
      audio: audio.snapshot(),
      session: session.state,
      chlum: app.scenes.activeId === "chlum" ? chlum.snapshot() : null,
      nesmen: app.scenes.activeId === "nesmen" ? nesmen.snapshot() : null,
      besednice: app.scenes.activeId === "besednice" ? besednice.snapshot() : null,
      slavia: app.scenes.activeId === "slavia" ? slavia.snapshot() : null,
      chlumGrid: app.scenes.activeId === "chlum-grid" ? chlumGrid.snapshot() : null,
      nesmenGrid: app.scenes.activeId === "nesmen-grid" ? nesmenGrid.snapshot() : null,
      besedniceGrid: app.scenes.activeId === "besednice-grid" ? besedniceGrid.snapshot() : null,
      slaviaGrid: app.scenes.activeId === "slavia-grid" ? slaviaGrid.snapshot() : null
    }),
    resetInput: reason => inputAdapter.reset(reason),
    resize,
    playGridScene: async (levelId) => {
      const sceneId = `${levelId}-grid`;
      if (app.scenes.has(sceneId)) await app.changeScene(sceneId);
    }
  });
}

async function boot() {
  resize();
  installLifecycleHandlers();
  installDebugApi();
  audio.start();
  await app.boot("title");
  app.start();
  if ("serviceWorker" in navigator && !windowRef.location.search.includes("debug")) {
    navigator.serviceWorker.register("./sw.js").catch(error => console.warn("Service worker:", error));
  }
}

boot().catch(showFatalError);

export { app, audio, events, renderer, session, title, chlum, nesmen, besednice, slavia, startNewRun };
