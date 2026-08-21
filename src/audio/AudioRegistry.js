const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function assertString(value, label) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${label} must be a non-empty string.`);
  return value;
}

function assertRelativeUrl(value) {
  const url = assertString(value, "Audio URL");
  if (!url.startsWith("./")) throw new TypeError("Audio URL must be relative to the deployed root.");
  return url;
}

function normalizeLicense(entry) {
  const license = entry.license;
  if (!license || typeof license !== "object" || Array.isArray(license)) {
    throw new TypeError(`Audio asset ${entry.id ?? "unknown"} requires license metadata.`);
  }
  return Object.freeze({
    spdx: assertString(license.spdx, `Audio asset ${entry.id ?? "unknown"} license.spdx`),
    source: assertString(license.source, `Audio asset ${entry.id ?? "unknown"} license.source`),
    notice: assertString(license.notice, `Audio asset ${entry.id ?? "unknown"} license.notice`)
  });
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new TypeError("Audio manifest entry must be an object.");
  }
  if (entry.type !== "audio") throw new TypeError(`Audio registry only accepts type \"audio\": ${entry.id ?? "unknown"}`);
  const bytes = Number(entry.metrics?.bytes);
  const budgetBytes = Number(entry.budget?.bytes);
  if (!Number.isFinite(bytes) || bytes < 0) throw new TypeError(`Audio asset ${entry.id ?? "unknown"} requires metrics.bytes.`);
  if (!Number.isFinite(budgetBytes) || budgetBytes < bytes) {
    throw new TypeError(`Audio asset ${entry.id ?? "unknown"} exceeds or lacks budget.bytes.`);
  }
  const sha256 = assertString(entry.sha256, `Audio asset ${entry.id ?? "unknown"} sha256`).toLowerCase();
  if (!SHA256_PATTERN.test(sha256)) throw new TypeError(`Audio asset ${entry.id ?? "unknown"} sha256 must be 64 lowercase hex characters.`);
  assertString(entry.disposeOwner, `Audio asset ${entry.id ?? "unknown"} disposeOwner`);

  return Object.freeze({
    id: assertString(entry.id, "Audio asset id"),
    type: "audio",
    url: assertRelativeUrl(entry.url),
    preload: assertString(entry.preload, `Audio asset ${entry.id ?? "unknown"} preload`),
    role: entry.role ? assertString(entry.role, `Audio asset ${entry.id ?? "unknown"} role`) : "effect",
    loop: Boolean(entry.loop),
    volume: Number.isFinite(Number(entry.volume)) ? Math.min(1, Math.max(0, Number(entry.volume))) : 1,
    metrics: Object.freeze({ bytes }),
    budget: Object.freeze({ bytes: budgetBytes }),
    sha256,
    disposeOwner: entry.disposeOwner,
    license: normalizeLicense(entry)
  });
}

export class AudioRegistry {
  constructor(entries = []) {
    this.entries = new Map();
    for (const entry of entries) this.register(entry);
  }

  static fromManifest(manifest = []) {
    if (!Array.isArray(manifest)) throw new TypeError("Asset manifest must be an array.");
    return new AudioRegistry(manifest.filter(entry => entry?.type === "audio"));
  }

  register(entry) {
    const normalized = normalizeEntry(entry);
    if (this.entries.has(normalized.id)) throw new Error(`Duplicate audio asset id: ${normalized.id}`);
    this.entries.set(normalized.id, normalized);
    return normalized;
  }

  get(id) {
    return this.entries.get(id) ?? null;
  }

  require(id) {
    const entry = this.get(id);
    if (!entry) throw new Error(`Unknown audio asset: ${id}`);
    return entry;
  }

  byPreload(group) {
    return [...this.entries.values()].filter(entry => entry.preload === group);
  }

  byRole(role) {
    return [...this.entries.values()].filter(entry => entry.role === role);
  }

  snapshot() {
    return Object.freeze([...this.entries.values()]);
  }
}
