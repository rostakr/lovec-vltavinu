// Tile types for isometric grid-based levels (32×32 px per tile)
export const TILE_SIZE = 32;

export const TILE_TYPES = Object.freeze({
  // Terrain
  GRASS: "grass",
  GRASS_LIGHT: "grass-light",
  GRASS_DARK: "grass-dark",
  SAND: "sand",
  SAND_WET: "sand-wet",
  SOIL: "soil",
  CLAY: "clay",
  WATER: "water",
  WATER_EDGE: "water-edge",
  STONE: "stone",
  GRAVEL: "gravel",

  // Trees & vegetation
  TREE_SMALL: "tree-small",
  TREE_LARGE: "tree-large",
  BUSH: "bush",
  GRASS_TALL: "grass-tall",
  ROCK_SMALL: "rock-small",

  // Dig sites
  DIG_SITE: "dig-site",
  DIG_SITE_ACTIVE: "dig-site-active",

  // Boundaries
  FENCE: "fence",
  WALL: "wall",

  // Empty/void
  VOID: "void"
});

// Tile properties
const tileProps = {
  [TILE_TYPES.GRASS]: { walkable: true, solid: false, color: 0x7cb342, height: 0 },
  [TILE_TYPES.GRASS_LIGHT]: { walkable: true, solid: false, color: 0x9ccc65, height: 0 },
  [TILE_TYPES.GRASS_DARK]: { walkable: true, solid: false, color: 0x558b2f, height: 0 },
  [TILE_TYPES.SAND]: { walkable: true, solid: false, color: 0xd4a574, height: 0 },
  [TILE_TYPES.SAND_WET]: { walkable: true, solid: false, color: 0xbc9a6a, height: 0 },
  [TILE_TYPES.SOIL]: { walkable: true, solid: false, color: 0x795548, height: 0 },
  [TILE_TYPES.CLAY]: { walkable: true, solid: false, color: 0xa1887f, height: 0 },
  [TILE_TYPES.WATER]: { walkable: false, solid: true, color: 0x0277bd, height: 0 },
  [TILE_TYPES.WATER_EDGE]: { walkable: false, solid: true, color: 0x01579b, height: 0 },
  [TILE_TYPES.STONE]: { walkable: true, solid: false, color: 0x9e9e9e, height: 0 },
  [TILE_TYPES.GRAVEL]: { walkable: true, solid: false, color: 0xbdbdbd, height: 0 },
  [TILE_TYPES.TREE_SMALL]: { walkable: false, solid: true, color: 0x2e7d32, height: 2 },
  [TILE_TYPES.TREE_LARGE]: { walkable: false, solid: true, color: 0x1b5e20, height: 3 },
  [TILE_TYPES.BUSH]: { walkable: false, solid: true, color: 0x558b2f, height: 1 },
  [TILE_TYPES.GRASS_TALL]: { walkable: true, solid: false, color: 0x689f38, height: 0.5 },
  [TILE_TYPES.ROCK_SMALL]: { walkable: false, solid: true, color: 0x757575, height: 1 },
  [TILE_TYPES.DIG_SITE]: { walkable: true, solid: false, color: 0x8d6e63, height: 0 },
  [TILE_TYPES.DIG_SITE_ACTIVE]: { walkable: true, solid: false, color: 0xa1887f, height: 0 },
  [TILE_TYPES.FENCE]: { walkable: false, solid: true, color: 0x6d4c41, height: 1 },
  [TILE_TYPES.WALL]: { walkable: false, solid: true, color: 0x424242, height: 2 },
  [TILE_TYPES.VOID]: { walkable: false, solid: true, color: 0x000000, height: 0 }
};

export function getTileProps(type) {
  return tileProps[type] ?? tileProps[TILE_TYPES.VOID];
}

export function isTileWalkable(type) {
  return getTileProps(type).walkable;
}

export function isTileSolid(type) {
  return getTileProps(type).solid;
}

export function getTileColor(type) {
  return getTileProps(type).color;
}

export function getTileHeight(type) {
  return getTileProps(type).height;
}
