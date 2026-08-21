# Závazný architektonický kontrakt

Verze kontraktu: 1.1 · 31. 7. 2026

Tento dokument je normativní pro cílovou Three.js verzi. `docs/architecture-v6.md` zůstává užitečným historickým migračním popisem; při rozporu platí tento kontrakt a `AGENTS.md`.

## Strom složek

```text
/
├── index.html
├── style.css
├── src/
│   ├── bootstrap.js
│   ├── core/
│   │   ├── GameApp.js
│   │   ├── GameLoop.js
│   │   ├── EventBus.js
│   │   ├── SceneManager.js
│   │   ├── AssetLoader.js
│   │   └── InputManager.js
│   ├── data/
│   │   ├── levels.js
│   │   ├── dialogues.js
│   │   └── balance.js
│   ├── ecs/
│   │   ├── World.js
│   │   └── componentSchemas.js
│   ├── scenes/
│   │   ├── TitleScene.js
│   │   ├── LevelScene.js
│   │   └── FinaleScene.js
│   ├── gameplay/
│   │   ├── GameSession.js
│   │   ├── ObjectiveSystem.js
│   │   ├── InteractionSystem.js
│   │   ├── DigSystem.js
│   │   ├── DangerSystem.js
│   │   └── BossSystem.js
│   ├── systems/
│   │   ├── PlayerControlSystem.js
│   │   ├── MovementSystem.js
│   │   ├── CollisionSystem.js
│   │   ├── AnimationSystem.js
│   │   └── LifetimeSystem.js
│   ├── render/
│   │   ├── ThreeRenderer.js
│   │   ├── HybridRenderer.js
│   │   ├── SpriteFactory.js
│   │   ├── ModelFactory.js
│   │   └── CameraController.js
│   ├── ui/
│   │   ├── HudController.js
│   │   └── ScreenController.js
│   └── audio/
│       └── AudioEngine.js
├── assets/
│   ├── manifests/assets.json
│   ├── sprites/
│   ├── models/
│   ├── textures/
│   └── audio/
├── tests/
│   ├── unit/
│   └── e2e/
└── tools/
    └── validate.mjs
```

Dočasné `game.js`, `runtime-stability.js`, Canvas renderer a legacy save soubory nejsou součástí cílového stromu.

## Odpovědnosti modulů

| Modul | Odpovědnost | Nesmí dělat |
|---|---|---|
| `bootstrap` | vytvořit závislosti, registrovat loadery/scény, spustit aplikaci | obsahovat quest či render loop |
| `GameApp` | composition root, životní cyklus, pořadí systémů | logiku konkrétního levelu |
| `GameLoop` | fixed update, limit delta/substepů, interpolační render | číst DOM nebo herní data |
| `EventBus` | synchronní komunikace přes známé názvy eventů | sloužit jako skrytý globální stav |
| `SceneManager` | `enter/exit/update/render/dispose`, bezpečné async přechody | vlastnit permanentní session data |
| `AssetLoader` | manifest, cache Promise, progress, retry a dispose | znát pravidla gameplay |
| `InputManager` | normalizovat klávesnici/touch na akce a osy, resetovat vstup | přímo pohybovat entitou |
| `World` | entity ID, komponentová data a dotazy | obsahovat renderer či DOM reference |
| Gameplay systémy | pravidla interakcí, kopání, nebezpečí, bossů a cílů | vytvářet Three.js objekty |
| Obecné systémy | pohyb, kolize, animace a lifetime | měnit quest texty |
| `ThreeRenderer` | jediná produkční renderer instance, kamera, vrstvy, sync ECS→Three a dispose | rozhodovat o výsledku kolize nebo úkolu |
| `HybridRenderer` | interní, izolovaně testovatelný implementační základ a jediný konstrukční bod `THREE.WebGLRenderer` | být přímo instancován v produkčním stromu nebo použit jako druhá produkční cesta |
| UI controllery | odvozovat a diffovat HUD/screen model do DOM | být autoritou herního stavu |
| `AudioEngine` | audio po gestu, hudební přechody, pause/resume | spouštět questy |
| `GameSession` | stav aktuálního průchodu pouze v paměti | localStorage, migrace nebo inventářové UI |

