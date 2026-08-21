# V7 Visual Contract — Lovec vltavínů

## Status

This document is the visual source of truth for the V7 rebuild. It intentionally overrides older scene-composition guidance where the old guidance conflicts with the approved visual target.

The product remains a browser game with Three.js/WebGL, an orthographic camera, desktop controls and iPhone portrait/landscape controls. The rebuild changes how scenes are composed and presented; it must not recreate eight parallel ownership streams or four divergent rendering pipelines.

## Approved player-facing target

The game should read as a premium stylized 2.5D South Bohemian diorama rather than a flat tiled map or a generic low-poly prototype.

Required qualities:

- coherent hand-painted / stylized-realistic art direction;
- high environmental detail at gameplay distance;
- fixed orthographic perspective;
- camera continuously follows the main character;
- natural character scale relative to terrain and props;
- wet surfaces, vegetation, geology and location-specific detail where appropriate;
- strong depth through foreground occlusion, midground gameplay and distant background;
- restrained HUD that supports the scene instead of dominating it;
- no visible texture tiling or production placeholders in an approved level.

## Canonical scene stack

Each level uses the same conceptual stack:

1. **Terrain plate** — a large authored high-resolution environment image aligned to world coordinates.
2. **Navigation/collision** — invisible gameplay geometry independent from the art.
3. **Back props** — world objects that sit visually behind actors.
4. **Interactive layer** — NPCs, finds, dig sites, hazards and interactive props.
5. **Actor layer** — player, NPCs and moving hazards/vehicles.
6. **Foreground occlusion** — vegetation, fences, trunks, terrain lips and other elements that may partially cover actors.
7. **FX** — rain residue, dust, puddle glints, particles and interaction highlights.
8. **HUD** — DOM UI above WebGL.

The terrain plate is the primary visual source. Small repeated textures may be used for secondary materials or effects, but they must not form the visible identity of the level.

## Camera contract

- Keep `THREE.OrthographicCamera`.
- Follow the player continuously during gameplay.
- Use a small dead zone so tiny movements do not shake the frame.
- Use damping outside the dead zone instead of hard-locking the camera to the player.
- Clamp the camera to level bounds so no space outside the authored plate is exposed.
- Large teleports/resets must snap rather than slowly travel across the whole map.
- Desktop, iPhone portrait and iPhone landscape use the same world scale; composition/zoom may be tuned per viewport class later.
- Do not expose the whole level as a static overview during normal play.

## Character contract

The player is the focal moving element and must visually belong to the environment.

Minimum production animation states:

- idle;
- walk (preferred: 8 directions; acceptable baseline: high-quality 4 directions with controlled mirroring);
- search/look-down;
- pick-up;
- dig;
- talk/interact;
- caught/hit;
- short finding/celebration reaction.

Gameplay owns movement/action state. An animation controller selects the visual clip/frame. The renderer only renders the resolved visual state.

NPCs must share the same perspective, scale, lighting logic and rendering technique as the player.

## Level identity

### 1. Chlum — pole po dešti

Visual identity:

- broad muddy cultivated field after rain;
- irregular furrows, puddles, wet reflections and tyre tracks;
- field road, fence and edge vegetation;
- believable South Bohemian village/countryside in the distance;
- moving tractor hazard;
- farmer Václav near the field edge;
- surface-search gameplay across a large field.

The level must not read as one repeated brown texture with decorative props placed on top.

### 2. Nesměň — lesní naleziště

Visual identity:

- large forest area, not a small clearing;
- trunks, branches, ferns, leaf litter, moss and roots in multiple depth layers;
- visible profiles/digging sites;
- soft shadowing and shafts of light;
- readable walk corridors that still feel natural.

### 3. Besednice — pískovna / jílovité naleziště

Visual identity:

- exposed sand, clay and gravel layers;
- eroded slopes, excavations and puddles;
- strong geological colour variation;
- clearly different palette and silhouette from Chlum and Nesměň;
- must read as a South Bohemian sedimentary collecting site, not a generic grey quarry.

### 4. KD Slávie — sběratelské finále

Visual identity:

- lively outdoor collector/event space;
- stalls, collectors, display cases, banners, parked cars and visitors;
- KD Slávie remains a recognizable background anchor rather than occupying the whole playable map;
- certification and final collection presentation form the gameplay focus.

## Chlum vertical-slice gate

Only Chlum is allowed to define the V7 visual pipeline first. Nesměň, Besednice and Slávie must not receive independent visual rewrites before the Chlum baseline is approved.

Chlum approval requires:

- authored terrain plate replacing the repeated ground/furrow presentation;
- smooth bounded player-follow camera;
- new production-quality player idle/walk presentation;
- visually consistent Václav;
- tractor integrated naturally into the field;
- foreground occlusion creating depth;
- clear interaction feedback;
- HUD composition compatible with the approved visual target;
- correct desktop, iPhone portrait and iPhone landscape presentation;
- intact gameplay flow: Václav → permission → search → finding → level completion.

## Non-goals for the first slice

Do not use the V7 visual rebuild as justification to rewrite unrelated quest rules, audio lifecycle, session semantics, all four level scripts, or deployment architecture.

Do not add a second renderer.

Do not reintroduce a Canvas gameplay runtime.

Do not create agent-specific production architectures.

## Acceptance principle

A green CI run is necessary but not sufficient. The Chlum slice is not approved until an actual rendered frame at gameplay scale is visually comparable to the approved reference direction and the game feels stable while the player moves through the scene.
