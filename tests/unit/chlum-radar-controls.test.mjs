import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const root = new URL("../../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), "utf8");
const scene = read("src/scenes/ChlumScene.js");
const levels = read("src/data/levels.js");
const input = read("src/input/DomInputAdapter.js");
const html = read("index.html");
const smoke = read("tests/slavia-smoke.spec.mjs");
const hud = read("src/ui/HudController.js");
const v7 = read("v7.css");

test("Chlum uses action-driven radar and never opens the digging minigame", () => {
  assert.doesNotMatch(scene, /DigSystem|showDig|strikeDig|startDig|digHits/);
  assert.match(scene, /activateRadar\(\)/);
  assert.match(scene, /detectionRange/);
  assert.match(scene, /actionLabel: available\?\.interaction\.label \?\? \(this\.radarEnabled \? "RADAR" : "AKCE"\)/);
  assert.match(scene, /Radar odhalil vltavín/);
  assert.match(levels, /objective\("search-surface", "discover", "chlum-search-site", 1\)/);
  assert.doesNotMatch(levels, /objective\("dig-finding", "dig", "chlum-/);
});

test("the full-flow test reveals Chlum by radar and keeps rhythmic digging in Nesměň", () => {
  assert.match(smoke, /toHaveAttribute\("aria-label", "RADAR"\)/);
  assert.match(smoke, /revealed = activeRuntime\(await runtimeSnapshot\(page\)\)\?\.searched === true/);
  assert.match(smoke, /captureEvidence\(page, testInfo, "chlum-radar-finding"\)/);
  assert.match(smoke, /waitForTractorLeftOf\(page, maxX = 620, timeout = 75_000\)/);
  assert.match(smoke, /async function completeNesmen/);
  assert.match(smoke, /for \(let hit = 1; hit <= 3; hit\+\+\) await successfulDigHit/);
});

test("mobile keeps the touch joystick and action button while desktop keeps keyboard bindings", () => {
  for (const id of ["controls", "moveZone", "stick", "actionButton"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /aria-label="Dotykové ovládání"/);
  assert.match(input, /ArrowLeft: \[-1, 0\], KeyA: \[-1, 0\]/);
  assert.match(input, /ArrowRight: \[1, 0\], KeyD: \[1, 0\]/);
  assert.match(input, /const ACTION_KEYS = new Set\(\["Space", "Enter", "KeyE"\]\)/);
  assert.match(input, /this\.listen\(moveZone, "pointerdown"/);
  assert.match(input, /this\.listen\(action, "pointerdown"/);
  assert.match(smoke, /type: "touchMove", touchPoints: \[touchPoint\]/);
});

test("V7 HUD stays globally styled and exposes a visible radar instrument", () => {
  assert.match(hud, /ensureRadarPanel\(\)/);
  assert.match(hud, /panel\.id = "radarPanel"/);
  assert.match(hud, /radarPresentation\(model\)/);
  assert.match(hud, /normalized\.includes\("silný"\)/);
  assert.match(hud, /normalized\.includes\("slabý"\)/);
  assert.match(hud, /normalized\.includes\("bez signálu"\)/);
  assert.match(hud, /normalized\.includes\("odhalil"\)/);
  assert.match(v7, /\.radar-panel\{/);
  assert.match(v7, /\.system-panel \.bag-pill\{\s*display:flex/);
  assert.doesNotMatch(v7, /\.v7-visual-rebuild \.hud/);
  assert.doesNotMatch(v7, /\.system-panel \.bag-pill\{\s*display:none/);
});
