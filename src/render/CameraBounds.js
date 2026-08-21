const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const finitePositive = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const finiteRatio = (value, fallback, min = 0, max = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
};

const followStateByRenderer = new WeakMap();

function visibleWorldSize({ viewHeight, viewportWidth, viewportHeight, zoom = 1 }) {
  const safeZoom = finitePositive(zoom, 1);
  const safeViewHeight = finitePositive(viewHeight, 720);
  const safeViewportWidth = finitePositive(viewportWidth, 1);
  const safeViewportHeight = finitePositive(viewportHeight, 1);
  const height = safeViewHeight / safeZoom;
  return {
    width: height * (safeViewportWidth / safeViewportHeight),
    height
  };
}

function boundsSignature(bounds) {
  return `${Number(bounds?.x) || 0}:${Number(bounds?.y) || 0}:${Number(bounds?.width) || 0}:${Number(bounds?.height) || 0}`;
}

export function resolveBoundedCameraCenter({ bounds, x, y, viewHeight, viewportWidth, viewportHeight, zoom = 1 }) {
  const safeZoom = finitePositive(zoom, 1);
  const visible = visibleWorldSize({ viewHeight, viewportWidth, viewportHeight, zoom: safeZoom });
  const halfHeight = visible.height / 2;
  const halfWidth = visible.width / 2;
  const minX = Number(bounds.x) || 0;
  const minY = Number(bounds.y) || 0;
  const width = finitePositive(bounds.width, halfWidth * 2);
  const height = finitePositive(bounds.height, halfHeight * 2);
  const maxX = minX + width;
  const maxY = minY + height;

  return {
    x: width <= halfWidth * 2 ? minX + width / 2 : clamp(Number(x) || 0, minX + halfWidth, maxX - halfWidth),
    y: height <= halfHeight * 2 ? minY + height / 2 : clamp(Number(y) || 0, minY + halfHeight, maxY - halfHeight),
    zoom: safeZoom
  };
}

export function resolveFollowCameraCenter({
  bounds,
  targetX,
  targetY,
  currentX,
  currentY,
  viewHeight,
  viewportWidth,
  viewportHeight,
  zoom = 1,
  deadZoneRatio = 0.07,
  damping = 0.16,
  snapDistanceRatio = 0.62
}) {
  const target = resolveBoundedCameraCenter({
    bounds,
    x: targetX,
    y: targetY,
    viewHeight,
    viewportWidth,
    viewportHeight,
    zoom
  });
  const current = resolveBoundedCameraCenter({
    bounds,
    x: currentX,
    y: currentY,
    viewHeight,
    viewportWidth,
    viewportHeight,
    zoom: target.zoom
  });
  const visible = visibleWorldSize({ viewHeight, viewportWidth, viewportHeight, zoom: target.zoom });
  const deadZone = finiteRatio(deadZoneRatio, 0.07, 0, 0.25);
  const blend = finiteRatio(damping, 0.16, 0.01, 1);
  const snapRatio = finiteRatio(snapDistanceRatio, 0.62, 0.25, 2);
  const deadX = visible.width * deadZone;
  const deadY = visible.height * deadZone;
  const dx = target.x - current.x;
  const dy = target.y - current.y;

  if (Math.abs(dx) >= visible.width * snapRatio || Math.abs(dy) >= visible.height * snapRatio) return target;
  if (Math.abs(dx) <= deadX && Math.abs(dy) <= deadY) return current;

  const desiredX = Math.abs(dx) <= deadX ? current.x : target.x - Math.sign(dx) * deadX;
  const desiredY = Math.abs(dy) <= deadY ? current.y : target.y - Math.sign(dy) * deadY;
  const smoothed = resolveBoundedCameraCenter({
    bounds,
    x: current.x + (desiredX - current.x) * blend,
    y: current.y + (desiredY - current.y) * blend,
    viewHeight,
    viewportWidth,
    viewportHeight,
    zoom: target.zoom
  });

  return smoothed;
}

export function resetBoundedCameraFollow(renderer) {
  if (!renderer || (typeof renderer !== "object" && typeof renderer !== "function")) return false;
  return followStateByRenderer.delete(renderer);
}

export function setBoundedCameraCenter(renderer, bounds, x, y, zoom = 1, options = {}) {
  const common = {
    bounds,
    viewHeight: renderer.viewHeight,
    viewportWidth: renderer.width,
    viewportHeight: renderer.height,
    zoom
  };
  const target = resolveBoundedCameraCenter({ ...common, x, y });
  const camera = renderer.camera;
  const followEnabled = options.follow !== false && camera?.position;
  const signature = boundsSignature(bounds);
  const previous = followStateByRenderer.get(renderer);
  const mustSnap = !followEnabled || options.snap === true || !previous || previous.boundsSignature !== signature;

  const center = mustSnap
    ? target
    : resolveFollowCameraCenter({
        ...common,
        targetX: x,
        targetY: y,
        currentX: camera.position.x,
        currentY: camera.position.y,
        deadZoneRatio: options.deadZoneRatio,
        damping: options.damping,
        snapDistanceRatio: options.snapDistanceRatio
      });

  renderer.setCameraCenter(center.x, center.y, center.zoom);
  if (followEnabled) followStateByRenderer.set(renderer, { boundsSignature: signature });
  return center;
}
