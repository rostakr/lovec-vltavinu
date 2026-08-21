import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { AudioRegistry } from "../../src/audio/AudioRegistry.js";

function entry(overrides = {}) {
  return {
    id: "audio-music-journey",
    type: "audio",
    url: "./assets/audio/journey-loop.mp3",
    preload: "audio:gesture",
    role: "music",
    loop: true,
    volume: 0.34,
    metrics: { bytes: 4353 },
    budget: { bytes: 8192 },
    sha256: "58e6b38769998ecfc281f8a7d8fce4b55b648a7e2fabf7e09cfdc6f2a36e03d4",
    disposeOwner: "AudioEngine",
    license: {
      spdx: "CC0-1.0",
      source: "Project-original procedural synthesis; no external samples.",
      notice: "./assets/audio/LICENSE.md"
    },
    ...overrides
  };
}

test("AudioRegistry imports only audio manifest entries", () => {
  const registry = AudioRegistry.fromManifest([
    entry(),
    { id: "texture", type: "texture", url: "./assets/x.png" }
  ]);
  assert.equal(registry.snapshot().length, 1);
  assert.equal(registry.require("audio-music-journey").role, "music");
});

test("AudioRegistry rejects duplicate ids and non-relative URLs", () => {
  assert.throws(() => new AudioRegistry([entry(), entry()]), /Duplicate audio asset id/);
  assert.throws(() => new AudioRegistry([entry({ url: "https://example.com/audio.mp3" })]), /must be relative/);
});

test("AudioRegistry enforces bytes, budget, checksum, owner and license", () => {
  assert.throws(() => new AudioRegistry([entry({ metrics: {} })]), /metrics.bytes/);
  assert.throws(() => new AudioRegistry([entry({ budget: { bytes: 1000 } })]), /exceeds or lacks budget.bytes/);
  assert.throws(() => new AudioRegistry([entry({ sha256: "abc123" })]), /64 lowercase hex/);
  assert.throws(() => new AudioRegistry([entry({ disposeOwner: "" })]), /disposeOwner/);
  assert.throws(() => new AudioRegistry([entry({ license: null })]), /license metadata/);
  assert.throws(() => new AudioRegistry([entry({ license: { spdx: "CC0-1.0", source: "project" } })]), /license.notice/);
});

test("AudioRegistry groups entries by preload and role", () => {
  const registry = new AudioRegistry([
    entry(),
    entry({
      id: "audio-sfx-dig-hit",
      url: "./assets/audio/dig-hit.mp3",
      role: "effect",
      loop: false,
      metrics: { bytes: 1010 },
      budget: { bytes: 4096 },
      sha256: "32cd46cd2d1e509fb1e162e9eb005f2bbf9b6bf6542fdbd64dcab2ac08197ea3"
    })
  ]);
  assert.deepEqual(registry.byPreload("audio:gesture").map(item => item.id), ["audio-music-journey", "audio-sfx-dig-hit"]);
  assert.deepEqual(registry.byRole("music").map(item => item.id), ["audio-music-journey"]);
});

test("committed audio files match manifest bytes and SHA-256", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../assets/manifests/assets.json", import.meta.url), "utf8"));
  const audioEntries = manifest.filter(item => item.type === "audio");
  assert.equal(audioEntries.length, 4);

  const actual = {};
  const expected = {};
  for (const item of audioEntries) {
    const fileUrl = new URL(`../../${item.url.slice(2)}`, import.meta.url);
    const file = await readFile(fileUrl);
    const fileStat = await stat(fileUrl);
    actual[item.id] = {
      bytes: fileStat.size,
      sha256: createHash("sha256").update(file).digest("hex")
    };
    expected[item.id] = {
      bytes: item.metrics.bytes,
      sha256: item.sha256
    };
  }
  assert.deepEqual(actual, expected);
});