## Renderer ownership kontrakt

- `src/bootstrap.js` vytváří právě jednu instanci `ThreeRenderer` a nevytváří žádný jiný renderer.
- `ThreeRenderer` je jediný povolený potomek `HybridRenderer` v produkčním stromu.
- `HybridRenderer` je interní, ale izolovaně testovatelný základ; přímá produkční instance `new HybridRenderer(...)` je zakázána a odmítnuta statickým validátorem produkčního importního grafu.
- Jediný výraz `new THREE.WebGLRenderer(...)` v produkčním stromu smí být v `src/render/HybridRenderer.js`.
- Tato jediná instance vlastní jediný canvas, jednu ortografickou kameru, render vrstvy a `dispose()` WebGL rendereru.
- `GameApp` vlastní jediný fixed-step loop; renderer nesmí vytvářet paralelní `requestAnimationFrame` smyčku.
- Statický validátor musí odmítnout druhý konstrukční bod WebGL rendereru, přímou produkční instanci `HybridRenderer`, dalšího potomka `HybridRenderer` a další renderer v bootstrapu.

## Datové struktury

### Asset manifest entry

```js
{
  id: "tractor",
  type: "gltf", // texture | spritesheet | gltf | audio | json
  url: "./assets/models/tractor.glb",
  preload: "level:chlum",
  budget: { bytes: 350000, triangles: 12000, textureMax: 1024 }
}
```

`assets/manifests/assets.json` je skutečná a jediná autoritativní manifestová databáze runtime assetů. ID je stabilní a unikátní. URL je relativní k nasazenému rootu GitHub Pages. Každý runtime asset musí být v tomto manifestu; `src/data` neobsahuje paralelní asset registry.

### Level definition

```js
{
  id: "chlum",
  order: 0,
  title: "Chlum",
  scene: "level",
  briefing: { context: "…", goal: "…" },
  spawn: { x: 120, y: 380 },
  bounds: { x: 0, y: 0, width: 1600, height: 1200 },
  objective: { type: "chlum-permission-and-find", required: 1 },
  hazards: ["tractor"],
  assetGroups: ["common", "level:chlum"],
  next: "nesmen"
}
```

`LEVEL_ORDER` je přesně `chlum`, `nesmen`, `besednice`, `slavia`.

Chlum po získání povolení zpřístupní globální kontextovou akci `RADAR`. Opakované stisknutí stejného akčního vstupu hlásí sílu signálu; v dosahu skrytého cíle odhalí povrchový vltavín a akce se u nálezu změní na `SEBRAT`. Chlum neotevírá kopací modal. Rytmické kopání se třemi úspěšnými zásahy začíná až v Nesměni a používá tentýž kontextový vstup.

Na zařízení s dotykem ovládá pohyb `#moveZone` a akci `#actionButton`. Klávesnicový vstup zůstává WASD/šipky pro pohyb a `E` pro kontextovou akci; oba adaptéry zapisují pouze do jednoho sdíleného `InputManageru`.

### Entity specification

```js
{
  id: "farmer-vaclav",
  components: {
    transform: { x: 560, y: 410, rotation: 0, scale: 1 },
    sprite: { assetId: "npc-farmer", layer: "actors", frame: 0 },
    collider: { shape: "circle", radius: 18, layer: "npc", mask: ["player"] },
    interaction: { kind: "permission", range: 64, priority: 50 },
    npc: { name: "Václav", role: "farmer", dialogueId: "chlum-permission" }
  }
}
```

Komponenty jsou serializovatelná data a neobsahují DOM uzly, `THREE.Object3D`, callbacky ani Promise.

### Session state

```js
{
  levelId: "chlum",
  phase: "briefing",
  findings: [{ findingId: "finding-1", locality: "chlum", rarity: "B", weight: 2.4, score: 120 }],
  score: 120,
  health: 3,
  danger: 0,
  flags: { chlumPermission: true },
  objective: { id: "chlum-permission-and-find", current: 1, required: 1, complete: true }
}
```

