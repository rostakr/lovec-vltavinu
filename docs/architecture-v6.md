# Lovec vltavínů 6.0 – technická architektura

> **Historický dokument.** Popisuje plán migrace z Canvas monolitu 5.2 na modulární runtime 6.0.
> Migrace je dokončená a V7 přestavba na něj navázala. Vrstvy `GameState`, `LegacySaveAdapter`
> a `LegacyDataAdapter` zmíněné v etapě B byly po převodu všech čtyř lokalit odstraněny
> (integrační krok 6 v `AGENTS.md`); cílová architektura žádný save systém nemá.
> Závazné jsou dnes `AGENTS.md`, `docs/ARCHITECTURE_CONTRACT.md` a `docs/PROJECT_CONTROL.md`.

## 1. Výchozí stav

Veřejná verze 5.2 zůstává během migrace hratelným produkčním základem. Její `game.js` obsahuje v jednom IIFE stav hry, definice levelů, vstupy, audio, gameplay, kolize, 2D Canvas rendering, UI vazby a debug API.

Monolit se nebude nahrazovat jednorázovým přepisem. Nové moduly se nejprve stabilizují unit testy, poté se do veřejného buildu zapojují po vrstvách.

## 2. Cílová struktura

```text
/
├── index.html
├── style.css
├── game.js                       # dočasný legacy runtime
├── runtime-stability.js          # ochranná vrstva během migrace
├── src/
│   ├── index.js                  # veřejné exporty jádra
│   ├── core/
│   │   ├── GameApp.js
│   │   ├── GameLoop.js
│   │   ├── EventBus.js
│   │   ├── SceneManager.js
│   │   ├── InputManager.js
│   │   └── AssetLoader.js
│   ├── ecs/
│   │   └── World.js
│   ├── systems/
│   │   ├── CollisionSystem.js
│   │   └── AnimationSystem.js
│   ├── render/
│   │   └── HybridRenderer.js
│   ├── data/                     # následující migrační etapa
│   │   ├── levels.js
│   │   ├── assets.js
│   │   ├── balance.js
│   │   └── dialogue.js
│   ├── scenes/                   # následující migrační etapa
│   │   ├── TitleScene.js
│   │   ├── LevelScene.js
│   │   └── JuryScene.js
│   └── adapters/
│       ├── HudAdapter.js
│       └── LegacySaveAdapter.js
├── assets/
│   ├── audio/
│   ├── sprites/
│   ├── textures/
│   └── models/
├── tests/
│   ├── unit/
│   └── mobile-smoke.spec.mjs
└── tools/
    └── validate.mjs
```

## 3. Odpovědnosti modulů

### `GameApp`

Composition root aplikace. Vytváří nebo přijímá závislosti, určuje pořadí systémů a zajišťuje jednotný `boot`, `start`, `stop`, změnu scény a `dispose`. Nesmí obsahovat logiku konkrétního levelu.

### `EventBus`

Synchronní komunikace na hranicích systémů. Podporuje trvalé i jednorázové listenery, unsubscribe, `AbortSignal` a explicitní vyčištění.

### `GameLoop`

Deterministická simulační smyčka s fixed timestepem:

- výchozí krok `1 / 60 s`;
- maximální frame delta `100 ms`;
- maximálně pět simulačních substepů;
- přebytečný čas se zahodí a eviduje jako `droppedTime`;
- rendering dostává interpolační `alpha`.

Tím se zabrání spirále smrti po návratu aplikace z pozadí nebo při dlouhém frame.

### `SceneManager`

Spravuje titulní obrazovku, level, meziscény a finále. Každá scéna může implementovat:

```js
{
  async enter(context) {},
  async exit(context) {},
  update(dt, time) {},
  render(alpha, metrics) {},
  async dispose() {}
}
```

Přechod je verzovaný. Starý asynchronní přechod nesmí přepsat novější požadavek.

### `InputManager`

Jediný zdroj pravdy pro ovládání:

```js
{
  actions: {
    action: { down, pressed, released, value },
    pause: { down, pressed, released, value }
  },
  axes: {
    move: { x, y, length }
  }
}
```

`pressed` a `released` platí pouze jeden simulační frame. Při pauze, změně scény, ztrátě fokusu a změně orientace se volá centrální `reset()`.

### `AssetLoader`

Asynchronní registry loaderů podle typu assetu:

```js
{ id: "tractor", type: "gltf", url: "./assets/models/tractor.glb" }
{ id: "player-idle", type: "texture", url: "./assets/sprites/player-idle.png" }
{ id: "chlum", type: "level", url: "./assets/levels/chlum.json" }
```

Souběžné požadavky na stejný asset sdílejí jeden Promise. Neúspěšný požadavek se odstraní z cache, aby byl možný retry.

### `World`

Lehký entity-component model bez dědičnosti. Entita je číselné ID. Komponenty jsou data uložená v mapách podle názvu.

```js
const player = world.createEntity({
  transform: { x: 360, y: 1070, rotation: 0 },
  movement: { speed: 185 },
  collider: { shape: "circle", radius: 17 },
  sprite: { assetId: "player-idle", layer: "actors" },
  health: { current: 3, max: 3 }
});
```

Systémy používají dotaz:

```js
for (const [entity, transform, collider] of world.query("transform", "collider")) {
  // pouze entity s oběma komponentami
}
```

### `CollisionSystem`

Broad phase používá spatial hash. Narrow phase podporuje circle × circle, AABB × AABB a circle × AABB. Kolize mají fáze `enter`, `stay`, `exit`.

### `AnimationSystem`

Aktualizuje animační komponenty nezávisle na renderovací technologii:

