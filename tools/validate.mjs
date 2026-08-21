import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { GAME_EVENT_NAMES } from "../src/core/GameEvents.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];
const fail = message => errors.push(message);
const warn = message => warnings.push(message);
const absolute = relativePath => path.join(root, relativePath);
const exists = relativePath => fs.existsSync(absolute(relativePath));
const read = relativePath => {
  if (!exists(relativePath)) { fail(`Chybí soubor: ${relativePath}`); return ""; }
  return fs.readFileSync(absolute(relativePath), "utf8");
};
const countMatches = (source, pattern) => [...source.matchAll(pattern)].length;

const requiredFiles = ["index.html", "style.css", "manifest.webmanifest", "sw.js", "icon-180.png", "icon-192.png", "icon-512.png", "vendor/three.module.min.js", "src/bootstrap.js", "assets/manifests/assets.json"];
requiredFiles.forEach(relativePath => { if (!exists(relativePath)) fail(`Chybí povinný soubor: ${relativePath}`); });
const forbiddenLegacyFiles = [
  "game.js",
  "runtime-stability.js",
  "audio.js",
  "data.js",
  "src/adapters/LegacySaveAdapter.js",
  "src/adapters/LegacyDataAdapter.js",
  "src/state/GameState.js",
  "src/domain/index.js"
];
forbiddenLegacyFiles.forEach(relativePath => { if (exists(relativePath)) fail(`Legacy runtime soubor nesmí existovat: ${relativePath}`); });

