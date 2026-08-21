const TAU = Math.PI * 2;
const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

function materialList(object) {
  const materials = [];
  object?.traverse?.(node => {
    const values = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of values) {
      if (material && !materials.includes(material)) materials.push(material);
    }
  });
  if (!object?.traverse && object?.material) {
    const values = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of values) {
      if (material && !materials.includes(material)) materials.push(material);
    }
  }
  return materials;
}

export function createIdleWrapper(THREE, visual, options = {}) {
  if (!THREE?.Group || !visual) throw new TypeError("Idle wrapper requires Three.js Group and a visual object.");
  const group = new THREE.Group();
  group.name = options.name ?? "npc-idle-wrapper";
  group.add(visual);
  group.userData.idlePulse = Object.freeze({
    amplitude: Math.max(0, Number(options.amplitude) || 0.02),
    frequency: Math.max(0, Number(options.frequency) || 1.45),
    phase: Number(options.phase) || 0,
    baseScaleY: group.scale.y || 1
  });
  return group;
}

export function updateIdlePulse(group, timeSeconds, strength = 1) {
  const config = group?.userData?.idlePulse;
  if (!config) return false;
  const safeStrength = Math.max(0, Number(strength) || 0);
  const pulse = Math.sin((Number(timeSeconds) || 0) * config.frequency * TAU + config.phase);
  group.scale.y = config.baseScaleY * (1 + pulse * config.amplitude * safeStrength);
  return true;
}

export function resetIdlePulse(group) {
  const config = group?.userData?.idlePulse;
  if (!config) return false;
  group.scale.y = config.baseScaleY;
  return true;
}

export function createPickupTween(object, options = {}) {
  if (!object?.scale) return null;
  const duration = Math.max(0.001, Number(options.duration) || 0.15);
  const targetScale = Math.max(1, Number(options.targetScale) || 1.25);
  const materials = materialList(object).map(material => ({
    material,
    opacity: Number.isFinite(material.opacity) ? material.opacity : 1,
    transparent: material.transparent === true
  }));
  for (const entry of materials) entry.material.transparent = true;
  return {
    object,
    duration,
    targetScale,
    elapsed: 0,
    baseScale: { x: object.scale.x, y: object.scale.y, z: object.scale.z },
    materials,
    complete: false
  };
}

export function updatePickupTween(tween, dt) {
  if (!tween || tween.complete) return Boolean(tween?.complete);
  tween.elapsed = Math.min(tween.duration, tween.elapsed + Math.max(0, Number(dt) || 0));
  const progress = clamp01(tween.elapsed / tween.duration);
  const eased = 1 - Math.pow(1 - progress, 3);
  const scaleFactor = 1 + (tween.targetScale - 1) * eased;
  tween.object.scale.set(
    tween.baseScale.x * scaleFactor,
    tween.baseScale.y * scaleFactor,
    tween.baseScale.z * scaleFactor
  );
  for (const entry of tween.materials) {
    entry.material.opacity = entry.opacity * (1 - progress);
    entry.material.needsUpdate = true;
  }
  tween.complete = progress >= 1;
  return tween.complete;
}

export function cancelPickupTween(tween, options = {}) {
  if (!tween) return false;
  if (options.restore === true) {
    tween.object?.scale?.set?.(tween.baseScale.x, tween.baseScale.y, tween.baseScale.z);
    for (const entry of tween.materials) {
      entry.material.opacity = entry.opacity;
      entry.material.transparent = entry.transparent;
      entry.material.needsUpdate = true;
    }
  }
  tween.complete = true;
  return true;
}
