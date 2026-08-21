import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const rootUrl = new URL("../../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, rootUrl), "utf8");
const bootstrap = read("src/bootstrap.js");
const scene = read("src/scenes/BesedniceScene.js");
const slavia = read("src/scenes/SlaviaScene.js");
const bridge = read("src/scenes/NesmenBesedniceBridgeScene.js");
const serviceWorker = read("sw.js");
const mobileSmoke = read("tests/mobile-smoke.spec.mjs");
const slaviaSmoke = read("tests/slavia-smoke.spec.mjs");
const playwrightConfig = read("playwright.config.mjs");
const validationWorkflow = read(".github/workflows/validate.yml");
const manifest = JSON.parse(read("assets/manifests/assets.json"));

const expectedAssets = Object.freeze([
  "npc-rival-karel",
  "finding-vltavin-besednice-hedgehog",
  "terrain-besednice-clay-quarry-v7",
  "foreground-besednice-quarry-edge-v7",
  "model-besednice-trace-marker",
  "model-besednice-hedgehog-marker"
]);

test("bootstrap registers one canonical instance of every production scene", () => {
  assert.match(bootstrap, /import \{ BesedniceScene \} from "\.\/scenes\/BesedniceScene\.js"/);
  assert.match(bootstrap, /import \{ SlaviaScene \} from "\.\/scenes\/SlaviaScene\.js"/);
  assert.doesNotMatch(bootstrap, /BesedniceSlaviaBridgeScene|ProductionSlaviaScene|ensureSlaviaRegistered/);
  for (const id of ["title", "chlum", "nesmen", "besednice", "slavia"]) {
    assert.equal((bootstrap.match(new RegExp(`app\\.scenes\\.register\\("${id}"`, "g")) ?? []).length, 1);
  }
});

test("Besednice result directly continues into canonical Slavia", () => {
  assert.match(scene, /nextLevelId: "slavia"/);
  assert.match(scene, /buttonLabel: "POKRAČOVAT DO SLAVIE"/);
  assert.match(scene, /changeScene\("slavia"\)/);
  assert.doesNotMatch(scene, /ensureSlaviaRegistered|BesedniceSlaviaBridgeScene/);
});

test("Nesměň production result continues only into Besednice", () => {
  assert.match(bridge, /nextLevelId: "besednice"/);
  assert.match(bridge, /changeScene\("besednice"\)/);
  assert.doesNotMatch(bridge, /changeScene\("slavia"\)/);
});

test("canonical Slavia resolves textures and binds canonical assets", () => {
  assert.match(slavia, /loadedTextures = new Map/);
  assert.match(slavia, /npc-thief-franta/);
  assert.doesNotMatch(slavia, /npc-rival-franta|ProductionSlaviaScene/);
  assert.match(slavia, /model-slavia-document-folder/);
  assert.doesNotMatch(slavia, /BoxGeometry\(34, 24, 6\)/);
});

test("Besednice manifest pack has stable IDs, budgets and lifecycle owners", () => {
  const byId = new Map(manifest.map(entry => [entry.id, entry]));
  assert.equal(new Set(manifest.map(entry => entry.id)).size, manifest.length);
  for (const id of expectedAssets) {
    const entry = byId.get(id);
    assert.ok(entry, `missing ${id}`);
    assert.equal(entry.preload, "level:besednice");
    assert.match(entry.url, /^\.\/assets\//);
    assert.ok(entry.budget?.bytes > 0);
    assert.equal(entry.disposeOwner, "LevelScene:besednice");
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  }
  assert.deepEqual(byId.get("terrain-besednice-clay-quarry-v7")?.dimensions, { width: 1436, height: 1095 });
  assert.equal(byId.get("foreground-besednice-quarry-edge-v7")?.transparent, true);
  assert.deepEqual(byId.get("foreground-besednice-quarry-edge-v7")?.dimensions, { width: 1344, height: 1024 });
  assert.match(scene, /createTerrainPlate\(environmentTexture/);
  assert.match(scene, /besednice-v7-foreground-occlusion/);
});

test("service worker includes only canonical production scene modules", () => {
  for (const path of [
    "./src/data/besednice.js",
    "./src/gameplay/BossSystem.js",
    "./src/scenes/NesmenBesedniceBridgeScene.js",
    "./src/scenes/BesedniceScene.js",
    "./src/scenes/SlaviaScene.js"
  ]) assert.ok(serviceWorker.includes(path), `service worker missing ${path}`);
  assert.doesNotMatch(serviceWorker, /BesedniceSlaviaBridgeScene|ProductionSlaviaScene/);
  assert.equal(fs.existsSync(new URL("src/scenes/BesedniceSlaviaBridgeScene.js", rootUrl)), false);
  assert.equal(fs.existsSync(new URL("src/scenes/ProductionSlaviaScene.js", rootUrl)), false);
});

test("validation remains read-only", () => {
  assert.match(validationWorkflow, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(validationWorkflow, /contents: write|internal-tree-sha|git push origin/);
});

test("Playwright defines desktop, portrait and landscape projects", () => {
  for (const project of ["desktop-chromium", "iphone-portrait", "iphone-portrait-smoke", "iphone-landscape"]) {
    assert.match(playwrightConfig, new RegExp(`name: "${project}"`));
  }
  assert.match(playwrightConfig, /metadata: \{ inputMode: "desktop", orientation: "landscape" \}/);
  assert.equal((playwrightConfig.match(/metadata: \{ inputMode: "touch"/g) ?? []).length, 3);
  assert.match(playwrightConfig, /viewport: \{ width: 390, height: 844 \}/);
  assert.match(playwrightConfig, /viewport: \{ width: 844, height: 390 \}/);
  assert.match(playwrightConfig, /name: "iphone-portrait",\s*testMatch: \/slavia-smoke\\\.spec\\\.mjs\$\//);
  assert.match(playwrightConfig, /name: "iphone-portrait-smoke",\s*testMatch: \[\/mobile-smoke\\\.spec\\\.mjs\$\/, \/radar-hud-smoke\\\.spec\\\.mjs\$\/\]/);
  assert.match(validationWorkflow, /name: Playwright — \$\{\{ matrix\.project \}\}/);
  for (const project of ["desktop-chromium", "audio-lifecycle-chromium", "iphone-portrait", "iphone-portrait-smoke", "iphone-landscape"]) {
    assert.match(validationWorkflow, new RegExp(`- ${project}`));
  }
  assert.match(validationWorkflow, /fail-fast: false/);
  assert.match(validationWorkflow, /playwright install --with-deps --only-shell chromium/);
  assert.doesNotMatch(validationWorkflow, /playwright install --with-deps chromium/);
  assert.match(validationWorkflow, /--project="\$\{\{ matrix\.project \}\}"/);
});

test("desktop and mobile smoke use project-native normalized input", () => {
  assert.match(mobileSmoke, /newCDPSession\(page\)/);
  assert.match(mobileSmoke, /Input\.dispatchTouchEvent/);
  assert.doesNotMatch(mobileSmoke, /page\.keyboard|page\.mouse|\.click\(\)|\.onclick|handler\.call/);

  assert.match(slaviaSmoke, /metadata\?\.inputMode === "desktop"/);
  assert.match(slaviaSmoke, /page\.keyboard\.press\("KeyE"\)/);
  assert.match(slaviaSmoke, /const repeatTimer = setInterval/);
  assert.match(slaviaSmoke, /page\.keyboard\.down\(key\)\.catch/);
  assert.match(slaviaSmoke, /clearInterval\(repeatTimer\)/);
  assert.match(slaviaSmoke, /newCDPSession\(page\)/);
  assert.match(slaviaSmoke, /Input\.dispatchTouchEvent/);
  assert.match(slaviaSmoke, /\{ timeout: 20_000 \}\)\.toEqual/);
  assert.doesNotMatch(slaviaSmoke, /let moveZoneBox = null/);
  assert.match(slaviaSmoke, /const moveZoneBox = await zone\.boundingBox\(\)/);
  assert.match(slaviaSmoke, /const movementTimeout = input\.desktop \? timeout : timeout \+ 30_000/);
  assert.match(slaviaSmoke, /pauseForBesedniceEvidence\(page, timeout = 20_000\)/);
  assert.match(slaviaSmoke, /window\.__slaviaQaInteraction\?\.performed \?\? null\), \{\s*timeout: 6_000,/);
  assert.match(slaviaSmoke, /test\.setTimeout\(900_000\)/);
  assert.match(slaviaSmoke, /Date\.now\(\) \+ movementTimeout \+ 2_000/);
  assert.match(slaviaSmoke, /Math\.min\(8_000, Math\.max\(1, movementDeadline - Date\.now\(\)\)\)/);
  assert.match(slaviaSmoke, /while \(!movement\?\.done\)/);
  assert.match(slaviaSmoke, /Chlum → Nesměň → Besednice → Slavia uses the project-native input/);
  assert.doesNotMatch(slaviaSmoke, /\.onclick|handler\.call|element\.click\(\)|recordFinding|ensureSlaviaRegistered|changeScene\("slavia"\)|session\.reset\(\)/);
  for (const artifact of ["slavia-arrival", "slavia-certification", "slavia-final-result"]) assert.ok(slaviaSmoke.includes(artifact));
});