Stav žije jen po dobu otevřené stránky. `findings` je podklad výsledku, nikoli uživatelsky spravovaný inventář.

### Input snapshot

```js
{
  actions: {
    action: { down: false, pressed: true, released: false, value: 1 },
    pause: { down: false, pressed: false, released: false, value: 0 }
  },
  axes: { move: { x: 0.7, y: -0.2, length: 0.73 } }
}
```

## Eventový kontrakt

Doménové eventy přenášejí obyčejná data. Producent nesmí očekávat pořadí listenerů. Event oznamuje skutečnost; příkazy se předávají přímo systému nebo přes input snapshot.

| Event | Producent | Hlavní odběratel | Payload |
|---|---|---|---|
| `app:boot:start` | `GameApp` | loading UI, diagnostika | `{ initialScene }` |
| `app:boot:complete` | `GameApp` | screen UI, audio | `{ initialScene }` |
| `app:dispose` | `GameApp` | diagnostika | `{}` |
| `scene:transition:start` | `SceneManager` | input, loading UI | `{ from, to }` |
| `scene:transition:complete` | `SceneManager` | HUD, audio, QA | `{ from, to }` |
| `scene:transition:error` | `SceneManager` | error UI, QA | `{ from, to, message }` |
| `input:pressed` | `InputManager` | aktivní scéna | `{ name, value }` |
| `input:released` | `InputManager` | aktivní scéna | `{ name, value, reason? }` |
| `input:axis` | `InputManager` | player control | `{ name, value }` |
| `input:reset` | `InputManager` | diagnostika | `{ reason }` |
| `asset:load:start` | `AssetLoader` | loading UI | `{ id, type }` |
| `asset:load:complete` | `AssetLoader` | scene factory | `{ id, type }` |
| `asset:load:error` | `AssetLoader` | error UI, QA | `{ id, type, message }` |
| `interaction:available` | `InteractionSystem` | HUD | `{ entity, kind, label }` |
| `interaction:cleared` | `InteractionSystem` | HUD | `{ entity }` |
| `interaction:performed` | `InteractionSystem` | objective/dialog/dig | `{ actor, target, kind }` |
| `dig:start` | `DigSystem` | screen UI, audio | `{ spot, requiredHits: 3 }` |
| `dig:hit` | `DigSystem` | screen UI, audio | `{ spot, hit, requiredHits: 3, quality }` |
| `dig:miss` | `DigSystem` | screen UI, danger | `{ spot, misses }` |
| `dig:complete` | `DigSystem` | objective, loot | `{ spot, hits: 3 }` |
| `finding:collected` | loot/gameplay | session, HUD | `{ findingId, locality, rarity, weight, score }` |
| `danger:changed` | `DangerSystem` | HUD, audio | `{ previous, current, cause }` |
| `danger:caught` | `DangerSystem` | active scene | `{ hazard, consequence }` |
| `objective:progress` | `ObjectiveSystem` | HUD | `{ id, current, required }` |
| `objective:complete` | `ObjectiveSystem` | scene flow, HUD | `{ id, levelId }` |
| `level:complete` | `LevelScene` | `SceneManager` | `{ levelId, nextLevelId, score }` |
| `collision:enter` | `CollisionSystem` | gameplay systems | `{ a, b, normal, depth }` |
| `collision:stay` | `CollisionSystem` | gameplay systems | `{ a, b, normal, depth }` |
| `collision:exit` | `CollisionSystem` | gameplay systems | `{ a, b }` |
| `animation:frame` | `AnimationSystem` | audio/effects (jen výjimečně) | `{ entity, clip, frame }` |
| `animation:complete` | `AnimationSystem` | gameplay/effects | `{ entity, clip }` |
| `hud:model:changed` | HUD model adapter | `HudController` | `{ revision, model }` |
| `audio:state` | `AudioEngine` | UI, diagnostika | `{ state, trackId? }` |

