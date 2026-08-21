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

  async dispatch(type, event = {}) {
    for (const handler of [...(this.listeners.get(type) ?? [])]) await handler(event);
  }
}

class FakeButton extends FakeTarget {
  constructor() {
    super();
    this.attributes = new Map();
    this.dataset = {};
    this.textContent = "";
    this.classList = { remove() {} };
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  contains(target) {
    return target === this;
  }
}

function createContext(overrides = {}) {
  const gain = {
    value: 1,
    setValueAtTime(value) {
      this.value = value;
    }
  };
  return {
    state: "suspended",
    currentTime: 0,
    destination: {},
    resumeCalls: 0,
    suspendCalls: 0,
    closeCalls: 0,
    resumeFailuresRemaining: overrides.resumeFailures ?? (overrides.resumeReject ? Number.POSITIVE_INFINITY : 0),
    createGain() {
      return { gain: { ...gain }, connect() {}, disconnect() {} };
    },
    async resume() {
      this.resumeCalls += 1;
      if (this.resumeFailuresRemaining > 0) {
        this.resumeFailuresRemaining -= 1;
        throw new Error("resume failed");
      }
      this.state = "running";
    },
    async suspend() {
      this.suspendCalls += 1;
      if (overrides.suspendReject) throw new Error("suspend failed");
      this.state = "suspended";
    },
    async close() {
      this.closeCalls += 1;
      if (overrides.closeReject) throw new Error("close failed");
      this.state = "closed";
    }
  };
}

function createHarness(contextOverrides = {}) {
  const events = new EventBus({ contracts: EVENT_CONTRACTS, strict: true, validatePayload: validateEventPayload });
  const document = new FakeTarget();
  const window = new FakeTarget();
  const button = new FakeButton();
  const context = createContext(contextOverrides);
  const states = [];
  const warnings = [];
  let contextFactoryCalls = 0;
  events.on("audio:state", payload => states.push(payload.state));
  const engine = new AudioEngine({
    events,
    document,
    window,
    button,
    contextFactory: () => {
      contextFactoryCalls += 1;
      return context;
    },
    logger: { warn: (...args) => warnings.push(args.join(" ")) }
  });
  return { engine, document, window, button, context, states, warnings, contextFactoryCalls: () => contextFactoryCalls };
}

test("AudioEngine creates one context only after a real gesture", async () => {
  const { engine, document, context, states, contextFactoryCalls } = createHarness();
  engine.start();
  assert.equal(engine.context, null);
  assert.equal(engine.snapshot().state, "locked");

  await document.dispatch("pointerdown", { target: document });
  assert.equal(engine.context, context);
  assert.equal(context.resumeCalls, 1);
  assert.equal(contextFactoryCalls(), 1);
  assert.equal(engine.snapshot().state, "ready");

  await document.dispatch("keydown", { target: document });
  assert.equal(engine.context, context);
  assert.equal(context.resumeCalls, 1);
  assert.equal(contextFactoryCalls(), 1);
  assert.deepEqual(states.slice(0, 2), ["locked", "ready"]);
});

test("first sound button interaction ignores bubbled pointerdown and stays ready", async () => {
  const { engine, document, button, context } = createHarness();
  engine.start();

  await document.dispatch("pointerdown", { target: button });
  assert.equal(context.resumeCalls, 0);
  await button.dispatch("click", { target: button, preventDefault() {} });
  assert.equal(context.resumeCalls, 1);
  assert.equal(engine.snapshot().state, "ready");
  assert.equal(engine.snapshot().muted, false);

  await button.dispatch("click", { target: button, preventDefault() {} });
  assert.equal(engine.snapshot().state, "muted");
  assert.equal(engine.snapshot().muted, true);
});

test("transient initial resume failure recovers on next gesture with the same context", async () => {
  const { engine, document, context, button, contextFactoryCalls } = createHarness({ resumeFailures: 1 });
  engine.start();

  await document.dispatch("pointerdown", { target: document });
  assert.equal(engine.snapshot().state, "error");
  assert.equal(button.attributes.get("aria-label"), "Zapnout zvuk");
  assert.equal(contextFactoryCalls(), 1);

  await document.dispatch("pointerdown", { target: document });
  assert.equal(engine.snapshot().state, "ready");
  assert.equal(context.resumeCalls, 2);
  assert.equal(contextFactoryCalls(), 1);
});

test("failed background resume recovers on the next gesture", async () => {
  const { engine, document, context, contextFactoryCalls } = createHarness();
  engine.start();
  await document.dispatch("pointerdown", { target: document });
  document.hidden = true;
  await document.dispatch("visibilitychange");
  document.hidden = false;
  context.resumeFailuresRemaining = 1;

  await document.dispatch("pointerdown", { target: document });
  assert.equal(engine.snapshot().state, "error");
  assert.equal(engine.resumeAfterVisibility, true);

  await document.dispatch("pointerdown", { target: document });
  assert.equal(engine.snapshot().state, "ready");
  assert.equal(context.resumeCalls, 3);
  assert.equal(contextFactoryCalls(), 1);
});

test("mute, visibility suspend and dispose are idempotent", async () => {
  const { engine, document, button, context } = createHarness();
  engine.start();
  await document.dispatch("pointerdown", { target: document });

  assert.equal(engine.setMuted(true), true);
  assert.equal(engine.setMuted(true), false);
  assert.equal(button.attributes.get("aria-pressed"), "true");

  document.hidden = true;
  await document.dispatch("visibilitychange");
  assert.equal(context.suspendCalls, 1);
  assert.equal(engine.snapshot().state, "suspended");

  await engine.dispose();
  await engine.dispose();
  assert.equal(context.closeCalls, 1);
  assert.equal(engine.snapshot().state, "disposed");
});

test("background return never resumes without a new gesture", async () => {
  const { engine, document, context } = createHarness();
  engine.start();
  await document.dispatch("pointerdown", { target: document });
  document.hidden = true;
  await document.dispatch("visibilitychange");

  document.hidden = false;
  await document.dispatch("visibilitychange");
  assert.equal(context.resumeCalls, 1);
  assert.equal(engine.snapshot().state, "suspended");

  await document.dispatch("pointerdown", { target: document });
  assert.equal(context.resumeCalls, 2);
  assert.equal(engine.snapshot().state, "ready");
});

test("rejected unlock is contained and reported", async () => {
  const { engine, document, context, warnings } = createHarness({ resumeReject: true });
  engine.start();
  await document.dispatch("pointerdown", { target: document });

  assert.equal(context.resumeCalls, 1);
  assert.equal(engine.snapshot().state, "error");
  assert.equal(warnings.length, 1);
});

test("rejected suspend is contained and reported", async () => {
  const { engine, document, context, warnings } = createHarness({ suspendReject: true });
  engine.start();
  await document.dispatch("pointerdown", { target: document });
  document.hidden = true;
  await document.dispatch("visibilitychange");

  assert.equal(context.suspendCalls, 1);
  assert.equal(engine.snapshot().state, "error");
  assert.equal(warnings.length, 1);
});

test("rejected dispose close is contained and dispose remains final", async () => {
  const { engine, document, context, warnings } = createHarness({ closeReject: true });
  engine.start();
  await document.dispatch("pointerdown", { target: document });
  await engine.dispose();

  assert.equal(context.closeCalls, 1);
  assert.equal(engine.snapshot().state, "disposed");
  assert.equal(warnings.length, 1);
});
