export function createWaterOverlay(THREE, bounds, options = {}) {
  const geometry = new THREE.PlaneGeometry(bounds.width, bounds.height, 32, 16);

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform float uOpacity;
    varying vec2 vUv;

    void main() {
      float wave1 = sin(vUv.x * 4.0 + uTime * 0.8) * 0.015;
      float wave2 = sin(vUv.y * 3.0 - uTime * 0.6) * 0.01;
      float waves = wave1 + wave2;

      float opacity = uOpacity * (0.3 + 0.2 * sin(uTime * 0.5));

      gl_FragColor = vec4(0.15, 0.35, 0.4, opacity);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uOpacity: { value: options.opacity ?? 0.25 }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
    options.z ?? 8
  );
  mesh.name = "water-overlay";

  return {
    object: mesh,
    geometry,
    material,
    update(dt) {
      material.uniforms.uTime.value += dt;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.removeFromParent();
    }
  };
}
