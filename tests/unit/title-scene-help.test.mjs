import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { TitleScene } from "../../src/scenes/TitleScene.js";

const rootUrl = new URL("../../", import.meta.url);
const html = fs.readFileSync(new URL("index.html", rootUrl), "utf8");

class FakeElement {
  constructor() {
    this.listeners = new Map();
    this.textContent = "";
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  emit(type, event) {
    this.listeners.get(type)?.(event);
  }
}

test("TitleScene closes only an open help screen with Escape", async () => {
  const elements = new Map([
    ["playButton", new FakeElement()],
    ["howButton", new FakeElement()],
    ["closeHowButton", new FakeElement()]
  ]);
  const document = {
    getElementById: id => elements.get(id),
    querySelector: selector => selector === ".version" ? new FakeElement() : null,
    addEventListener(type, listener) {
      this.keyListener = type === "keydown" ? listener : null;
    }
  };
  const calls = [];
  const scene = new TitleScene({
    document,
    screens: {
      showTitle: () => calls.push("title"),
      show: (id, options) => calls.push([id, options])
    },
    onStart: () => {}
  });

  await scene.enter();
  let prevented = false;
  document.keyListener({ key: "Escape", preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);
  assert.deepEqual(calls, ["title"]);

  elements.get("howButton").emit("click", { preventDefault() {} });
  document.keyListener({ key: "Escape", preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(calls, ["title", ["howScreen", { playing: false }], "title"]);
});

test("title version is player-facing and stays aligned with the runtime label", () => {
  assert.match(html, /<p class="version">v7\.0 · Čtyři lokality<\/p>/);
  assert.doesNotMatch(html, /Modular Bootstrap/);
});
