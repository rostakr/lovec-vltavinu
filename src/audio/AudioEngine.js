import { AudioRegistry } from "./AudioRegistry.js";

const GESTURE_EVENTS = Object.freeze(["pointerdown", "touchend", "keydown"]);
const AUDIO_PRELOAD_GROUP = "audio:gesture";
const MUSIC_TRACK_ID = "audio-music-journey";
const EFFECT_IDS = Object.freeze({
  dig: "audio-sfx-dig-hit",
  finding: "audio-sfx-finding",
  danger: "audio-sfx-danger"
});

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function setGainValue(gainNode, value, context) {
  if (!gainNode?.gain) return;
  const now = Number.isFinite(context?.currentTime) ? context.currentTime : 0;
  gainNode.gain.setValueAtTime?.(value, now);
  gainNode.gain.value = value;
}

export class AudioEngine {
  constructor(options = {}) {
    if (!options.events) throw new TypeError("AudioEngine requires events.");

    this.events = options.events;
    this.assets = options.assets ?? null;
    this.fetch = options.fetch ?? globalThis.fetch?.bind(globalThis) ?? null;
    this.document = options.document ?? globalThis.document ?? null;
    this.window = options.window ?? globalThis.window ?? null;
    this.button = options.button ?? null;
    this.contextFactory = options.contextFactory ?? (() => {
      const AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!AudioContextCtor) return null;
      return new AudioContextCtor();
    });
    this.logger = options.logger ?? globalThis.console ?? null;

    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.effectsGain = null;
    this.volume = clamp01(options.volume ?? 1);
    this.musicVolume = clamp01(options.musicVolume ?? 0.34);
    this.effectsVolume = clamp01(options.effectsVolume ?? 0.72);
    this.muted = Boolean(options.muted);
    this.state = "locked";
    this.started = false;
    this.disposed = false;
    this.resumeAfterVisibility = false;
    this.abortController = null;
    this.preloadPromise = null;
    this.loadedAudioIds = new Set();
    this.activeSources = new Set();
    this.musicSource = null;
    this.currentMusicId = null;
    this.pendingMusicId = null;
    this.currentScene = null;