Payload nesmí obsahovat celý `World`, scénu, DOM uzel nebo Three.js objekt. Chybové eventy posílají čitelnou zprávu; původní `Error` může zůstat pouze v diagnostickém loggeru.

## Doporučený update loop

Konstanty:

```js
FIXED_STEP = 1 / 60
MAX_FRAME_DELTA = 0.1
MAX_SUBSTEPS = 5
```

Pořadí každého fixed kroku je závazné:

1. vytvořit neměnný input snapshot;
2. zpracovat stav aktivní scény a povolené akce;
3. `PlayerControlSystem` a AI rozhodnutí;
4. `MovementSystem` uloží předchozí a novou transformaci;
5. `CollisionSystem` vyřeší blokace a vyrobí enter/stay/exit;
6. `InteractionSystem`, `DangerSystem`, `DigSystem` a `BossSystem` vyhodnotí gameplay;
7. `ObjectiveSystem` aktualizuje cíle a případný přechod levelu;
8. `AnimationSystem` a `LifetimeSystem`;
9. sestavit HUD view model a emitovat jej jen při změně;
10. `InputManager.endFrame()` vynuluje `pressed/released`.

Jednou za `requestAnimationFrame`:

1. spočítat `alpha = accumulator / FIXED_STEP`;
2. interpolovat pouze render transformace mezi předchozí a aktuální simulací;
3. synchronizovat ECS data do Three.js objektů a sprite UV;
4. renderovat jediným `WebGLRenderer`;
5. propsat dirty HUD model do DOM;
6. naplánovat další frame.

```js
function frame(now) {
  const frameDelta = Math.min((now - previousNow) / 1000, MAX_FRAME_DELTA);
  previousNow = now;
  accumulator += Math.max(0, frameDelta);

  let steps = 0;
  while (accumulator >= FIXED_STEP && steps < MAX_SUBSTEPS) {
    updateFixed(FIXED_STEP);
    accumulator -= FIXED_STEP;
    steps += 1;
  }

  if (steps === MAX_SUBSTEPS && accumulator >= FIXED_STEP) {
    accumulator %= FIXED_STEP;
  }

  render(accumulator / FIXED_STEP);
  requestAnimationFrame(frame);
}
```

Při pauze, skrytí stránky, ztrátě fokusu, otočení zařízení a změně scény se vstup resetuje. Simulace během overlaye, který ji má zastavit, neběží. Po návratu se starý čas nekompenzuje velkým počtem kroků.

## Render a asset pravidla

- Three.js se používá z lokálně připnuté závislosti, nikoli z několika CDN.
- Existuje právě jeden `WebGLRenderer`, jeden canvas, jedna ortografická kamera a jeden vlastník jejich lifecycle a `dispose()`.
- Transparentní sprity používají atlas, alpha test a omezený počet materiálů.
- GLB má definovaný pivot, měřítko, rozpočet trojúhelníků a textur.
- Statické opakované objekty používají instancing nebo sdílenou geometrii/material.
- Běžná textura má nejvýše 1024 px; atlas postav nejvýše 2048 px.
- DPR je adaptivní a nejvýše 2; interní plocha cílí pod přibližně 1,8 Mpx.
- Každá scéna při `exit/dispose` odregistruje listenery a uvolní své GPU zdroje.

## Akceptace architektury

- `index.html` spouští modulární bootstrap a neobsahuje druhý gameplay runtime.
- Chlum je kompletně hratelný přes Three.js bez volání funkcí z monolitického `game.js`.
- Systémy lze unit testovat bez DOM a WebGL.
- Eventy mají názvy a payloady z této tabulky.
- Neexistuje nový save/import/export ani inventářový modul.
- Scene transition nezanechá aktivní vstup, listener, audio track nebo GPU objekt.
- Renderer ownership testy potvrzují jediný konstrukční bod, jediný bootstrap renderer a zákaz přímé produkční instance `HybridRenderer`.
- Unit, validační a mobilní smoke testy jsou zelené.
