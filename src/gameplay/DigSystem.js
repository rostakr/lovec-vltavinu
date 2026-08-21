import { DIG_REQUIRED_HITS } from "../data/levels.js";

const clamp01 = value => Math.max(0, Math.min(1, value));

export class DigSystem {
  constructor(options = {}) {
    if (Object.hasOwn(options, "requiredHits") && options.requiredHits !== DIG_REQUIRED_HITS) {
      throw new RangeError(`requiredHits must be literal ${DIG_REQUIRED_HITS}.`);
    }
    this.events = options.events ?? null;
    this.requiredHits = DIG_REQUIRED_HITS;
    this.sweetMin = options.sweetMin ?? 0.4;
    this.sweetMax = options.sweetMax ?? 0.6;
    this.speed = options.speed ?? 1.25;
    this.active = null;

    if (!(this.sweetMin >= 0 && this.sweetMin < this.sweetMax && this.sweetMax <= 1)) {
      throw new RangeError("Dig sweet spot must satisfy 0 <= sweetMin < sweetMax <= 1.");
    }
    if (!(typeof this.speed === "number" && Number.isFinite(this.speed) && this.speed > 0)) {
      throw new RangeError("Dig speed must be a positive finite number.");
    }
  }

  start(spot) {
    if (this.active) return false;
    if (!(typeof spot === "string" && spot) && !(Number.isInteger(spot) && spot >= 0)) {
      throw new TypeError("Dig spot must be a non-empty string or non-negative integer.");
    }
    this.active = { spot, hits: 0, misses: 0, position: 0, direction: 1, complete: false, qualities: [] };
    this.events?.emit("dig:start", { spot, requiredHits: DIG_REQUIRED_HITS });
    return true;
  }

  update(dt) {
    if (!this.active || this.active.complete) return this.snapshot();
    if (!(typeof dt === "number" && Number.isFinite(dt) && dt >= 0)) throw new TypeError("Dig dt must be a non-negative finite number.");
    let position = this.active.position + this.active.direction * this.speed * dt;
    if (position >= 1) {
      position = 1;
      this.active.direction = -1;
    } else if (position <= 0) {
      position = 0;
      this.active.direction = 1;
    }
    this.active.position = position;
    return this.snapshot();
  }

  strike() {
    const active = this.active;
    if (!active || active.complete) return null;
    const inside = active.position >= this.sweetMin && active.position <= this.sweetMax;
    if (!inside) {
      active.misses += 1;
      active.qualities.push(0);
      this.events?.emit("dig:miss", { spot: active.spot, misses: active.misses });
      return { hit: false, complete: false, ...this.snapshot() };
    }

    active.hits += 1;
    const center = (this.sweetMin + this.sweetMax) / 2;
    const halfWidth = (this.sweetMax - this.sweetMin) / 2;
    const quality = clamp01(1 - Math.abs(active.position - center) / halfWidth);
    active.qualities.push(quality);
    this.events?.emit("dig:hit", {
      spot: active.spot,
      hit: active.hits,
      requiredHits: DIG_REQUIRED_HITS,
      quality
    });

    active.position = 0;
    active.direction = 1;
    if (active.hits === DIG_REQUIRED_HITS) {
      active.complete = true;
      this.events?.emit("dig:complete", {
        spot: active.spot,
        hits: DIG_REQUIRED_HITS,
        misses: active.misses,
        clean: active.misses === 0
      });
    }
    return { hit: true, complete: active.complete, quality, ...this.snapshot() };
  }

  averageQuality() {
    const q = this.active?.qualities;
    if (!q || !q.length) return 0;
    return q.reduce((sum, v) => sum + v, 0) / q.length;
  }

  perfectDig() {
    return this.active ? this.active.misses === 0 && this.active.complete : false;
  }

  snapshot() {
    return this.active ? { ...this.active } : null;
  }

  finish() {
    if (!this.active?.complete) return null;
    const result = this.snapshot();
    this.active = null;
    return result;
  }

  cancel() {
    const hadActive = Boolean(this.active);
    this.active = null;
    return hadActive;
  }
}
