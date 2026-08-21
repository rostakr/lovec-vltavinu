import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const count = (source, pattern) => [...source.matchAll(pattern)].length;

function inspectRendererOwnership(sources) {
  const errors = [];
  const entries = Object.entries(sources);
  const webglOwners = entries.filter(([, source]) => /new\s+THREE\.WebGLRenderer\s*\(/.test(source));
  if (webglOwners.length !== 1 || webglOwners[0]?.[0] !== "src/render/HybridRenderer.js") {
    errors.push("WebGLRenderer must have one construction point in HybridRenderer.js.");
  }

  const directHybridInstances = entries.reduce(
    (total, [, source]) => total + count(source, /new\s+HybridRenderer\s*\(/g),
    0
  );
  if (directHybridInstances !== 0) errors.push("HybridRenderer must not be instantiated directly in production sources.");

  const hybridSubclasses = entries.filter(([, source]) => /class\s+\w+\s+extends\s+HybridRenderer\b/.test(source));
  if (hybridSubclasses.length !== 1 || hybridSubclasses[0]?.[0] !== "src/render/ThreeRenderer.js") {
    errors.push("ThreeRenderer must be the only HybridRenderer subclass.");
  }

  const bootstrap = sources["src/bootstrap.js"] ?? "";
  if (count(bootstrap, /new\s+ThreeRenderer\s*\(/g) !== 1) {
    errors.push("bootstrap.js must construct exactly one ThreeRenderer.");
  }
  const otherBootstrapRenderers = [...bootstrap.matchAll(/new\s+(\w*Renderer)\s*\(/g)]
    .map(match => match[1])
    .filter(name => name !== "ThreeRenderer");
  if (otherBootstrapRenderers.length) errors.push("bootstrap.js constructs an unauthorized renderer.");

  return errors;
}

const productionSources = {
  "src/render/HybridRenderer.js": read("src/render/HybridRenderer.js"),
  "src/render/ThreeRenderer.js": read("src/render/ThreeRenderer.js"),
  "src/bootstrap.js": read("src/bootstrap.js")
};

test("production renderer ownership contract is valid", () => {
  assert.deepEqual(inspectRendererOwnership(productionSources), []);
});

test("contract rejects a second WebGLRenderer construction point", () => {
  const sources = {
    ...productionSources,
    "src/render/RogueRenderer.js": "const renderer = new THREE.WebGLRenderer();"
  };
  assert.match(inspectRendererOwnership(sources).join("\n"), /one construction point/);
});

test("contract rejects direct HybridRenderer production construction", () => {
  const sources = {
    ...productionSources,
    "src/bootstrap.js": `${productionSources["src/bootstrap.js"]}\nnew HybridRenderer({});`
  };
  assert.match(inspectRendererOwnership(sources).join("\n"), /must not be instantiated directly/);
});

test("contract rejects a second HybridRenderer subclass", () => {
  const sources = {
    ...productionSources,
    "src/render/RogueRenderer.js": "class RogueRenderer extends HybridRenderer {}"
  };
  assert.match(inspectRendererOwnership(sources).join("\n"), /only HybridRenderer subclass/);
});

test("contract rejects a second renderer in bootstrap", () => {
  const sources = {
    ...productionSources,
    "src/bootstrap.js": `${productionSources["src/bootstrap.js"]}\nnew RogueRenderer({});`
  };
  assert.match(inspectRendererOwnership(sources).join("\n"), /unauthorized renderer/);
});
