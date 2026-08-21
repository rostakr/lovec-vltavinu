import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "assets/manifests/assets.json"), "utf8"));
const byId = new Map(manifest.map(entry => [entry.id, entry]));

const assets = Object.freeze([
  {
    id: "terrain-slavia-event-plate-v7",
    png: "assets/textures/terrain/slavia-event-plate-v7.png",
    webp: "assets/textures/terrain/slavia-event-plate-v7.webp",
    args: ["-q", "92", "-m", "6"]
  },
  {
    id: "foreground-slavia-event-edge-v7",
    png: "assets/sprites/foreground/slavia-event-edge-v7.png",
    webp: "assets/sprites/foreground/slavia-event-edge-v7.webp",
    args: ["-q", "92", "-m", "6", "-alpha_q", "95"]
  }
]);

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  if (result.error) {
    const hint = command === "cwebp" ? " Install the WebP tools first (brew install webp / apt install webp)." : "";
    throw new Error(`Failed to run ${command}: ${result.error.message}.${hint}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with ${result.status}: ${(result.stderr || result.stdout || "").trim()}`);
  }
  return result;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function verifyGeneratedWebp(asset, buffer) {
  const entry = byId.get(asset.id);
  if (!entry) throw new Error(`Manifest is missing ${asset.id}.`);
  const expectedUrl = `./${asset.webp}`;
  if (entry.url !== expectedUrl) {
    throw new Error(`${asset.id} manifest URL must be ${expectedUrl}, got ${entry.url}.`);
  }
  if (buffer.subarray(0, 4).toString("ascii") !== "RIFF" || buffer.subarray(8, 12).toString("ascii") !== "WEBP") {
    throw new Error(`${asset.id} generated output is not a WebP file.`);
  }
  if (buffer.byteLength !== entry.metrics?.bytes) {
    throw new Error(`${asset.id} byte mismatch: generated ${buffer.byteLength}, manifest ${entry.metrics?.bytes}.`);
  }
  const digest = sha256(buffer);
  if (digest !== entry.sha256) {
    throw new Error(`${asset.id} SHA-256 mismatch: generated ${digest}, manifest ${entry.sha256}.`);
  }
  return digest;
}

const generatedPngs = assets.map(asset => path.join(root, asset.png));
const tempWebps = assets.map(asset => path.join(root, `${asset.webp}.generated`));

try {
  run(process.execPath, [path.join("tools", "art", "build-slavia-v7-png.mjs")]);

  for (const asset of assets) {
    const pngPath = path.join(root, asset.png);
    const outputPath = path.join(root, asset.webp);
    const tempPath = `${outputPath}.generated`;
    if (!fs.existsSync(pngPath)) throw new Error(`PNG generator did not create ${asset.png}.`);

    run("cwebp", ["-quiet", ...asset.args, asset.png, "-o", `${asset.webp}.generated`]);
    const generated = fs.readFileSync(tempPath);
    const digest = verifyGeneratedWebp(asset, generated);
    fs.writeFileSync(outputPath, generated);
    fs.rmSync(tempPath, { force: true });
    console.log(`${asset.webp}  ${generated.byteLength} B  sha256:${digest}`);
  }
} finally {
  for (const file of generatedPngs) fs.rmSync(file, { force: true });
  for (const file of tempWebps) fs.rmSync(file, { force: true });
}

console.log("Slavia V7 production WebP assets reproduced exactly from repository-owned raster source.");
