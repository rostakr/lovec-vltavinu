const CACHE = "lovec-vltavinu-slavia-v7-0-release";
const CORE = [
  "./", "./index.html", "./style.css", "./v7.css", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png",
  "./vendor/three.module.min.js", "./vendor/three.core.min.js", "./src/bootstrap.js", "./src/audio/AudioEngine.js", "./src/audio/AudioRegistry.js",
  "./src/core/EventBus.js", "./src/core/GameEvents.js", "./src/core/GameApp.js", "./src/core/GameLoop.js", "./src/core/SceneManager.js", "./src/core/InputManager.js", "./src/core/AssetLoader.js",
  "./src/ecs/World.js", "./src/systems/CollisionSystem.js", "./src/systems/AnimationSystem.js",
  "./src/data/levels.js", "./src/data/chlum.js", "./src/data/nesmen.js", "./src/data/besednice.js", "./src/data/slavia.js", "./src/data/dialogues.js",
  "./src/gameplay/GameSession.js", "./src/gameplay/SessionRng.js", "./src/gameplay/FindingResolver.js", "./src/gameplay/Objectives.js", "./src/gameplay/InteractionSystem.js", "./src/gameplay/DigSystem.js", "./src/gameplay/DangerSystem.js", "./src/gameplay/ObjectiveSystem.js", "./src/gameplay/BossSystem.js", "./src/gameplay/SlaviaEvaluation.js", "./src/gameplay/SlaviaObjectiveFlow.js", "./src/gameplay/GameplayMechanics.js", "./src/gameplay/LevelProgression.js", "./src/gameplay/DigMechanics.js", "./src/gameplay/DialogueSystem.js", "./src/gameplay/LevelEvaluation.js",
  "./src/render/HybridRenderer.js", "./src/render/ThreeRenderer.js", "./src/render/CameraBounds.js", "./src/render/GltfAssetLoader.js", "./src/render/AssetDisposal.js", "./src/render/ModelFactory.js", "./src/render/ProceduralMoldavite.js", "./src/render/VisualEffects.js", "./src/render/ParticleSystem.js", "./src/render/WaterOverlay.js", "./src/render/EnvironmentTheme.js",
  "./vendor/three/addons/loaders/GLTFLoader.js", "./vendor/three/addons/utils/BufferGeometryUtils.js", "./vendor/three/addons/utils/SkeletonUtils.js",
  "./src/grid/TileDefinitions.js", "./src/grid/TileGrid.js", "./src/grid/IsometricRenderer.js", "./src/grid/GridLevels.js", "./src/grid/CharacterSprites.js", "./src/grid/GridSceneVisuals.js", "./src/grid/GridScene.js", "./src/grid/ChlumGridScene.js", "./src/grid/NesmenGridScene.js", "./src/grid/BesedniceGridScene.js", "./src/grid/SlaviaGridScene.js",
  "./src/performance/PerformanceMonitor.js", "./src/performance/AssetOptimizer.js",
  "./src/offline/OfflineDiagnostics.js",
  "./src/input/DomInputAdapter.js", "./src/input/MobileController.js", "./src/ui/ScreenController.js", "./src/ui/SceneTransition.js", "./src/ui/HudController.js", "./src/ui/GameStatusDisplay.js", "./src/ui/TutorialSystem.js", "./src/ui/ResultsScreen.js", "./src/ui/SettingsPanel.js", "./src/ui/mobile-controls.css", "./src/scenes/TitleScene.js", "./src/scenes/ChlumScene.js", "./src/scenes/ChlumNesmenBridgeScene.js", "./src/scenes/ChlumV7Scene.js", "./src/scenes/NesmenScene.js", "./src/scenes/NesmenRestorationScene.js", "./src/scenes/NesmenBesedniceBridgeScene.js", "./src/scenes/BesedniceScene.js", "./src/scenes/SlaviaScene.js",
  "./assets/manifests/assets.json", "./assets/sprites/player/hunter-walk-sheet.png", "./assets/sprites/player/hunter-action-sheet-v7.png", "./assets/sprites/npcs/farmer-vaclav-v2.png", "./assets/sprites/npcs/farmer-vaclav-v7.png", "./assets/sprites/hazards/tractor-chlum-v7.png", "./assets/sprites/foreground/chlum-wet-verge-v7.webp", "./assets/sprites/npcs/rival-karel-v2.png", "./assets/sprites/npcs/forester-jan-v2.png", "./assets/sprites/npcs/expert-eva-v2.png", "./assets/sprites/npcs/thief-franta-v2.png",
  "./assets/sprites/findings/vltavin-common.png", "./assets/sprites/findings/vltavin-rare.png", "./assets/sprites/findings/vltavin-standard.png", "./assets/sprites/findings/vltavin-nesmen.png", "./assets/sprites/findings/vltavin-besednice-hedgehog.png", "./assets/sprites/foreground/nesmen-forest-edge-v7.webp", "./assets/sprites/foreground/besednice-quarry-edge-v7.webp", "./assets/sprites/foreground/slavia-event-edge-v7.webp",
  "./assets/textures/terrain/chlum-field.png", "./assets/textures/terrain/chlum-furrows.png", "./assets/textures/terrain/chlum-plate-v7.svg", "./assets/textures/terrain/chlum-plate-v7.webp", "./assets/textures/terrain/nesmen-sand-profile.png", "./assets/textures/terrain/nesmen-forest-plate-v7.webp", "./assets/textures/terrain/besednice-clay-quarry-v7.webp", "./assets/textures/terrain/slavia-event-plate-v7.webp",
  "./assets/models/chlum/tractor-no-driver.glb", "./assets/models/chlum/hay-bale.glb", "./assets/models/chlum/field-marker.glb", "./assets/models/chlum/field-fence-segment.glb",
  "./assets/models/nesmen/profile-marker.glb", "./assets/models/besednice/trace-marker.glb", "./assets/models/besednice/hedgehog-marker.glb", "./assets/models/slavia/kd-slavia.glb", "./assets/models/slavia/document-folder.glb",
  "./assets/audio/journey-loop.mp3", "./assets/audio/dig-hit.mp3", "./assets/audio/finding-chime.mp3", "./assets/audio/danger-pulse.mp3", "./assets/audio/LICENSE.md"
];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE))); self.skipWaiting(); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))); self.clients.claim(); });
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(response => { const clone = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, clone)); return response; }).catch(() => caches.match("./index.html")));
    return;
  }
  event.respondWith(fetch(event.request).then(response => { const clone = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, clone)); return response; }).catch(() => caches.match(event.request)));
});
