const LOCALITY_PROFILES = Object.freeze({
  chlum: Object.freeze({
    color: 0x315f38,
    emissive: 0x0b2011,
    roughness: 0.5,
    emissiveIntensity: 0.24,
    deformation: 0.24,
    spike: 0.03,
    shape: Object.freeze([1.08, 0.9, 0.72]),
    scale: Object.freeze([5, 4, 3])
  }),
  nesmen: Object.freeze({
    color: 0x394f2b,
    emissive: 0x0c1809,
    roughness: 0.62,
    emissiveIntensity: 0.18,
    deformation: 0.21,
    spike: 0.05,
    shape: Object.freeze([1.02, 0.94, 0.78]),
    scale: Object.freeze([4.9, 4.25, 3.2])
  }),
  besednice: Object.freeze({
    color: 0x3d6d35,
    emissive: 0x102612,
    roughness: 0.46,
    emissiveIntensity: 0.26,
    deformation: 0.31,
    spike: 0.2,
    shape: Object.freeze([1.2, 0.96, 0.66]),
    scale: Object.freeze([6.2, 5.2, 3.6])
  })
});

const RARITY_PROFILES = Object.freeze({
  C: Object.freeze({ scale: 0.9, deformation: 0.9, tint: 0.9 }),
  B: Object.freeze({ scale: 1, deformation: 1, tint: 1 }),
  A: Object.freeze({ scale: 1.12, deformation: 1.12, tint: 1.08 })
});

const clampByte = value => Math.max(0, Math.min(255, Math.round(value)));

function tintHex(hex, factor) {
  const r = clampByte(((hex >> 16) & 0xff) * factor);
  const g = clampByte(((hex >> 8) & 0xff) * factor);
  const b = clampByte((hex & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

function normalizeSeed(seed) {
  const numeric = Number(seed);
  if (!Number.isFinite(numeric)) return 0;
  return Math.trunc(numeric) >>> 0;
}

function seededNoise(x, y, z, seed, salt = 0) {
  const value = Math.sin(
    x * 12.9898 +
    y * 78.233 +
    z * 37.719 +
    normalizeSeed(seed) * 0.000173 +
    salt * 19.193
  ) * 43758.5453;
  return value - Math.floor(value);
}

function normalizeScale(scale, fallback) {
  if (Array.isArray(scale) && scale.length >= 3) {
    return scale.slice(0, 3).map((value, index) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback[index];
    });
  }
  const scalar = Number(scale);
  if (Number.isFinite(scalar) && scalar > 0) return fallback.map(value => value * scalar);
  return [...fallback];
}

export function createProceduralMoldavite(THREE, options = {}) {
  if (!THREE?.IcosahedronGeometry || !THREE?.MeshStandardMaterial || !THREE?.Mesh) {
    throw new TypeError("Procedural moldavite requires Three.js mesh primitives.");
  }

  const locality = LOCALITY_PROFILES[options.locality] ? options.locality : "chlum";
  const rarity = RARITY_PROFILES[options.rarity] ? options.rarity : "B";
  const seed = normalizeSeed(options.seed);
  const localityProfile = LOCALITY_PROFILES[locality];
  const rarityProfile = RARITY_PROFILES[rarity];
  const deformation = localityProfile.deformation * rarityProfile.deformation;
  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const position = geometry.attributes?.position;
  if (!position?.getX || !position?.setXYZ) {
    geometry.dispose?.();
    throw new TypeError("Procedural moldavite geometry must expose positions.");
  }

  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const surface = seededNoise(x, y, z, seed, 1);
    const ridge = seededNoise(x * 1.73, y * 1.37, z * 1.91, seed, 2);
    const spike = localityProfile.spike * Math.pow(Math.max(0, ridge - 0.52) / 0.48, 2);
    const radial = 0.82 + surface * deformation + spike;
    position.setXYZ(
      index,
      x * radial * localityProfile.shape[0],
      y * radial * localityProfile.shape[1],
      z * radial * localityProfile.shape[2]
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals?.();
  geometry.computeBoundingSphere?.();

  const baseColor = options.color ?? localityProfile.color;
  const material = new THREE.MeshStandardMaterial({
    color: options.color ?? tintHex(baseColor, rarityProfile.tint),
    emissive: options.emissive ?? localityProfile.emissive,
    emissiveIntensity: options.emissiveIntensity ?? localityProfile.emissiveIntensity,
    roughness: options.roughness ?? localityProfile.roughness,
    metalness: options.metalness ?? 0.02,
    transparent: true,
    opacity: options.opacity ?? 0.96
  });

  const mesh = new THREE.Mesh(geometry, material);
  const scale = normalizeScale(options.scale, localityProfile.scale).map(value => value * rarityProfile.scale);
  mesh.name = `${locality}-v7-moldavite-finding`;
  mesh.position.z = options.z ?? 14;
  mesh.rotation.x = options.rotationX ?? 0.28;
  mesh.rotation.y = options.rotationY ?? -0.36;
  mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.userData.assetId = `procedural-${locality}-moldavite-v7`;
  mesh.userData.findingVisual = "moldavite";
  mesh.userData.proceduralMoldavite = Object.freeze({ locality, rarity, seed, deformation });
  return mesh;
}

export function getProceduralMoldaviteProfile(locality = "chlum", rarity = "B") {
  const localityProfile = LOCALITY_PROFILES[locality] ?? LOCALITY_PROFILES.chlum;
  const rarityProfile = RARITY_PROFILES[rarity] ?? RARITY_PROFILES.B;
  return Object.freeze({
    locality: LOCALITY_PROFILES[locality] ? locality : "chlum",
    rarity: RARITY_PROFILES[rarity] ? rarity : "B",
    deformation: localityProfile.deformation * rarityProfile.deformation,
    scale: localityProfile.scale.map(value => value * rarityProfile.scale)
  });
}
