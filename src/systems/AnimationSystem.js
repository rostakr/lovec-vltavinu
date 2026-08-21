export function createAnimation(options = {}) {
  const frames = Array.isArray(options.frames) ? [...options.frames] : [];
  if (!frames.length) throw new Error("Animation requires at least one frame.");
  const fps = options.fps ?? 8;
  if (!(fps > 0)) throw new RangeError("Animation fps must be greater than zero.");
  return {
    clip: options.clip ?? "default",
    frames,
    fps,
    loop: options.loop !== false,
    playing: options.playing !== false,
    index: Math.max(0, Math.min(frames.length - 1, options.index ?? 0)),
    elapsed: Math.max(0, options.elapsed ?? 0),
    completed: false,
    frame: frames[Math.max(0, Math.min(frames.length - 1, options.index ?? 0))],
    motionDriven: options.motionDriven === true,
    motionThreshold: Math.max(0, Number(options.motionThreshold) || 0.001),
    resetOnIdle: options.resetOnIdle !== false,
    direction: options.direction ?? "down",
    directionFrames: options.directionFrames ?? null,
    clips: options.clips ?? null,
    motionClip: options.motionClip ?? null,
    idleClip: options.idleClip ?? null,
    actionClip: options.actionClip ?? null,
    actionInterruptible: options.actionInterruptible === true
  };
}

const resetAnimation = animation => {
  animation.index = 0;
  animation.elapsed = 0;
  animation.completed = false;
  animation.frame = animation.frames[0];
};

const getClipDefinition = (animation, clip) => {
  if (!animation?.clips || typeof animation.clips !== "object") return null;
  const definition = animation.clips[clip];
  if (!definition || typeof definition !== "object") return null;
  const frames = Array.isArray(definition.frames) && definition.frames.length
    ? definition.frames
    : null;
  const directionFrames = definition.directionFrames && typeof definition.directionFrames === "object"
    ? definition.directionFrames
    : null;
  if (!frames && !directionFrames) return null;
  return { ...definition, frames, directionFrames };
};

const resolveDefinitionFrames = (definition, direction) => {
  if (definition.frames) return definition.frames;
  const preferred = definition.directionFrames?.[direction];
  if (Array.isArray(preferred) && preferred.length) return preferred;
  for (const frames of Object.values(definition.directionFrames ?? {})) {
    if (Array.isArray(frames) && frames.length) return frames;
  }
  return null;
};

export function setAnimationClip(animation, clip, options = {}) {
  if (!animation?.frames?.length) throw new TypeError("Invalid animation component.");
  if (typeof clip !== "string" || !clip.trim()) throw new TypeError("Animation clip must be a non-empty string.");
  const nextClip = clip.trim();
  const definition = getClipDefinition(animation, nextClip);
  if (!definition) return false;

  const changed = animation.clip !== nextClip;
  const resolvedFrames = resolveDefinitionFrames(definition, animation.direction);
  if (!resolvedFrames) return false;
  animation.clip = nextClip;
  animation.frames = resolvedFrames;
  animation.directionFrames = definition.directionFrames;
  if (Number(definition.fps) > 0) animation.fps = Number(definition.fps);
  if (typeof definition.loop === "boolean") animation.loop = definition.loop;

  if (changed || options.restart === true) resetAnimation(animation);
  if (typeof options.playing === "boolean") animation.playing = options.playing;
  else if (typeof definition.playing === "boolean") animation.playing = definition.playing;
  return true;
}

export const resolveCardinalDirection = (x, y, fallback = "down") => {
  if (Math.abs(x) > Math.abs(y)) return x < 0 ? "left" : "right";
  if (Math.abs(y) > 0) return y > 0 ? "up" : "down";
  return fallback;
};

export const resolveEightWayDirection = (x, y, fallback = "down", diagonalThreshold = 0.55) => {
  const dx = Number(x) || 0;
  const dy = Number(y) || 0;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax === 0 && ay === 0) return fallback;

  const ratio = Math.max(0.1, Math.min(0.9, Number(diagonalThreshold) || 0.55));
  const diagonal = ax >= ay * ratio && ay >= ax * ratio;
  if (!diagonal) return resolveCardinalDirection(dx, dy, fallback);
  if (dy > 0) return dx < 0 ? "upLeft" : "upRight";
  return dx < 0 ? "downLeft" : "downRight";
};

const fallbackDirections = (direction, x, y, fallback) => {
  if (direction === "upLeft" || direction === "upRight") {
    return [direction, Math.abs(x) > Math.abs(y) ? (x < 0 ? "left" : "right") : "up", resolveCardinalDirection(x, y, fallback)];
  }
  if (direction === "downLeft" || direction === "downRight") {
    return [direction, Math.abs(x) > Math.abs(y) ? (x < 0 ? "left" : "right") : "down", resolveCardinalDirection(x, y, fallback)];
  }
  return [direction];
};

