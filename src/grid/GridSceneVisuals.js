// Enhanced visual feedback and animations for grid gameplay

export class GridSceneVisuals {
  constructor(THREE, isometricRenderer) {
    this.THREE = THREE;
    this.isometricRenderer = isometricRenderer;
    this.highlightedTiles = new Map();
    this.animatingObjects = new Map();
    this.effectsGroup = new THREE.Group();
    this.effectsGroup.name = "grid-effects";
  }

  // Add to scene
  addToScene(group) {
    group.add(this.effectsGroup);
  }

  // Highlight walkable tiles around player
  highlightWalkableTiles(grid, playerX, playerY) {
    this.clearHighlights();

    const walkable = grid.getWalkableRegion(playerX, playerY);
    for (const { x, y } of walkable) {
      this.highlightTile(grid, x, y, "walkable");
    }
  }

  // Highlight single tile
  highlightTile(grid, gridX, gridY, tileType = "default") {
    const key = `${gridX},${gridY}`;

    if (this.highlightedTiles.has(key)) {
      this.clearHighlightTile(key);
    }

    const { x, y } = grid.gridToIsometric(gridX, gridY);
    const colors = {
      walkable: 0x90EE90,
      dangerous: 0xFF6B6B,
      interactive: 0xFFD700,
      target: 0x87CEEB,
      default: 0xFFFFFF
    };

    const color = colors[tileType] || colors.default;
    const geometry = new this.THREE.CircleGeometry(8, 6);
    const material = new this.THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.4,
      depthTest: false
    });

    const mesh = new this.THREE.Mesh(geometry, material);
    mesh.position.set(x, y, 1);
    this.effectsGroup.add(mesh);
    this.highlightedTiles.set(key, {
      mesh,
      tileType,
      createdAt: Date.now()
    });

    return mesh;
  }

  // Animate tile highlight
  animateHighlight(mesh, duration = 600) {
    const startOpacity = mesh.material.opacity;
    const startScale = mesh.scale.x;
    const startTime = Date.now();

    const update = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      mesh.material.opacity = startOpacity * (1 - progress * 0.5);
      mesh.scale.set(
        startScale * (1 + progress * 0.3),
        startScale * (1 + progress * 0.3),
        1
      );

      if (progress < 1) {
        this.animatingObjects.set(mesh.uuid, update);
      } else {
        this.animatingObjects.delete(mesh.uuid);
      }
    };

    this.animatingObjects.set(mesh.uuid, update);
  }

  // Clear highlight on single tile
  clearHighlightTile(key) {
    const highlight = this.highlightedTiles.get(key);
    if (highlight) {
      this.effectsGroup.remove(highlight.mesh);
      this.animatingObjects.delete(highlight.mesh.uuid);
      this.highlightedTiles.delete(key);
    }
  }

  // Clear all highlights
  clearHighlights() {
    for (const [key, highlight] of this.highlightedTiles) {
      this.effectsGroup.remove(highlight.mesh);
      this.animatingObjects.delete(highlight.mesh.uuid);
    }
    this.highlightedTiles.clear();
  }

  // Create dig effect at position
  createDigEffect(grid, gridX, gridY, intensity = 1) {
    const { x, y } = grid.gridToIsometric(gridX, gridY);

    // Impact ring
    const ringGeometry = new this.THREE.RingGeometry(5, 12, 16);
    const ringMaterial = new this.THREE.MeshBasicMaterial({
      color: 0x8B7355,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
      side: this.THREE.DoubleSide
    });
    const ring = new this.THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.set(x, y, 2);
    this.effectsGroup.add(ring);

    // Dust particles
    const particleCount = Math.floor(8 * intensity);
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const distance = 15 + Math.random() * 10;
      const vx = Math.cos(angle) * distance;
      const vy = Math.sin(angle) * distance;
      const vz = 20 + Math.random() * 20;

      const particle = this.createDustParticle(x, y, vx, vy, vz);
      this.effectsGroup.add(particle);
      this.animatingObjects.set(particle.uuid, () => this.updateParticle(particle));
    }

    // Animate ring
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / 300, 1);

      ring.scale.set(
        1 + progress * 1.5,
        1 + progress * 1.5,
        1
      );
      ring.material.opacity = 0.6 * (1 - progress);

      if (progress < 1) {
        this.animatingObjects.set(ring.uuid, animate);
      } else {
        this.effectsGroup.remove(ring);
        this.animatingObjects.delete(ring.uuid);
      }
    };

    this.animatingObjects.set(ring.uuid, animate);
  }

  // Create simple dust particle
  createDustParticle(x, y, vx, vy, vz) {
    const size = 2 + Math.random() * 3;
    const geometry = new this.THREE.CircleGeometry(size, 4);
    const material = new this.THREE.MeshBasicMaterial({
      color: 0xA0826D,
      transparent: true,
      opacity: 0.7,
      depthTest: false
    });

    const particle = new this.THREE.Mesh(geometry, material);
    particle.position.set(x, y, 5);
    particle.userData = {
      velocity: { x: vx * 0.02, y: vy * 0.02, z: vz * 0.03 },
      gravity: -0.3,
      life: 600,
      createdAt: Date.now()
    };

    return particle;
  }

  // Update particle physics
  updateParticle(particle) {
    const now = Date.now();
    const elapsed = now - particle.userData.createdAt;
    const life = particle.userData.life;
    const progress = elapsed / life;

    if (progress >= 1) {
      this.effectsGroup.remove(particle);
      return;
    }

    const vel = particle.userData.velocity;
    vel.z += particle.userData.gravity;

    particle.position.x += vel.x;
    particle.position.y += vel.y;
    particle.position.z += vel.z;

    particle.material.opacity = 0.7 * (1 - progress);
  }

  // Create movement arrow indicator
  createMovementIndicator(grid, fromX, fromY, toX, toY) {
    const from = grid.gridToIsometric(fromX, fromY);
    const to = grid.gridToIsometric(toX, toY);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 0.1) return null;

    // Arrow line
    const points = [
      new this.THREE.Vector3(from.x, from.y, 1),
      new this.THREE.Vector3(to.x, to.y, 1)
    ];

    const geometry = new this.THREE.BufferGeometry().setFromPoints(points);
    const material = new this.THREE.LineBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.6,
      linewidth: 2,
      depthTest: false
    });

    const line = new this.THREE.Line(geometry, material);
    this.effectsGroup.add(line);

    // Animate fade-out
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / 200, 1);

      material.opacity = 0.6 * (1 - progress);

      if (progress < 1) {
        this.animatingObjects.set(line.uuid, animate);
      } else {
        this.effectsGroup.remove(line);
        this.animatingObjects.delete(line.uuid);
      }
    };

    this.animatingObjects.set(line.uuid, animate);
    return line;
  }

  // Highlight dig site
  highlightDigSite(grid, gridX, gridY) {
    return this.highlightTile(grid, gridX, gridY, "interactive");
  }

  // Highlight NPC
  highlightNPC(grid, gridX, gridY) {
    return this.highlightTile(grid, gridX, gridY, "target");
  }

  // Update all animations
  update() {
    for (const animate of this.animatingObjects.values()) {
      animate();
    }
  }

  // Dispose all visuals
  dispose() {
    this.clearHighlights();
    this.effectsGroup.clear();
    for (const mesh of this.effectsGroup.children) {
      mesh.geometry?.dispose();
      mesh.material?.dispose();
    }
  }
}
