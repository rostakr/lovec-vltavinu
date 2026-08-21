import { TILE_SIZE, getTileColor, getTileHeight } from "./TileDefinitions.js";

export class IsometricRenderer {
  constructor(THREE) {
    this.THREE = THREE;
    this.meshes = new Map();
    this.group = new THREE.Group();
    this.group.name = "isometric-grid";
  }

  createTileGeometry() {
    const geometry = new THREE.BufferGeometry();
    const size = TILE_SIZE / 2;

    const vertices = new Float32Array([
      0, size, 0,           // top
      size, 0, 0,           // right
      0, -size, 0,          // bottom
      -size, 0, 0           // left
    ]);

    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    return geometry;
  }

  createTileMaterial(color) {
    return new this.THREE.MeshStandardMaterial({
      color,
      metalness: 0.1,
      roughness: 0.8,
      emissive: color,
      emissiveIntensity: 0.15
    });
  }

  renderGrid(grid) {
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const tileType = grid.getTile(x, y);
        const color = getTileColor(tileType);
        const height = getTileHeight(tileType);

        const key = `${x},${y}`;
        let mesh = this.meshes.get(key);

        if (!mesh) {
          const geometry = this.createTileGeometry();
          const material = this.createTileMaterial(color);
          mesh = new this.THREE.Mesh(geometry, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.group.add(mesh);
          this.meshes.set(key, mesh);
        }

        const { x: isoX, y: isoY } = grid.gridToIsometric(x, y);
        mesh.position.set(isoX, isoY, height * 2);
        mesh.userData.gridX = x;
        mesh.userData.gridY = y;
        mesh.userData.tileType = tileType;
        mesh.userData.height = height;
      }
    }

    return this.group;
  }

  updateTile(grid, x, y) {
    const key = `${x},${y}`;
    const mesh = this.meshes.get(key);
    if (!mesh) return;

    const tileType = grid.getTile(x, y);
    const color = getTileColor(tileType);
    const height = getTileHeight(tileType);

    if (mesh.material.color.getHex() !== color) {
      mesh.material.color.setHex(color);
      mesh.material.emissive.setHex(color);
    }
    mesh.position.z = height * 2;
    mesh.userData.tileType = tileType;
    mesh.userData.height = height;
  }

  highlightTile(x, y, active = true) {
    const key = `${x},${y}`;
    const mesh = this.meshes.get(key);
    if (!mesh) return;

    if (active) {
      mesh.material.emissiveIntensity = 0.5;
      mesh.scale.set(1.15, 1.15, 1.15);
    } else {
      mesh.material.emissiveIntensity = 0.15;
      mesh.scale.set(1, 1, 1);
    }
  }

  getTileAtScreenPoint(raycaster, camera, screenX, screenY) {
    const meshArray = Array.from(this.meshes.values());
    const intersects = raycaster.intersectObjects(meshArray);
    return intersects.length > 0 ? intersects[0].object.userData : null;
  }

  dispose() {
    for (const mesh of this.meshes.values()) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.meshes.clear();
    this.group.clear();
  }

  getGroup() {
    return this.group;
  }
}