// Save systém se v cílové architektuře nevyvíjí: persistence nesmí být ani v modulu mimo runtime graf.
const collectSourceFiles = (directory, collected = []) => {
  for (const entry of fs.readdirSync(absolute(directory), { withFileTypes: true })) {
    const child = `${directory}/${entry.name}`;
    if (entry.isDirectory()) collectSourceFiles(child, collected);
    else if (entry.name.endsWith(".js")) collected.push(child);
  }
  return collected;
};
const sourceFiles = exists("src") ? collectSourceFiles("src") : [];
const persistenceOffenders = sourceFiles.filter(relativePath => /localStorage|sessionStorage|indexedDB/.test(read(relativePath)));
if (persistenceOffenders.length) fail(`Zdrojové moduly nesmí obsahovat persistence vrstvu: ${persistenceOffenders.join(", ")}.`);
const distributionArchives = fs.readdirSync(root).filter(entry => entry.endsWith(".zip"));
if (distributionArchives.length) fail(`ZIP balíček není předáním práce a nesmí být v repozitáři: ${distributionArchives.join(", ")}.`);
const html = read("index.html");
const serviceWorker = read("sw.js");
const manifestText = read("manifest.webmanifest");
const assetManifestText = read("assets/manifests/assets.json");
const htmlIds = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
const htmlIdSet = new Set(htmlIds);
const duplicateIds = [...new Set(htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index))];
if (duplicateIds.length) fail(`Duplicitní HTML ID: ${duplicateIds.join(", ")}`);
const scripts = [...html.matchAll(/<script\b([^>]*)src=["']\.\/([^"']+)["'][^>]*>/g)].map(match => ({ attributes: match[1], path: match[2], source: match[0] }));
if (scripts.length !== 1 || scripts[0]?.path !== "src/bootstrap.js" || !/type=["']module["']/.test(scripts[0]?.source ?? "")) fail("index.html musí spouštět právě jeden modulární skript ./src/bootstrap.js.");
if (/src=["']\.\/(?:game|runtime-stability)\.js["']/.test(html)) fail("index.html stále spouští legacy gameplay runtime.");

const runtimeModules = new Set();
const runtimeModuleSources = new Map();
const queue = ["src/bootstrap.js"];
while (queue.length) {
  const relativePath = queue.shift();
  if (runtimeModules.has(relativePath)) continue;
  runtimeModules.add(relativePath);
  const source = read(relativePath);
  runtimeModuleSources.set(relativePath, source);
  const imports = [...source.matchAll(/(?:import|export)\s*(?:[^"']*?\s*from\s*)?["']([^"']+)["']/g)].map(match => match[1]);
  for (const specifier of imports) {
    if (!specifier.startsWith(".")) { fail(`Runtime používá nepřipnutý bare import v ${relativePath}: ${specifier}`); continue; }
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(relativePath), specifier));
    if (!exists(resolved)) fail(`Modul ${relativePath} importuje chybějící soubor: ${resolved}`);
    else if (resolved.endsWith(".js")) queue.push(resolved);
  }
}
const runtimeSource = [...runtimeModuleSources.values()].join("\n");
const firstPartyRuntimeEntries = [...runtimeModuleSources].filter(([relativePath]) => relativePath.startsWith("src/") && relativePath.endsWith(".js"));
const firstPartyRuntimeSource = firstPartyRuntimeEntries.map(([, source]) => source).join("\n");
if (/(?:game|runtime-stability)\.js/.test(runtimeSource)) fail("Produkční bootstrap importuje legacy runtime soubor.");
if (/getContext\s*\(\s*["']2d["']/.test(firstPartyRuntimeSource)) fail("Produkční bootstrap obsahuje zakázanou Canvas2D herní cestu.");
if (/LegacySaveAdapter|localStorage|sessionStorage/.test(runtimeSource)) fail("Produkční bootstrap importuje nebo používá zakázanou persistence/save vrstvu.");

const webglOwnerPaths = firstPartyRuntimeEntries
  .filter(([, source]) => /new\s+THREE\.WebGLRenderer\s*\(/.test(source))
  .map(([relativePath]) => relativePath);
const rendererConstructors = countMatches(firstPartyRuntimeSource, /new\s+THREE\.WebGLRenderer\s*\(/g);
if (rendererConstructors !== 1) fail(`Runtime musí vlastnit právě jeden WebGLRenderer; nalezeno: ${rendererConstructors}.`);
if (webglOwnerPaths.length !== 1 || webglOwnerPaths[0] !== "src/render/HybridRenderer.js") {
  fail(`Jediný konstrukční bod WebGLRenderer musí být src/render/HybridRenderer.js; nalezeno: ${webglOwnerPaths.join(", ") || "žádný"}.`);
}
const directHybridInstances = countMatches(firstPartyRuntimeSource, /new\s+HybridRenderer\s*\(/g);
if (directHybridInstances !== 0) fail(`HybridRenderer je interní základ a nesmí být přímo instancován; nalezeno: ${directHybridInstances}.`);
const hybridSubclassPaths = firstPartyRuntimeEntries
  .filter(([, source]) => /class\s+\w+\s+extends\s+HybridRenderer\b/.test(source))
  .map(([relativePath]) => relativePath);
if (hybridSubclassPaths.length !== 1 || hybridSubclassPaths[0] !== "src/render/ThreeRenderer.js") {
  fail(`Jediným potomkem HybridRenderer musí být src/render/ThreeRenderer.js; nalezeno: ${hybridSubclassPaths.join(", ") || "žádný"}.`);
}
const bootstrapSource = runtimeModuleSources.get("src/bootstrap.js") ?? "";
const bootstrapThreeRenderers = countMatches(bootstrapSource, /new\s+ThreeRenderer\s*\(/g);
if (bootstrapThreeRenderers !== 1) fail(`bootstrap.js musí vytvořit právě jeden ThreeRenderer; nalezeno: ${bootstrapThreeRenderers}.`);
const unauthorizedBootstrapRenderers = [...bootstrapSource.matchAll(/new\s+(\w*Renderer)\s*\(/g)]
  .map(match => match[1])
  .filter(name => name !== "ThreeRenderer");
if (unauthorizedBootstrapRenderers.length) fail(`bootstrap.js vytváří nepovolený renderer: ${unauthorizedBootstrapRenderers.join(", ")}.`);

const referencedIds = new Set([...[...runtimeSource.matchAll(/getElementById\(["']([^"']+)["']\)/g)].map(match => match[1]), ...[...runtimeSource.matchAll(/\.element\(["']([^"']+)["']\)/g)].map(match => match[1])]);
const missingIds = [...referencedIds].filter(id => !htmlIdSet.has(id)).sort();
if (missingIds.length) fail(`Runtime odkazuje na chybějící HTML ID: ${missingIds.join(", ")}`);

let manifest = null;
try { manifest = JSON.parse(manifestText); } catch (error) { fail(`Neplatný manifest.webmanifest: ${error.message}`); }
if (manifest) {
  if (!manifest.name || !manifest.short_name || !manifest.start_url) fail("Manifest musí obsahovat name, short_name a start_url.");
  if (!Array.isArray(manifest.icons) || !manifest.icons.length) fail("Manifest neobsahuje ikony.");
  for (const icon of manifest.icons ?? []) {
    const relativePath = String(icon.src ?? "").replace(/^\.\//, "");
    if (!relativePath || !exists(relativePath)) fail(`Manifest odkazuje na chybějící ikonu: ${icon.src ?? "(bez src)"}`);
  }
}

const cachedPaths = new Set([...serviceWorker.matchAll(/["']\.\/([^"']*)["']/g)].map(match => match[1]).filter(Boolean));
for (const relativePath of cachedPaths) if (!exists(relativePath)) fail(`Service worker cachuje chybějící soubor: ${relativePath}`);
for (const relativePath of runtimeModules) if (!cachedPaths.has(relativePath)) fail(`Produkční runtime modul není v offline cache: ${relativePath}`);
for (const relativePath of ["index.html", "style.css", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"]) if (!cachedPaths.has(relativePath)) fail(`PWA shell není v offline cache: ${relativePath}`);

let assetManifest = null;
let chlumAssetCount = 0;
let nesmenAssetCount = 0;
let deadAssetIds = [];
try { assetManifest = JSON.parse(assetManifestText); } catch (error) { fail(`Neplatný asset manifest: ${error.message}`); }
if (!Array.isArray(assetManifest)) fail("Asset manifest musí být pole.");
else {
  const ids = new Set();
  for (const entry of assetManifest) {
    if (!entry?.id || ids.has(entry.id)) fail(`Asset má chybějící nebo duplicitní ID: ${entry?.id ?? "(bez ID)"}`);
    ids.add(entry?.id);
    if (!entry?.type || !entry?.url || !String(entry.url).startsWith("./")) fail(`Asset ${entry?.id ?? "?"} musí mít typ a relativní URL.`);
    if (!entry?.preload || !entry?.disposeOwner) fail(`Asset ${entry?.id ?? "?"} nemá preload nebo disposeOwner.`);
    const relativePath = String(entry?.url ?? "").replace(/^\.\//, "");
    if (!relativePath || !exists(relativePath)) { fail(`Asset ${entry?.id ?? "?"} odkazuje na chybějící soubor: ${entry?.url ?? "(bez URL)"}`); continue; }
    if (!cachedPaths.has(relativePath)) fail(`Runtime asset není v offline cache: ${relativePath}`);
    const bytes = fs.statSync(absolute(relativePath)).size;
    if (!(entry.budget?.bytes >= bytes)) fail(`Asset ${entry.id} překračuje byte budget: ${bytes}/${entry.budget?.bytes ?? "?"}.`);
    if (entry.metrics?.bytes !== undefined && entry.metrics.bytes !== bytes) fail(`Asset ${entry.id} má neaktuální metrics.bytes: ${entry.metrics.bytes}/${bytes}.`);
    const buffer = fs.readFileSync(absolute(relativePath));
    if (relativePath.endsWith(".png")) {
      if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") fail(`Asset ${entry.id} není platný PNG.`);
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      if (entry.dimensions && (entry.dimensions.width !== width || entry.dimensions.height !== height)) fail(`Asset ${entry.id} má nesoulad rozměrů.`);
      const textureMax = entry.budget?.textureMax ?? 0;
      if (textureMax && Math.max(width, height) > textureMax) fail(`Asset ${entry.id} překračuje textureMax.`);
    } else if (relativePath.endsWith(".glb")) {
      if (buffer.subarray(0, 4).toString("ascii") !== "glTF" || buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== bytes) fail(`Asset ${entry.id} není platný GLB 2.0.`);
      if (!entry.pivot || !entry.boundsMeters) fail(`GLB asset ${entry.id} nemá pivot nebo boundsMeters.`);
      if (!(entry.metrics?.triangles <= entry.budget?.triangles)) fail(`GLB asset ${entry.id} překračuje triangle budget.`);
    }
  }
  // Preload je čistý kontrakt: co runtime nikdy nepoužije, nesmí se stahovat ani cachovat.
  deadAssetIds = assetManifest
    .filter(entry => entry?.id && !runtimeSource.includes(`"${entry.id}"`) && !runtimeSource.includes(`'${entry.id}'`))
    .map(entry => entry.id);
  if (deadAssetIds.length) fail(`Manifest preloaduje assety, které produkční runtime nikdy nepoužije: ${deadAssetIds.join(", ")}.`);
  chlumAssetCount = assetManifest.filter(entry => entry.preload === "common" || entry.preload === "level:chlum").length;
  nesmenAssetCount = assetManifest.filter(entry => entry.preload === "level:nesmen").length;
  if (chlumAssetCount !== 15) fail(`Chlum/common preload musí obsahovat 15 assetů; nalezeno: ${chlumAssetCount}.`);
  if (nesmenAssetCount !== 6) fail(`Nesměň preload musí obsahovat 6 assetů; nalezeno: ${nesmenAssetCount}.`);
}

const visibleVersion = html.match(/\bv(\d+)\.(\d+)\b/)?.slice(1).join(".");
const cacheVersion = serviceWorker.match(/CACHE\s*=\s*["'][^"']*v(\d+)-(\d+)(?:-[^"']+)?["']/)?.slice(1, 3).join(".");
if (!visibleVersion || !cacheVersion) fail("Nelze určit verzi UI nebo PWA cache.");
else if (visibleVersion !== cacheVersion) fail(`Nesoulad UI a cache verze: ${visibleVersion} vs ${cacheVersion}.`);
const expectedEvents = 34;
if (GAME_EVENT_NAMES.length !== expectedEvents) fail(`Eventový katalog musí mít ${expectedEvents} položek; nalezeno: ${GAME_EVENT_NAMES.length}.`);
if (!runtimeSource.includes("fixedStep: options.fixedStep ?? 1 / 60")) fail("GameApp nemá rozpoznaný fixed timestep 60 Hz.");
if (!runtimeSource.includes("maxFrameDelta: options.maxFrameDelta ?? 0.1")) fail("GameApp nemá limit frame delta 100 ms.");
if (!runtimeSource.includes("maxSubSteps: options.maxSubSteps ?? 5")) fail("GameApp nemá limit pěti substepů.");
console.log(`Kontrolováno HTML ID: ${htmlIds.length}`);
console.log(`Kontrolováno runtime DOM referencí: ${referencedIds.size}`);
console.log(`Kontrolováno runtime modulů: ${runtimeModules.size}`);
console.log(`Kontrolováno zakázaných legacy souborů: ${forbiddenLegacyFiles.length}`);
console.log(`Kontrolováno zdrojových modulů na persistenci: ${sourceFiles.length}`);
console.log(`Kontrolováno PWA cest: ${cachedPaths.size}`);
console.log(`Kontrolováno Chlum/common assetů: ${chlumAssetCount}`);
console.log(`Kontrolováno Nesměň assetů: ${nesmenAssetCount}`);
console.log(`Kontrolováno assetů celkem: ${Array.isArray(assetManifest) ? assetManifest.length : 0}`);
console.log(`Nalezeno nepoužitých preload assetů: ${deadAssetIds.length}`);
console.log(`Kontrolováno eventových kontraktů: ${GAME_EVENT_NAMES.length}`);
console.log(`Rozpoznaná release verze: ${visibleVersion ?? "neuvedena"}`);
for (const message of warnings) console.warn(`VAROVÁNÍ: ${message}`);
for (const message of errors) console.error(`CHYBA: ${message}`);
if (errors.length) { console.error(`\nValidace selhala: ${errors.length} chyba/chyby, ${warnings.length} varování.`); process.exit(1); }
console.log(`\nValidace úspěšná: 0 chyb, ${warnings.length} varování.`);
