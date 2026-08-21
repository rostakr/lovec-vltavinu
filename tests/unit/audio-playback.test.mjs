import test from "node:test";
import assert from "node:assert/strict";
import { AudioEngine } from "../../src/audio/AudioEngine.js";
import { EventBus } from "../../src/core/EventBus.js";
import { EVENT_CONTRACTS, validateEventPayload } from "../../src/core/GameEvents.js";

class FakeTarget {
  constructor() {
    this.listeners = new Map();
    this.hidden = false;
  }

  addEventListener(type, handler, options = {}) {
    if (options.signal?.aborted) return;
    const handlers = this.listeners.get(type) ?? new Set();
    handlers.add(handler);
    this.listeners.set(type, handlers);
    options.signal?.addEventListener("abort", () => handlers.delete(handler), { once: true });
  }
}

function createGain() {
  return {
    gain: {
      value: 1,
      setValueAtTime(value) { this.value = value; }
    },
    connect() {},
    disconnect() {}
  };
}

function createContext() {
  const sources = [];
  return {
    state: "suspended",
    currentTime: 0,
    destination: {},
    sources,
    createGain,
    createBufferSource() {
      const source = {
        buffer: null,
        loop: false,
        startCalls: 0,
        stopCalls: 0,
        connect() {},
        disconnect() {},
        addEventListener() {},
        start() { this.startCalls += 1; },
        stop() { this.stopCalls += 1; }
      };
      sources.push(source);
      return source;
    },
    async resume() { this.state = "running"; },
    async suspend() { this.state = "suspended"; },
    async close() { this.state = "closed"; }
  };
}

function audioEntry(id, overrides = {}) {
  return {
    id,
    type: "audio",
    url: `./assets/audio/${id}.mp3`,
    preload: "audio:gesture",
    role: "effect",
    loop: false,
    volume: 0.7,
    metrics: { bytes: 1024 },
    budget: { bytes: 2048 },
    sha256: "a".repeat(64),
    disposeOwner: "AudioEngine",
    license: {
      spdx: "CC0-1.0",
      source: "Project-original procedural synthesis; no external samples.",
      notice: "./assets/audio/LICENSE.md"
    },
    ...overrides
  };
}

function createAssets() {
  const entries = [
    audioEntry("audio-music-journey", { role: "music", loop: true, volume: 0.34 }),
    audioEntry("audio-sfx-dig-hit"),
    audioEntry("audio-sfx-finding"),
    audioEntry("audio-sfx-danger")
  ];
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const cache = new Map();
  return {
    entries() { return entries; },
    entry(id) { return byId.get(id) ?? null; },
    get(id, type) { return type === "audio" ? cache.get(id) ?? null : null; },
    async loadAll(selected) {
      const result = new Map();
      for (const entry of selected) {
        const buffer = { id: entry.id };
        const promise = Promise.resolve(buffer);
        cache.set(entry.id, promise);
        result.set(entry.id, buffer);
      }
      return result;
    }
  };
}

function createHarness() {
  const events = new EventBus({ contracts: EVENT_CONTRACTS, strict: true, validatePayload: validateEventPayload });
  const context = createContext();
  const assets = createAssets();
  const engine = new AudioEngine({
    events,
    assets,
    document: new FakeTarget(),
    window: new FakeTarget(),
    contextFactory: () => context,
    logger: { warn() {} }
  });
  engine.start();
  return { engine, events, context, assets };
}

test("audio assets preload only after gesture unlock", async () => {
  const { engine } = createHarness();
  assert.equal(engine.snapshot().loaded, 0);
  await engine.unlock();
  await engine.preloadAudio();
  assert.equal(engine.state, "ready");
  assert.equal(engine.audioEntries().length, 4);
});

test("scene transition starts one looping music source", async () => {
  const { engine, context } = createHarness();
  await engine.unlock();
  engine.handleSceneTransition({ from: "title", to: "chlum" });
  await engine.preloadAudio();
  await engine.startPendingMusic();

  assert.equal(engine.snapshot().trackId, "audio-music-journey");
  assert.equal(engine.snapshot().activeSources, 1);
  assert.equal(context.sources[0].loop, true);
  assert.equal(context.sources[0].startCalls, 1);
});

test("domain events route effects through the existing event bus", async () => {
  const { engine, events, context } = createHarness();
  await engine.unlock();
  await engine.preloadAudio();

  events.emit("dig:hit", { spot: "spot-1", hit: 1, requiredHits: 3, quality: 0.8 });
  events.emit("finding:collected", { findingId: "finding-1", locality: "chlum", rarity: "B", weight: 1.2, score: 100 });
  events.emit("danger:changed", { previous: 0, current: 1, cause: "tractor" });
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(context.sources.length, 3);
  assert.equal(context.sources.every(source => source.startCalls === 1), true);
});

test("muting suppresses new effects and title transition stops music", async () => {
  const { engine, context } = createHarness();
  await engine.unlock();
  engine.handleSceneTransition({ from: "title", to: "chlum" });
  await engine.preloadAudio();
  await engine.startPendingMusic();
  const music = context.sources[0];

  engine.setMuted(true);
  assert.equal(await engine.playEffect("audio-sfx-dig-hit"), false);
  engine.handleSceneTransition({ from: "chlum", to: "title" });

  assert.equal(music.stopCalls, 1);
  assert.equal(engine.snapshot().trackId, null);
});