    this.handleGesture = this.handleGesture.bind(this);
    this.handleButton = this.handleButton.bind(this);
    this.handleVisibility = this.handleVisibility.bind(this);
    this.handlePageHide = this.handlePageHide.bind(this);
    this.handleSceneTransition = this.handleSceneTransition.bind(this);
    this.handleDigHit = this.handleDigHit.bind(this);
    this.handleFinding = this.handleFinding.bind(this);
    this.handleDanger = this.handleDanger.bind(this);
  }

  start() {
    if (this.started || this.disposed) return this;
    this.started = true;
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    for (const type of GESTURE_EVENTS) {
      this.document?.addEventListener?.(type, this.handleGesture, { passive: true, signal });
    }
    this.button?.addEventListener?.("click", this.handleButton, { signal });
    this.document?.addEventListener?.("visibilitychange", this.handleVisibility, { signal });
    this.window?.addEventListener?.("pagehide", this.handlePageHide, { signal });
    this.events.on("scene:transition:complete", this.handleSceneTransition, { signal });
    this.events.on("dig:hit", this.handleDigHit, { signal });
    this.events.on("finding:collected", this.handleFinding, { signal });
    this.events.on("danger:changed", this.handleDanger, { signal });

    this.button?.classList?.remove("hidden");
    this.updateButton();
    this.emitState();
    return this;
  }

  ensureContext() {
    if (this.context || this.disposed) return this.context;
    const context = this.contextFactory();
    if (!context) {
      this.state = "unavailable";
      this.updateButton();
      this.emitState();
      return null;
    }

    this.context = context;
    this.masterGain = context.createGain();
    this.musicGain = context.createGain();
    this.effectsGain = context.createGain();
    this.musicGain.connect(this.masterGain);
    this.effectsGain.connect(this.masterGain);
    this.masterGain.connect(context.destination);
    this.applyMix();
    return context;
  }

  async unlock() {
    if (this.disposed) return false;
    const context = this.ensureContext();
    if (!context) return false;

    try {
      if (context.state !== "running") await context.resume?.();
    } catch (error) {
      this.state = "error";
      this.updateButton();
      this.emitState();
      this.logger?.warn?.("Audio unlock failed:", errorMessage(error));
      return false;
    }

    this.state = this.muted ? "muted" : "ready";
    this.updateButton();
    this.emitState();
    void this.preloadAudio().then(() => this.startPendingMusic()).catch(() => {});
    return true;
  }

  isButtonGesture(event) {
    const target = event?.target ?? null;
    if (!target || !this.button) return false;
    return target === this.button || Boolean(this.button.contains?.(target));
  }

  async recoverFromGesture() {
    if (this.state === "suspended" || (this.state === "error" && this.resumeAfterVisibility)) {
      return this.resumeFromGesture();
    }
    return this.unlock();
  }

  async handleGesture(event) {
    if (this.isButtonGesture(event)) return;
    if (this.state === "locked" || this.state === "error") await this.recoverFromGesture();
    else if (this.state === "suspended" && this.resumeAfterVisibility) await this.resumeFromGesture();
  }

  async handleButton(event) {
    event?.preventDefault?.();
    if (this.state === "locked" || this.state === "error") {
      await this.recoverFromGesture();
      return;
    }
    if (this.state === "suspended" && this.resumeAfterVisibility) {
      await this.resumeFromGesture();
      return;
    }
    this.setMuted(!this.muted);
  }

  setMuted(muted) {
    if (this.disposed) return false;
    const next = Boolean(muted);
    if (next === this.muted) return false;
    this.muted = next;
    this.applyMix();
    if (!["locked", "unavailable", "error", "suspended"].includes(this.state)) {
      this.state = this.muted ? "muted" : "ready";
    }
    this.updateButton();
    this.emitState();
    return true;
  }

  setVolume(value) {
    if (this.disposed) return false;
    const next = clamp01(value);
    if (next === this.volume) return false;
    this.volume = next;
    this.applyMix();
    return true;
  }

  setMusicVolume(value) {
    if (this.disposed) return false;
    const next = clamp01(value);
    if (next === this.musicVolume) return false;
    this.musicVolume = next;
    this.applyMix();
    return true;
  }

  setEffectsVolume(value) {
    if (this.disposed) return false;
    const next = clamp01(value);
    if (next === this.effectsVolume) return false;
    this.effectsVolume = next;
    this.applyMix();
    return true;
  }

  applyMix() {
    setGainValue(this.masterGain, this.muted ? 0 : this.volume, this.context);
    setGainValue(this.musicGain, this.musicVolume, this.context);
    setGainValue(this.effectsGain, this.effectsVolume, this.context);
  }

  async decodeAudioData(arrayBuffer) {
    if (!this.context?.decodeAudioData) throw new Error("AudioContext cannot decode audio data.");
    const copy = arrayBuffer.slice(0);
    try {
      const result = this.context.decodeAudioData(copy);
      if (result?.then) return await result;
    } catch (error) {
      if (this.context.decodeAudioData.length < 2) throw error;
    }
    return new Promise((resolve, reject) => this.context.decodeAudioData(copy, resolve, reject));
  }

  async load(entry) {
    if (!entry || entry.type !== "audio") throw new TypeError("AudioEngine.load requires an audio manifest entry.");
    if (!this.context || this.disposed) throw new Error("Audio must be unlocked before loading.");
    if (!this.fetch) throw new Error("Fetch is unavailable for audio loading.");
    const response = await this.fetch(entry.url);
    if (!response?.ok) throw new Error(`HTTP ${response?.status ?? "?"} for ${entry.url}`);
    const buffer = await this.decodeAudioData(await response.arrayBuffer());
    this.loadedAudioIds.add(entry.id);
    return buffer;
  }

  audioEntries() {
    const manifest = this.assets?.entries?.() ?? [];
    return AudioRegistry.fromManifest(manifest).byPreload(AUDIO_PRELOAD_GROUP);
  }

  async preloadAudio() {
    if (!this.context || this.disposed || !this.assets) return null;
    const entries = this.audioEntries();
    if (!entries.length) return null;
    if (this.preloadPromise) return this.preloadPromise;

    this.preloadPromise = this.assets.loadAll(entries)
      .catch(error => {
        this.preloadPromise = null;
        this.logger?.warn?.("Audio preload failed:", errorMessage(error));
        return null;
      });
    return this.preloadPromise;
  }

  async requireBuffer(id) {
    const cached = this.assets?.get?.(id, "audio");
    if (cached) return cached;
    await this.preloadAudio();
    return this.assets?.get?.(id, "audio") ?? null;
  }

  createSource(entry, buffer, destination) {
    if (!this.context || !destination || !buffer) return null;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = Boolean(entry.loop);
    setGainValue(gain, clamp01(entry.volume ?? 1), this.context);
    source.connect(gain);
    gain.connect(destination);

    const record = { source, gain, id: entry.id };
    const cleanup = () => {
      this.activeSources.delete(record);
      if (this.musicSource === record) {
        this.musicSource = null;
        this.currentMusicId = null;
        this.emitState();
      }
      try { source.disconnect?.(); } catch {}
      try { gain.disconnect?.(); } catch {}
    };
    source.addEventListener?.("ended", cleanup, { once: true });
    source.onended = cleanup;
    this.activeSources.add(record);
    return record;
  }

  async playEffect(id) {
    if (this.disposed || this.muted || this.state === "locked" || this.state === "error") return false;
    const entry = this.assets?.entry?.(id);
    if (!entry || entry.type !== "audio") return false;
    try {
      const buffer = await this.requireBuffer(id);
      const record = this.createSource(entry, buffer, this.effectsGain);
      if (!record) return false;
      record.source.start?.(0);
      return true;
    } catch (error) {
      this.logger?.warn?.(`Audio effect failed (${id}):`, errorMessage(error));
      return false;
    }
  }

  async playMusic(id) {
    if (this.disposed || this.state === "locked" || this.state === "error") return false;
    if (this.currentMusicId === id && this.musicSource) return true;
    const entry = this.assets?.entry?.(id);
    if (!entry || entry.type !== "audio") {
      this.pendingMusicId = id;
      return false;
    }

    try {
      const buffer = await this.requireBuffer(id);
      if (!buffer || this.disposed || this.currentScene === "title") return false;
      this.stopMusic();
      const record = this.createSource(entry, buffer, this.musicGain);
      if (!record) return false;
      this.musicSource = record;
      this.currentMusicId = id;
      this.pendingMusicId = null;
      record.source.start?.(0);
      this.emitState();
      return true;
    } catch (error) {
      this.logger?.warn?.(`Audio music failed (${id}):`, errorMessage(error));
      return false;
    }
  }

  stopRecord(record) {
    if (!record) return;
    this.activeSources.delete(record);
    try { record.source.stop?.(0); } catch {}
    try { record.source.disconnect?.(); } catch {}
    try { record.gain.disconnect?.(); } catch {}
  }

  stopMusic() {
    const record = this.musicSource;
    this.musicSource = null;
    this.currentMusicId = null;
    if (record) this.stopRecord(record);
    this.emitState();
  }

  async startPendingMusic() {
    const id = this.pendingMusicId;
    if (!id || this.currentScene === "title") return false;
    return this.playMusic(id);
  }

  handleSceneTransition({ to }) {
    this.currentScene = to;
    if (to === "title") {
      this.pendingMusicId = null;
      this.stopMusic();
      return;
    }
    this.pendingMusicId = MUSIC_TRACK_ID;
    if (this.context?.state === "running") {
      void this.preloadAudio().then(() => this.startPendingMusic()).catch(() => {});
    }
  }

  handleDigHit() {
    void this.playEffect(EFFECT_IDS.dig);
  }

  handleFinding() {
    void this.playEffect(EFFECT_IDS.finding);
  }

  handleDanger({ previous, current }) {
    if (current > previous) void this.playEffect(EFFECT_IDS.danger);
  }

  async suspend(reason = "manual") {
    if (!this.context || this.disposed) return false;
    this.resumeAfterVisibility = this.context.state === "running";
    try {
      if (this.context.state === "running") await this.context.suspend?.();
    } catch (error) {
      this.state = "error";
      this.updateButton();
      this.emitState();
      this.logger?.warn?.("Audio suspend failed:", errorMessage(error));
      return false;
    }
    this.state = "suspended";
    this.updateButton();
    this.emitState();
    return reason;
  }

  async resumeFromGesture() {
    if (!this.context || this.disposed) return false;
    try {
      if (this.context.state !== "running") await this.context.resume?.();
    } catch (error) {
      this.state = "error";
      this.updateButton();
      this.emitState();
      this.logger?.warn?.("Audio resume failed:", errorMessage(error));
      return false;
    }
    this.resumeAfterVisibility = false;
    this.state = this.muted ? "muted" : "ready";
    this.updateButton();
    this.emitState();
    void this.preloadAudio().then(() => this.startPendingMusic()).catch(() => {});
    return true;
  }

  async handleVisibility() {
    if (this.document?.hidden) await this.suspend("hidden");
  }

  async handlePageHide() {
    await this.suspend("pagehide");
  }

  updateButton() {
    if (!this.button) return;
    const inactive = ["locked", "error", "unavailable", "suspended"].includes(this.state);
    const muted = this.muted || inactive;
    const label = this.state === "unavailable"
      ? "Zvuk není dostupný"
      : (muted ? "Zapnout zvuk" : "Vypnout zvuk");
    this.button.textContent = muted ? "♪̸" : "♫";
    this.button.setAttribute?.("aria-pressed", String(this.muted));
    this.button.setAttribute?.("aria-label", label);
    this.button.dataset.audioState = this.state;
  }

  emitState() {
    const payload = { state: this.state };
    if (this.currentMusicId) payload.trackId = this.currentMusicId;
    this.events.emit("audio:state", payload);
  }

  snapshot() {
    return Object.freeze({
      state: this.state,
      muted: this.muted,
      volume: this.volume,
      musicVolume: this.musicVolume,
      effectsVolume: this.effectsVolume,
      contextState: this.context?.state ?? "none",
      trackId: this.currentMusicId,
      loaded: this.loadedAudioIds.size,
      activeSources: this.activeSources.size
    });
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abortController?.abort();
    this.abortController = null;
    this.started = false;
    this.pendingMusicId = null;

    for (const record of [...this.activeSources]) this.stopRecord(record);
    this.activeSources.clear();
    this.musicSource = null;
    this.currentMusicId = null;

    for (const node of [this.effectsGain, this.musicGain, this.masterGain]) {
      try { node?.disconnect?.(); } catch {}
    }
    try {
      await this.context?.close?.();
    } catch (error) {
      this.logger?.warn?.("Audio dispose failed:", errorMessage(error));
    }
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.effectsGain = null;
    this.preloadPromise = null;
    this.loadedAudioIds.clear();
    this.state = "disposed";
    this.updateButton();
    this.emitState();
  }
}
