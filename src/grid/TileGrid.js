import { TILE_TYPES, TILE_SIZE, isTileWalkable } from "./TileDefinitions.js";

export class TileGrid {
  constructor(width, height, defaultTile = TILE_TYPES.VOID) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.tiles = new Array(this.width * this.height).fill(defaultTile);
    this.metadata = new Map();
  }

  getIndex(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return -1;
    return y * this.width + x;
  }

  getTile(x, y) {
    const index = this.getIndex(x, y);
    return index === -1 ? TILE_TYPES.VOID : this.tiles[index];
  }

  setTile(x, y, tileType) {
    const index = this.getIndex(x, y);
    if (index !== -1) this.tiles[index] = tileType;
  }

  setMetadata(x, y, key, value) {
    const cellKey = `${x},${y}`;
    if (!this.metadata.has(cellKey)) this.metadata.set(cellKey, {});
    this.metadata.get(cellKey)[key] = value;
  }

  getMetadata(x, y, key) {
    const cellKey = `${x},${y}`;
    return this.metadata.get(cellKey)?.[key];
  }

  fill(tileType) {
    this.tiles.fill(tileType);
  }

  fillRect(x, y, width, height, tileType) {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        this.setTile(x + dx, y + dy, tileType);
      }
    }
  }

  isWalkable(x, y) {
    return isTileWalkable(this.getTile(x, y));
  }

  canWalkPath(startX, startY, endX, endY) {
    if (!this.isWalkable(startX, startY) || !this.isWalkable(endX, endY)) return false;
    const dx = Math.abs(endX - startX);
    const dy = Math.abs(endY - startY);
    const sx = startX < endX ? 1 : -1;
    const sy = startY < endY ? 1 : -1;
    let x = startX, y = startY;
    const err = dx - dy;

    while (true) {
      if (x === endX && y === endY) return true;
      if (!this.isWalkable(x, y)) return false;
      const e2 = 2 * err;
      if (e2 > -dy) err -= dy, x += sx;
      if (e2 < dx) err += dx, y += sy;
    }
  }

  getWalkableRegion(startX, startY) {
    const visited = new Set();
    const queue = [[startX, startY]];
    const region = [];

    while (queue.length > 0) {
      const [x, y] = queue.shift();
      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      if (!this.isWalkable(x, y)) continue;

      visited.add(key);
      region.push({ x, y });

      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    return region;
  }

  worldToGrid(worldX, worldY) {
    return {
      x: Math.floor(worldX / TILE_SIZE),
      y: Math.floor(worldY / TILE_SIZE)
    };
  }

  gridToWorld(gridX, gridY) {
    return {
      x: gridX * TILE_SIZE + TILE_SIZE / 2,
      y: gridY * TILE_SIZE + TILE_SIZE / 2
    };
  }

  gridToIsometric(gridX, gridY) {
    const isoX = (gridX - gridY) * (TILE_SIZE / 2);
    const isoY = (gridX + gridY) * (TILE_SIZE / 4);
    return { x: isoX, y: isoY };
  }

  isometricToGrid(isoX, isoY) {
    const gridX = (isoX / (TILE_SIZE / 2) + isoY / (TILE_SIZE / 4)) / 2;
    const gridY = (isoY / (TILE_SIZE / 4) - isoX / (TILE_SIZE / 2)) / 2;
    return { x: Math.round(gridX), y: Math.round(gridY) };
  }

  getNeighbors(x, y, includeDiagonals = false) {
    const neighbors = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 }
    ];
    if (includeDiagonals) {
      neighbors.push(
        { x: x + 1, y: y + 1 },
        { x: x - 1, y: y - 1 },
        { x: x + 1, y: y - 1 },
        { x: x - 1, y: y + 1 }
      );
    }
    return neighbors.filter(({ x: nx, y: ny }) => this.isWalkable(nx, ny));
  }

  snapshot() {
    return {
      width: this.width,
      height: this.height,
      tiles: [...this.tiles],
      metadata: new Map(this.metadata)
    };
  }
}
