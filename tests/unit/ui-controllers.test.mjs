import test from "node:test";
import assert from "node:assert/strict";
import { DIG_REQUIRED_HITS } from "../../src/data/levels.js";
import { HudController } from "../../src/ui/HudController.js";
import { ScreenController } from "../../src/ui/ScreenController.js";

class FakeClassList {
  constructor(initial = []) {
    this.values = new Set(initial);
  }

  add(...names) {
    for (const name of names) this.values.add(name);
  }

  remove(...names) {
    for (const name of names) this.values.delete(name);
  }

  toggle(name, force) {
    if (force === undefined) {
      if (this.values.has(name)) this.values.delete(name);
      else this.values.add(name);
    } else if (force) this.values.add(name);
    else this.values.delete(name);
    return this.values.has(name);
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor(id = "", classes = []) {
    this.id = id;
    this.classList = new FakeClassList(classes);
    this.style = {};
    this.attributes = new Map();
    this.textContent = "";
    this.disabled = false;
    this.onclick = null;
    this.inert = false;
    this.children = [];
    this.focused = false;
    this.dataset = {};
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  querySelector(selector) {
    if (selector === "button:not([disabled])") {
      return this.children.find(child => child.tagName === "BUTTON" && !child.disabled) ?? null;
    }
    return null;
  }

  focus() {
    this.focused = true;
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = children;
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
  }

  add(id, classes = [], tagName = "DIV") {
    const element = new FakeElement(id, classes);
    element.tagName = tagName;
    this.elements.set(id, element);
    return element;
  }

  getElementById(id) {
    return this.elements.get(id) ?? null;
  }

  querySelectorAll(selector) {
    const all = [...this.elements.values()];
    if (selector === ".screen") return all.filter(element => element.classList.contains("screen"));
    if (selector === "button") return all.filter(element => element.tagName === "BUTTON");
    return [];
  }

  createElement(tagName) {
    const element = new FakeElement();
    element.tagName = tagName.toUpperCase();
    return element;
  }
}

class FakeEvents {
  constructor() {
    this.handlers = new Map();
  }

  on(type, handler) {
    const handlers = this.handlers.get(type) ?? new Set();
    handlers.add(handler);
    this.handlers.set(type, handlers);
    return () => handlers.delete(handler);
  }

  emit(type, payload) {
    for (const handler of this.handlers.get(type) ?? []) handler(payload);
  }
}

const createUiDocument = () => {
  const document = new FakeDocument();
  for (const id of [
    "app", "hud", "controls", "missionNumber", "placeLabel", "objectiveLabel", "objectiveProgress", "bagValue",
    "heatPill", "dangerMeterText", "heatFill", "radarPanel", "radarFill", "radarState", "dangerBanner", "dangerText", "hint", "toast",
    "actionButton", "actionIcon", "actionText", "briefKicker", "briefTitle", "briefText",
    "briefGoal", "dialogName", "dialogText", "dialogAvatar", "digTitle", "digInfo", "pausePlace", "pauseObjective", "pauseProgress",
    "digHits", "digHitCount", "digHitSymbols", "digMarker", "sweetZone", "resultKicker", "resultTitle", "resultText",
    "resultScore", "resultStats"
  ]) document.add(id);

  document.getElementById("radarPanel").classList.add("hidden");

  for (const id of [
    "actionButton", "briefButton", "dialogButton", "digButton", "againButton",
    "resultRecordsButton", "resumeButton", "menuButton"
  ]) {
    if (!document.getElementById(id)) document.add(id, [], "BUTTON");
    else document.getElementById(id).tagName = "BUTTON";
  }

  for (const id of [
    "titleScreen", "briefScreen", "dialogScreen", "digScreen", "resultScreen", "pauseScreen"
  ]) document.add(id, ["screen"]);

  return document;
};

test("HudController de-duplicates exact models, accepts a new revision stream and exposes momentary ARIA contracts", () => {
  const document = createUiDocument();
  const events = new FakeEvents();
  const hud = new HudController({ document, events });
  const model = {
    missionNumber: 1,
    placeLabel: "Chlum",
    objective: "Promluv s Václavem",
    objectiveProgress: 0.2,
    findings: 2,
    danger: 0.92,
    hint: "Přibliž se k Václavovi",
    actionReady: true,
    actionLabel: "MLUVIT",
    actionIcon: "!"
  };

  events.emit("hud:model:changed", { revision: 7, model });

  assert.equal(document.getElementById("placeLabel").textContent, "CHLUM");
  assert.equal(document.getElementById("objectiveLabel").textContent, "Promluv s Václavem");
  assert.equal(document.getElementById("objectiveProgress").textContent, "POSTUP 20 %");
  assert.equal(document.getElementById("objectiveProgress").getAttribute("role"), "progressbar");
  assert.equal(document.getElementById("objectiveProgress").getAttribute("aria-valuenow"), "20");
  assert.equal(document.getElementById("heatFill").style.width, "92%");
  assert.equal(document.getElementById("dangerMeterText").textContent, "KRITICKÉ");
  assert.equal(document.getElementById("heatPill").classList.contains("detected"), true);
  assert.equal(document.getElementById("heatPill").classList.contains("critical"), true);
  assert.equal(document.getElementById("heatPill").getAttribute("role"), "progressbar");
  assert.equal(document.getElementById("heatPill").getAttribute("aria-valuenow"), "92");
  assert.equal(document.getElementById("dangerBanner").classList.contains("hidden"), false);
  assert.equal(document.getElementById("dangerBanner").getAttribute("role"), "status");
  assert.equal(document.getElementById("dangerBanner").getAttribute("aria-hidden"), "false");
  assert.equal(document.getElementById("dangerText").textContent, "TRAKTOR JE BLÍZKO");
  assert.equal(document.getElementById("app").classList.contains("danger-state"), true);
  assert.equal(document.getElementById("radarPanel").classList.contains("hidden"), true);
  assert.equal(document.getElementById("radarPanel").getAttribute("role"), "meter");
  assert.equal(document.getElementById("actionButton").classList.contains("ready"), true);
  assert.equal(document.getElementById("actionButton").getAttribute("aria-label"), "MLUVIT");
  assert.equal(document.getElementById("actionButton").getAttribute("aria-disabled"), "false");
  assert.equal(document.getElementById("actionButton").getAttribute("aria-pressed"), undefined);
  assert.equal(document.getElementById("actionIcon").textContent, "!");

  document.getElementById("objectiveLabel").textContent = "sentinel";
  events.emit("hud:model:changed", { revision: 7, model });
  assert.equal(document.getElementById("objectiveLabel").textContent, "sentinel");

  events.emit("hud:model:changed", {
    revision: 1,
    model: {
      missionNumber: 2,
      placeLabel: "Nesměň",
      objective: "Nová session",
      findings: 0,
      danger: 0,
      actionReady: false,
      actionLabel: "AKCE"
    }
  });
  assert.equal(document.getElementById("placeLabel").textContent, "NESMĚŇ");
  assert.equal(document.getElementById("objectiveLabel").textContent, "Nová session");
  assert.equal(document.getElementById("heatPill").classList.contains("detected"), false);
  assert.equal(document.getElementById("dangerBanner").getAttribute("aria-hidden"), "true");
  assert.equal(document.getElementById("actionButton").getAttribute("aria-disabled"), "true");
  assert.equal(document.getElementById("actionButton").classList.contains("unavailable"), true);
  assert.equal(document.getElementById("actionButton").getAttribute("aria-label"), "Akce není dostupná; přibliž se k cíli.");
  assert.equal(document.getElementById("actionIcon").textContent, "↗");
  assert.equal(document.getElementById("actionText").textContent, "PŘIBLIŽ SE");

  events.emit("finding:collected", { score: 90 });
  assert.equal(document.getElementById("toast").textContent, "NÁLEZ ZAPSÁN · +90 BODŮ");
  assert.equal(document.getElementById("toast").classList.contains("show"), true);
  assert.equal(document.getElementById("toast").getAttribute("role"), "status");
  events.emit("objective:complete", {});
  assert.equal(document.getElementById("toast").textContent, "ÚKOL SPLNĚN");

  hud.dispose();
  assert.equal(document.getElementById("app").classList.contains("danger-state"), false);
});

test("ScreenController exposes one-button dialog and exact-three dig overlay without gameplay state", () => {
  const document = createUiDocument();
  const screens = new ScreenController(document);
  let confirmed = 0;
  screens.showDialog({
    name: "Václav",
    text: "Na poli můžeš hledat, ale dávej pozor na traktor.",
    avatar: "V",
    buttonLabel: "ROZUMÍM",
    onConfirm: () => { confirmed += 1; }
  });

  assert.equal(screens.activeId, "dialogScreen");
  assert.equal(document.getElementById("dialogName").textContent, "VÁCLAV");
  assert.equal(document.getElementById("controls").classList.contains("hidden"), true);
  assert.equal(document.getElementById("dialogScreen").getAttribute("aria-hidden"), "false");
  document.getElementById("dialogButton").onclick({ preventDefault() {} });
  assert.equal(confirmed, 1);

  screens.showDig({
    hits: 2,
    requiredHits: DIG_REQUIRED_HITS,
    marker: 0.5,
    sweetMin: 0.4,
    sweetMax: 0.6,
    onAction() {}
  });
  assert.equal(screens.activeId, "digScreen");
  assert.equal(document.getElementById("digHitCount").textContent, "ZÁSAHY 2/3");
  assert.equal(document.getElementById("digHitSymbols").textContent, "◆ ◆ ◇");
  assert.match(document.getElementById("digHits").getAttribute("aria-label"), /ZÁSAHY 2\/3/);
  assert.equal(document.getElementById("digMarker").style.left, "calc(50% - 5px)");
  assert.equal(document.getElementById("sweetZone").style.left, "40%");
  assert.equal(document.getElementById("sweetZone").style.width, "19.999999999999996%");
  assert.match(document.getElementById("digButton").getAttribute("aria-label"), /2 z 3/);
  assert.throws(() => screens.updateDig({ requiredHits: 4 }), /literal 3/);
});

test("ScreenController pause recap preserves one resume action and exposes objective progress", () => {
  const document = createUiDocument();
  const screens = new ScreenController(document);
  let resumed = 0;
  screens.showPause({
    placeLabel: "Nesměň",
    objective: "Zasyp otevřenou díru",
    progress: 0.6,
    onResume: () => { resumed += 1; },
    onMenu: () => {}
  });

  assert.equal(document.getElementById("pausePlace").textContent, "NESMĚŇ · PAUZA");
  assert.equal(document.getElementById("pauseObjective").textContent, "Zasyp otevřenou díru");
  assert.equal(document.getElementById("pauseProgress").textContent, "POSTUP 60 %");
  assert.equal(document.getElementById("pauseProgress").getAttribute("role"), "progressbar");
  assert.equal(document.getElementById("pauseProgress").getAttribute("aria-valuenow"), "60");
  document.getElementById("resumeButton").onclick({ preventDefault() {} });
  assert.equal(resumed, 1);
});

test("ScreenController renders a generic level result and restores playing overlays", () => {
  const document = createUiDocument();
  const screens = new ScreenController(document);
  let continued = false;
  screens.showLevelResult({
    title: "První nález je v bezpečí",
    text: "Chlum je dokončen.",
    score: 150,
    stats: [{ label: "NÁLEZY", value: 1 }],
    onContinue: () => { continued = true; }
  });

  assert.equal(document.getElementById("resultKicker").textContent, "ÚROVEŇ DOKONČENA");
  assert.equal(document.getElementById("resultScore").textContent, "150");
  assert.equal(document.getElementById("resultStats").children.length, 1);
  assert.equal(document.getElementById("resultStats").children[0].children[0].textContent, "NÁLEZY");
  document.getElementById("againButton").onclick({ preventDefault() {} });
  assert.equal(continued, true);

  screens.play();
  assert.equal(screens.activeId, null);
  assert.equal(document.getElementById("hud").classList.contains("hidden"), false);
  assert.equal(document.getElementById("controls").classList.contains("hidden"), false);
});