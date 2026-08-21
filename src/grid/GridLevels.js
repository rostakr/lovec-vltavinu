import { TileGrid } from "./TileGrid.js";
import { TILE_TYPES } from "./TileDefinitions.js";
import { TILE_SIZE } from "./TileDefinitions.js";

export function createChlumGrid() {
  const grid = new TileGrid(50, 37);
  grid.fill(TILE_TYPES.GRASS);

  grid.fillRect(0, 0, 50, 5, TILE_TYPES.VOID);
  grid.fillRect(0, 32, 50, 5, TILE_TYPES.VOID);
  grid.fillRect(0, 0, 5, 37, TILE_TYPES.VOID);
  grid.fillRect(45, 0, 5, 37, TILE_TYPES.VOID);

  grid.fillRect(10, 8, 30, 20, TILE_TYPES.SOIL);
  grid.fillRect(18, 16, 14, 8, TILE_TYPES.GRASS_DARK);
  grid.fillRect(22, 18, 6, 4, TILE_TYPES.SAND);

  for (let i = 0; i < 5; i++) {
    grid.setTile(5 + i * 8, 10, TILE_TYPES.TREE_SMALL);
    grid.setTile(5 + i * 8, 25, TILE_TYPES.TREE_SMALL);
  }

  grid.setMetadata(25, 18, "type", "dig-site");
  grid.setMetadata(25, 18, "objective", "chlum-search-site");
  grid.setMetadata(12, 12, "type", "npc");
  grid.setMetadata(12, 12, "npc", "farmer-vaclav");

  return grid;
}

export function createNesmenGrid() {
  const grid = new TileGrid(47, 37);
  grid.fill(TILE_TYPES.GRASS_DARK);

  grid.fillRect(0, 0, 47, 5, TILE_TYPES.VOID);
  grid.fillRect(0, 32, 47, 5, TILE_TYPES.VOID);
  grid.fillRect(0, 0, 4, 37, TILE_TYPES.VOID);
  grid.fillRect(43, 0, 4, 37, TILE_TYPES.VOID);

  grid.fillRect(8, 10, 31, 18, TILE_TYPES.SOIL);

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      grid.setTile(15 + i * 10, 14 + j * 8, TILE_TYPES.DIG_SITE);
      grid.setMetadata(15 + i * 10, 14 + j * 8, "type", "dig-site");
      grid.setMetadata(15 + i * 10, 14 + j * 8, "index", i * 2 + j);
    }
  }

  for (let x = 7; x < 40; x++) {
    if (Math.random() > 0.7) grid.setTile(x, 8, TILE_TYPES.TREE_LARGE);
    if (Math.random() > 0.8) grid.setTile(x, 29, TILE_TYPES.BUSH);
  }

  grid.setMetadata(10, 22, "type", "npc");
  grid.setMetadata(10, 22, "npc", "forester-jan");

  return grid;
}

export function createBesedniceGrid() {
  const grid = new TileGrid(50, 40);
  grid.fill(TILE_TYPES.CLAY);

  grid.fillRect(0, 0, 50, 4, TILE_TYPES.VOID);
  grid.fillRect(0, 36, 50, 4, TILE_TYPES.VOID);
  grid.fillRect(0, 0, 4, 40, TILE_TYPES.VOID);
  grid.fillRect(46, 0, 4, 40, TILE_TYPES.VOID);

  grid.fillRect(12, 10, 26, 20, TILE_TYPES.SAND);
  grid.fillRect(15, 20, 20, 8, TILE_TYPES.SOIL);

  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 3; j++) {
      grid.setTile(17 + i * 14, 16 + j * 6, TILE_TYPES.ROCK_SMALL);
      grid.setMetadata(17 + i * 14, 16 + j * 6, "type", "trace-marker");
      grid.setMetadata(17 + i * 14, 16 + j * 6, "index", i * 3 + j);
    }
  }

  grid.fillRect(35, 18, 8, 8, TILE_TYPES.SAND_WET);
  grid.setMetadata(39, 22, "type", "hedgehog");
  grid.setMetadata(39, 22, "entity", "hedgehog-marker");

  grid.setMetadata(8, 30, "type", "npc");
  grid.setMetadata(8, 30, "npc", "rival-karel");

  return grid;
}

export function createSlaviaGrid() {
  const grid = new TileGrid(56, 45);
  grid.fill(TILE_TYPES.STONE);

  grid.fillRect(0, 0, 56, 5, TILE_TYPES.VOID);
  grid.fillRect(0, 40, 56, 5, TILE_TYPES.VOID);
  grid.fillRect(0, 0, 5, 45, TILE_TYPES.VOID);
  grid.fillRect(51, 0, 5, 45, TILE_TYPES.VOID);

  grid.fillRect(25, 15, 6, 25, TILE_TYPES.WATER);
  grid.fillRect(24, 15, 1, 25, TILE_TYPES.WATER_EDGE);
  grid.fillRect(31, 15, 1, 25, TILE_TYPES.WATER_EDGE);

  grid.fillRect(10, 12, 12, 12, TILE_TYPES.GRASS_LIGHT);
  grid.fillRect(34, 12, 12, 12, TILE_TYPES.GRASS_LIGHT);

  for (let i = 0; i < 4; i++) {
    grid.setTile(12 + i * 2, 10, TILE_TYPES.TREE_SMALL);
    grid.setTile(36 + i * 2, 10, TILE_TYPES.TREE_SMALL);
  }

  for (let i = 0; i < 6; i++) {
    grid.setMetadata(12 + i * 2, 18 + i % 2, "type", "document");
    grid.setMetadata(12 + i * 2, 18 + i % 2, "index", i);
  }

  grid.setMetadata(20, 28, "type", "npc");
  grid.setMetadata(20, 28, "npc", "expert-eva");
  grid.setMetadata(28, 32, "type", "npc");
  grid.setMetadata(28, 32, "npc", "thief-franta");

  return grid;
}

export function getGridLevel(levelId) {
  const creators = {
    chlum: createChlumGrid,
    nesmen: createNesmenGrid,
    besednice: createBesedniceGrid,
    slavia: createSlaviaGrid
  };
  const creator = creators[levelId];
  return creator ? creator() : null;
}

export function gridSizeToWorldBounds(grid) {
  return {
    x: 0,
    y: 0,
    width: grid.width * TILE_SIZE,
    height: grid.height * TILE_SIZE
  };
}

export function getSpawnPoint(levelId) {
  const spawns = {
    chlum: { gridX: 8, gridY: 20 },
    nesmen: { gridX: 6, gridY: 30 },
    besednice: { gridX: 10, gridY: 25 },
    slavia: { gridX: 28, gridY: 10 }
  };
  return spawns[levelId] ?? { gridX: 5, gridY: 5 };
}