```js
{
  frames: [0, 1, 2, 3],
  fps: 8,
  loop: true,
  playing: true,
  index: 0,
  elapsed: 0,
  frame: 0
}
```

Renderer pouze přečte aktuální `frame` a nastaví UV/sprite region.

### `HybridRenderer`

Three.js namespace se injektuje při bootstrapu. Modul sám nestahuje knihovnu a není vázán na CDN.

Renderer používá ortografickou kameru, vrstvy `ground`, `props`, `actors`, `effects`, 2D `THREE.Sprite`, low-poly GLB objekty a HTML/CSS HUD nad canvasem.

## 4. Doporučené komponenty

| Komponenta | Účel |
|---|---|
| `transform` | pozice, rotace, měřítko |
| `movement` | rychlost, cílový směr |
| `collider` | tvar, rozměry, maska |
| `sprite` | textura, frame, anchor, vrstva |
| `model` | GLB asset, animace, LOD |
| `animation` | frame sequence a timing |
| `interaction` | typ akce, dosah, priorita |
| `patrol` | waypointy, rychlost, aktuální bod |
| `vision` | dosah, úhel, expozice |
| `danger` | přírůstek pozornosti, catch timeout |
| `collectible` | rarity, váha, kvalita, původ |
| `digSpot` | odhalení, potřeba zahrabání, loot table |
| `npc` | jméno, role, dialog state |
| `boss` | fáze, zásahy, rychlost, schopnosti |
| `lifetime` | čas do odstranění efektu |

Komponenty nesmí obsahovat reference na DOM.

## 5. Události mezi moduly

### Aplikace a scény

- `app:boot:start`
- `app:boot:complete`
- `app:dispose`
- `scene:transition:start`
- `scene:transition:complete`
- `scene:transition:error`

### Vstupy

- `input:pressed`
- `input:released`
- `input:axis`
- `input:reset`

### Assety

- `asset:load:start`
- `asset:load:complete`
- `asset:load:error`
- `asset:unload`
- `asset:clear`

### ECS a gameplay

- `entity:create`
- `entity:destroy`
- `component:add`
- `component:remove`
- `collision:enter`
- `collision:stay`
- `collision:exit`
- `animation:frame`
- `animation:loop`
- `animation:complete`

### Budoucí doménové eventy

- `interaction:available`
- `interaction:performed`
- `dig:start`
- `dig:hit`
- `dig:complete`
- `stone:collected`
- `danger:detected`
- `danger:caught`
- `objective:progress`
- `objective:complete`
- `level:complete`

Doménové eventy obsahují serializovatelná data, nikoli Three.js objekty.

## 6. Update loop

Pořadí jednoho fixed kroku:

1. přečíst vstupy;
2. zpracovat aktuální scénu a gameplay příkazy;
3. pohyb hráče a NPC;
4. kolize a triggery;
5. vision/danger systém;
6. animace;
7. částice a lifetime;
8. aktualizovat objektiv a HUD model;
9. ukončit frame vstupů (`pressed/released = false`).

Rendering probíhá jednou za browser frame:

1. interpolovat render pozice pomocí `alpha`;
2. aktualizovat Three.js objekty a sprite UV;
3. renderovat scénu;
4. aktualizovat HTML/CSS HUD pouze při změně hodnot.

## 7. Migrační etapy

### Etapa A – hotovo

- validační workflow;
- runtime stabilizace;
- mobilní browser smoke testy;
- modulární core a unit testy.

### Etapa B – data a stav

- přesunout `LEVELS`, `PERKS`, `SAMPLES` a balance konstanty do `src/data`;
- zavést explicitní `GameState` factory;
- zachovat save schema 5.1 přes `LegacySaveAdapter`;
- přidat unit test každého levelového cíle.

### Etapa C – vstupy a UI

- nahradit interní `input` objekt modulem `InputManager`;
- vytvořit `HudAdapter`;
- odstranit potřebu opravné vrstvy `runtime-stability.js` po dosažení funkční parity.

### Etapa D – gameplay systémy

- převést interakce, kopání, sběr, nebezpečí, patroly a bossy do ECS systémů;
- zachovat stávající Canvas renderer jako dočasný adapter.

### Etapa E – Three.js

- přidat lokální, verzovanou Three.js závislost;
- vytvořit ortografickou scénu;
- převádět levely jednotlivě: Chlum → Nesměň → Besednice → Malše;
- Ločenice může zůstat převážně sprite-based;
- odstranit legacy Canvas rendering až po vizuální a gameplay paritě všech levelů.

## 8. Výkonové limity pro mobil

- maximální interní render plocha přibližně 1,8 Mpx;
- maximální DPR 2, adaptivně méně na velkém viewportu;
- cílových 60 FPS, tolerované minimum 30 FPS;
- jeden low-poly model ideálně pod 20 000 trojúhelníků;
- statické objekty spojovat nebo instancovat;
- textury běžně 512–1024 px, atlas postav maximálně 2048 px;
- transparentní objekty používat střídmě;
- audio streamovat nebo komprimovat, nikoli držet několik velkých WAV v produkční cache;
- při návratu z pozadí vždy resetovat input a delta time.

## 9. Definition of Done modulární migrace

- veřejná hra nepoužívá globální mutable gameplay stav;
- levelová data nejsou zapsaná uvnitř rendereru;
- vstupní, kolizní a animační logika mají unit testy;
- každá scéna má explicitní `enter/exit/dispose`;
- Three.js objekty se při změně scény korektně dispose;
- HTML/CSS HUD neprovádí změny každý frame bez potřeby;
- všechny browser smoke testy procházejí v portrait i landscape scénáři;
- save kompatibilita je zachována nebo migrována explicitním verzovaným adapterem.