const selectDirectionalFrames = (animation, sprite, x, y) => {
  const directionFrames = animation.directionFrames;
  if (!directionFrames || typeof directionFrames !== "object") return false;
  const requested = resolveEightWayDirection(x, y, animation.direction);
  const candidates = fallbackDirections(requested, x, y, animation.direction);
  let direction = null;
  let frames = null;
  for (const candidate of candidates) {
    const candidateFrames = directionFrames[candidate];
    if (Array.isArray(candidateFrames) && candidateFrames.length > 0) {
      direction = candidate;
      frames = candidateFrames;
      break;
    }
  }
  if (!frames) return false;

  if (animation.direction !== direction || animation.frames !== frames) {
    animation.direction = direction;
    animation.frames = frames;
    animation.index = Math.min(animation.index, frames.length - 1);
    animation.frame = frames[animation.index];
  }
  sprite.flipX = false;
  return true;
};

export class AnimationSystem {
  constructor(options = {}) {
    this.events = options.events ?? null;
  }

  play(animation, options = {}) {
    if (!animation?.frames?.length) throw new TypeError("Invalid animation component.");
    if (options.restart) resetAnimation(animation);
    animation.completed = false;
    animation.playing = true;
    return animation;
  }

  pause(animation, options = {}) {
    if (!animation?.frames?.length) throw new TypeError("Invalid animation component.");
    animation.playing = false;
    if (options.reset === true) resetAnimation(animation);
    return animation;
  }

  setClip(animation, clip, options = {}) {
    return setAnimationClip(animation, clip, options);
  }

  playAction(animation, clip, options = {}) {
    if (!setAnimationClip(animation, clip, { restart: options.restart !== false, playing: true })) return false;
    animation.actionClip = clip.trim();
    animation.actionInterruptible = options.interruptible === true;
    return true;
  }

  clearAction(animation) {
    if (!animation?.actionClip) return false;
    animation.actionClip = null;
    animation.actionInterruptible = false;
    return true;
  }

  setMotion(animation, sprite, move, options = {}) {
    if (!animation?.frames?.length) throw new TypeError("Invalid animation component.");
    if (!sprite || typeof sprite !== "object") throw new TypeError("Animation motion binding requires a sprite component.");
    const x = Number(move?.x) || 0;
    const y = Number(move?.y) || 0;
    const threshold = Math.max(0, Number(options.threshold) || 0.001);
    const moving = Math.hypot(x, y) >= threshold;

    if (animation.actionClip) {
      const actionStillActive = animation.clip === animation.actionClip && !animation.completed;
      if (actionStillActive && !(animation.actionInterruptible && moving)) {
        sprite.frame = animation.frame;
        return moving;
      }
      this.clearAction(animation);
    }

    const requestedClip = moving ? animation.motionClip : animation.idleClip;
    if (requestedClip) this.setClip(animation, requestedClip);

    const directional = (moving || Boolean(requestedClip)) && selectDirectionalFrames(animation, sprite, x, y);
    if (!directional && moving && Math.abs(x) >= threshold) sprite.flipX = x < 0;
    if (moving) this.play(animation);
    else this.pause(animation, { reset: options.resetOnIdle !== false });
    sprite.frame = animation.frame;
    return moving;
  }

  updateAnimation(animation, dt, entity = null) {
    if (!animation.playing || animation.completed) return false;
    const frameDuration = 1 / animation.fps;
    animation.elapsed += Math.max(0, dt);

    if (animation.frames.length < 2) {
      if (!animation.loop && animation.elapsed >= frameDuration) {
        animation.completed = true;
        animation.playing = false;
        animation.elapsed = 0;
        this.events?.emit("animation:complete", { entity, clip: animation.clip });
      }
      return false;
    }

    let changed = false;
    while (animation.elapsed >= frameDuration && animation.playing) {
      animation.elapsed -= frameDuration;
      if (animation.index < animation.frames.length - 1) {
        animation.index++;
      } else if (animation.loop) {
        animation.index = 0;
      } else {
        animation.index = animation.frames.length - 1;
        animation.completed = true;
        animation.playing = false;
        animation.elapsed = 0;
        this.events?.emit("animation:complete", { entity, clip: animation.clip });
      }
      animation.frame = animation.frames[animation.index];
      changed = true;
    }

    if (changed) this.events?.emit("animation:frame", {
      entity,
      clip: animation.clip,
      frame: animation.frame
    });
    return changed;
  }

  update(world, dt) {
    let changed = 0;
    for (const [entity, animation] of world.query("animation")) {
      const sprite = world.get(entity, "sprite");
      if (animation.motionDriven === true && sprite) {
        const transform = world.get(entity, "transform");
        const previous = world.get(entity, "previousTransform") ?? transform;
        this.setMotion(animation, sprite, {
          x: (transform?.x ?? 0) - (previous?.x ?? transform?.x ?? 0),
          y: (transform?.y ?? 0) - (previous?.y ?? transform?.y ?? 0)
        }, {
          threshold: animation.motionThreshold,
          resetOnIdle: animation.resetOnIdle
        });
      }
      const frameChanged = this.updateAnimation(animation, dt, entity);
      if (sprite && sprite.frame !== animation.frame) sprite.frame = animation.frame;
      if (frameChanged) changed++;
    }
    return changed;
  }
}
