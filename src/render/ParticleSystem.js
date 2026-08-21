const TAU = Math.PI * 2;
const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export function createParticleEmitter(THREE, options = {}) {
  if (!THREE?.Points || !THREE?.BufferGeometry || !THREE?.PointsMaterial) {
    throw new TypeError("Particle emitter requires Three.js Points, BufferGeometry, and PointsMaterial.");
  }

  const maxParticles = Math.max(1, Number(options.maxParticles) || 100);
  const geometry = new THREE.BufferGeometry();

  const positions = new Float32Array(maxParticles * 3);
  const velocities = new Float32Array(maxParticles * 3);
  const lifetimes = new Float32Array(maxParticles);
  const maxLifetimes = new Float32Array(maxParticles);
  const sizes = new Float32Array(maxParticles);

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    opacity: 1
  });

  const points = new THREE.Points(geometry, material);
  points.name = "particle-emitter";
  points.userData.particleConfig = {
    maxParticles,
    activeCount: 0,
    gravity: options.gravity ?? { x: 0, y: -1.5, z: 0 },
    drag: options.drag ?? 0.92,
    sizeDecay: options.sizeDecay ?? true
  };

  return {
    object: points,
    geometry,
    material,
    positions,
    velocities,
    lifetimes,
    maxLifetimes,
    sizes,
    config: points.userData.particleConfig,
    emitBurst(x, y, z, count = 8, options = {}) {
      const config = this.config;
      const startIdx = config.activeCount;
      count = Math.min(count, config.maxParticles - startIdx);

      const speed = options.speed ?? 3;
      const spread = options.spread ?? 0.6;
      const lifetime = options.lifetime ?? 0.4;
      const size = options.size ?? 1;

      for (let i = 0; i < count; i++) {
        const idx = startIdx + i;
        const angle = Math.random() * TAU;
        const elevation = (Math.random() - 0.5) * Math.PI;
        const vel = speed * (0.5 + Math.random() * spread);

        this.positions[idx * 3 + 0] = x;
        this.positions[idx * 3 + 1] = y;
        this.positions[idx * 3 + 2] = z;

        this.velocities[idx * 3 + 0] = Math.cos(angle) * Math.cos(elevation) * vel;
        this.velocities[idx * 3 + 1] = Math.sin(elevation) * vel;
        this.velocities[idx * 3 + 2] = Math.sin(angle) * Math.cos(elevation) * vel;

        this.lifetimes[idx] = 0;
        this.maxLifetimes[idx] = lifetime;
        this.sizes[idx] = size;
      }

      config.activeCount = Math.min(config.maxParticles, startIdx + count);
      this.geometry.attributes.position.needsUpdate = true;
    },
    update(dt) {
      const config = this.config;
      dt = Math.max(0, Number(dt) || 0);

      let writeIdx = 0;
      const gravX = config.gravity.x * dt;
      const gravY = config.gravity.y * dt;
      const gravZ = config.gravity.z * dt;
      const drag = config.drag;

      for (let i = 0; i < config.activeCount; i++) {
        this.lifetimes[i] += dt;
        const maxLife = this.maxLifetimes[i];

        if (this.lifetimes[i] >= maxLife) {
          continue;
        }

        const idx = i * 3;
        this.velocities[idx + 0] *= drag;
        this.velocities[idx + 1] *= drag;
        this.velocities[idx + 2] *= drag;

        this.velocities[idx + 0] += gravX;
        this.velocities[idx + 1] += gravY;
        this.velocities[idx + 2] += gravZ;

        this.positions[idx + 0] += this.velocities[idx + 0] * dt;
        this.positions[idx + 1] += this.velocities[idx + 1] * dt;
        this.positions[idx + 2] += this.velocities[idx + 2] * dt;

        const progress = this.lifetimes[i] / maxLife;
        const writePos = writeIdx * 3;
        this.positions[writePos + 0] = this.positions[idx + 0];
        this.positions[writePos + 1] = this.positions[idx + 1];
        this.positions[writePos + 2] = this.positions[idx + 2];

        this.lifetimes[writeIdx] = this.lifetimes[i];
        this.maxLifetimes[writeIdx] = maxLife;
        this.sizes[writeIdx] = this.sizes[i] * (1 - progress * (config.sizeDecay ? 0.8 : 0));

        writeIdx++;
      }

      config.activeCount = writeIdx;
      this.geometry.attributes.position.needsUpdate = true;

      if (this.geometry.attributes.size) {
        this.geometry.attributes.size.array = this.sizes;
        this.geometry.attributes.size.needsUpdate = true;
      }

      if (writeIdx === 0) {
        this.object.visible = false;
      } else {
        this.object.visible = true;
        this.geometry.setDrawRange(0, writeIdx);
      }
    },
    dispose() {
      this.geometry.dispose();
      this.material.dispose();
      this.object.removeFromParent();
    }
  };
}

export function createDustEmitter(THREE, options = {}) {
  const emitter = createParticleEmitter(THREE, {
    maxParticles: options.maxParticles ?? 40,
    gravity: { x: 0, y: -0.3, z: 0 },
    drag: options.drag ?? 0.94,
    sizeDecay: true
  });

  emitter.material.color.setHex(options.color ?? 0x8B7355);
  emitter.material.size = options.size ?? 3;
  emitter.material.sizeAttenuation = true;

  return emitter;
}

export function createSparkleEmitter(THREE, options = {}) {
  const emitter = createParticleEmitter(THREE, {
    maxParticles: options.maxParticles ?? 30,
    gravity: { x: 0, y: -1.2, z: 0 },
    drag: options.drag ?? 0.88,
    sizeDecay: true
  });

  emitter.material.color.setHex(options.color ?? 0x2f6038);
  emitter.material.size = options.size ?? 2;
  emitter.material.sizeAttenuation = true;

  return emitter;
}
