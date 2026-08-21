import { HybridRenderer } from "./HybridRenderer.js";

const positiveInteger = (value, fallback = 1) => {
  const parsed = Math.floor(Number(value));
  return parsed > 0 ? parsed : fallback;
};

export function resolveSpriteFrameUv(frame, columns, rows) {
  const safeColumns = positiveInteger(columns);
  const safeRows = positiveInteger(rows);
  const total = safeColumns * safeRows;
  const safeFrame = ((Math.floor(Number(frame) || 0) % total) + total) % total;
  const column = safeFrame % safeColumns;
  const row = Math.floor(safeFrame / safeColumns);
  return {
    frame: safeFrame,
    repeatX: 1 / safeColumns,
    repeatY: 1 / safeRows,
    offsetX: column / safeColumns,
    offsetY: 1 - (row + 1) / safeRows
  };
}

export function syncSpriteVisual(object, sprite) {
  if (!object?.isSprite || !sprite) return false;
  const texture = object.material?.map;
  if (!texture?.repeat?.set || !texture?.offset?.set) return false;
  const inferredColumns = texture.repeat.x > 0 ? Math.round(1 / texture.repeat.x) : 1;
  const inferredRows = texture.repeat.y > 0 ? Math.round(1 / texture.repeat.y) : 1;
  const uv = resolveSpriteFrameUv(sprite.frame, sprite.columns ?? inferredColumns, sprite.rows ?? inferredRows);
  const signature = `${uv.frame}:${uv.repeatX}:${uv.repeatY}`;
  let changed = false;

  if (object.userData.spriteFrameSignature !== signature) {
    texture.repeat.set(uv.repeatX, uv.repeatY);
    texture.offset.set(uv.offsetX, uv.offsetY);
    texture.needsUpdate = true;
    object.userData.spriteFrameSignature = signature;
    changed = true;
  }

  const baseScaleX = (object.userData.baseScaleX ?? Math.abs(object.scale.x)) || 1;
  object.userData.baseScaleX = baseScaleX;
  const scaleX = sprite.flipX === true ? -baseScaleX : baseScaleX;
  if (object.scale.x !== scaleX) {
    object.scale.x = scaleX;
    changed = true;
  }
  return changed;
}

export class ThreeRenderer extends HybridRenderer {
  constructor(options = {}) {
    super(options);
    this.maxInternalPixels = options.maxInternalPixels ?? 1_800_000;
    this.objectByEntity = new Map();
  }

  resize(width, height, pixelRatio = globalThis.devicePixelRatio ?? 1) {
    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));
    const areaRatio = Math.sqrt(this.maxInternalPixels / (safeWidth * safeHeight));
    const adaptiveRatio = Math.min(pixelRatio || 1, Number.isFinite(areaRatio) ? areaRatio : 1);
    return super.resize(safeWidth, safeHeight, adaptiveRatio);
  }

  resizeToElement(element = this.canvas) {
    const bounds = element.getBoundingClientRect();
    return this.resize(bounds.width, bounds.height, globalThis.devicePixelRatio ?? 1);
  }

  bindEntity(entity, object, layer = "actors") {
    if (this.objectByEntity.has(entity)) this.unbindEntity(entity);
    this.objectByEntity.set(entity, object);
    this.add(object, layer);
    return object;
  }

  unbindEntity(entity, dispose = true) {
    const object = this.objectByEntity.get(entity);
    if (!object) return false;
    this.objectByEntity.delete(entity);
    this.remove(object);
    if (dispose) this.disposeObject(object);
    return true;
  }

  getVisual(entity) {
    return this.objectByEntity.get(entity) ?? null;
  }

  syncWorld(world, alpha = 1) {
    for (const [entity, transform] of world.query("transform")) {
      const object = this.objectByEntity.get(entity);
      if (!object) continue;
      const previous = world.get(entity, "previousTransform") ?? transform;
      object.position.x = previous.x + (transform.x - previous.x) * alpha;
      object.position.y = previous.y + (transform.y - previous.y) * alpha;
      object.rotation.z = transform.rotation ?? 0;
      syncSpriteVisual(object, world.get(entity, "sprite"));
    }
  }

  dispose() {
    this.objectByEntity.clear();
    super.dispose();
  }
}
