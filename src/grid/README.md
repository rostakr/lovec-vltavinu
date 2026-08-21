# Grid-Based Isometric Level System

A complete 32×32 tile-based grid system with isometric rendering for the Moldavite Hunter game.

## Architecture

### Core Modules

**TileDefinitions.js**
- Defines 19 tile types (terrain, vegetation, objects)
- Each tile has properties: walkable, solid, color, height
- Supports procedural tile rendering and collision queries

**TileGrid.js**
- 2D grid management with unlimited size
- Coordinate conversion: world ↔ grid ↔ isometric
- Pathfinding: line-of-sight, flood fill, walkable region detection
- Metadata storage for entities and interactions

**IsometricRenderer.js**
- Three.js-based isometric tile rendering
- Diamond-shaped geometry (32×32 px per tile)
- Proper depth ordering with Z-position
- Mesh pooling and efficient updates
- Raycasting for click detection on tiles

**GridLevels.js**
- Pre-generated level layouts for all four locations
- Procedural terrain generation from tile definitions
- Entity metadata embedding (NPCs, dig sites, documents)
- Spawn point definitions per level

**CharacterSprites.js**
- Canvas-based procedural character sprites
- 8-directional orientation support
- Hunter (main character) + 5 NPC types
- Object sprites (rocks, trees, bushes, dig sites)
- No external image dependencies

**GridScene.js**
- Base scene class for grid-based gameplay
- 8-directional movement (cardinal + diagonal)
- Interaction system for adjacent tiles
- Dialog system for NPCs
- Dig site mechanics with UI integration
- Document collection
- Camera management with isometric projection
- Pause/resume functionality

### Level Scenes

Each level has a dedicated GridScene variant:
- **ChlumGridScene** - 50×37 field with dig sites
- **NesmenGridScene** - 47×37 forest with dig profiles
- **BesedniceGridScene** - 50×40 quarry with traces
- **SlaviaGridScene** - 56×45 plaza with documents and river

## Gameplay Features

### Movement
- Player moves one grid cell per input
- 8 directions supported (N, NE, E, SE, S, SW, W, NW)
- Collision detection prevents walking through obstacles
- Walkable regions computed on level load

### Interactions
- Interact with adjacent tiles (up to 8 surrounding cells)
- NPC dialog system with text and responses
- Dig site system for excavation gameplay
- Document collection and tracking

### Level Layout
- Terrain: grass, sand, soil, clay, water
- Vegetation: trees (small/large), bushes, rocks
- Objects: dig sites, NPCs, documents, markers
- Boundaries: fences, walls, void areas

## Usage

### Starting a Grid Scene
```javascript
// Via debug API
window.__lovecRuntime.playGridScene('chlum');  // Play Chlum on grid
window.__lovecRuntime.playGridScene('nesmen');
window.__lovecRuntime.playGridScene('besednice');
window.__lovecRuntime.playGridScene('slavia');

// Via scene management
await app.changeScene('chlum-grid');
await app.changeScene('nesmen-grid');
```

### Creating Custom Levels
```javascript
import { TileGrid, TILE_TYPES } from './grid/index.js';

const grid = new TileGrid(50, 50);
grid.fillRect(0, 0, 50, 50, TILE_TYPES.GRASS);
grid.fillRect(10, 10, 30, 30, TILE_TYPES.SOIL);

// Add metadata for interactions
grid.setMetadata(25, 15, 'type', 'dig-site');
grid.setMetadata(10, 10, 'type', 'npc');
grid.setMetadata(10, 10, 'npc', 'farmer-vaclav');
```

### Rendering a Grid
```javascript
import { IsometricRenderer } from './grid/index.js';

const renderer = new IsometricRenderer(THREE);
const group = renderer.renderGrid(grid);
scene.add(group);

// Update individual tiles
renderer.updateTile(grid, 10, 10);

// Highlight for selection
renderer.highlightTile(10, 10, true);
```

## Technical Details

### Coordinate Systems

**World Coordinates**
- Continuous pixel space used by most game systems
- Origin at top-left
- Used for camera positioning

**Grid Coordinates**
- Integer coordinates (x, y) in the grid
- Origin at top-left of grid
- One unit = 32 pixels in world space

**Isometric Coordinates**
- Projected 2D screen coordinates for rendering
- Calculated from grid coordinates using 45° rotation
- X' = (X - Y) × 16
- Y' = (X + Y) × 8

### Tile Properties

Each tile has:
- `walkable`: Boolean, whether player can stand on it
- `solid`: Boolean, whether it blocks pathing/movement
- `color`: Hex color for rendering
- `height`: Z-offset for layering

## Performance Considerations

- Mesh pooling prevents memory growth with large grids
- Update-only rendering for dynamic tiles
- Raycasting optimized with spatial partitioning
- Pathfinding uses efficient flood-fill algorithm
- Metadata stored separately from tile grid (sparse storage)

## Future Extensions

- Multiple layers for depth (roof tiles, underground)
- Animated tiles (water, vegetation)
- Dynamic lighting
- Particle system integration
- Sound feedback on tile interaction
- Save/load system for custom levels
