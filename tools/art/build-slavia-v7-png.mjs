// Builds the repository-owned Slavia V7 production art:
//   assets/textures/terrain/slavia-event-plate-v7.png    — authored terrain plate (1440x880)
//   assets/sprites/foreground/slavia-event-edge-v7.png   — transparent foreground occlusion
//
// Run with:  node tools/art/build-slavia-v7-art.mjs
// The output is deterministic; re-running the script reproduces byte-identical files.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  clamp,
  createRng,
  createSurface,
  encodePng,
  fbm,
  fillEllipse,
  fillPolygon,
  fillRect,
  forEachPixel,
  mixColor,
  shade,
  smoothstep,
  strokeLine,
  strokePath,
  valueNoise
} from "./raster.mjs";
import {
  drawBench,
  drawBin,
  drawBuntingLine,
  drawBush,
  drawCar,
  drawDisplayCase,
  drawFlagPole,
  drawGateArch,
  drawPerson,
  drawPottedPlant,
  drawStall,
  drawText,
  drawTree,
  drawVan,
  groundShadow,
  paintedGround,
  textWidth
} from "./slavia-props.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORLD = Object.freeze({ width: 1800, height: 1100 });
const PLATE = Object.freeze({ width: 1440, height: 880 });
const SCALE = PLATE.width / WORLD.width;

const toImage = (worldX, worldY) => [worldX * SCALE, (WORLD.height - worldY) * SCALE];

// Canonical gameplay anchors (world coordinates from src/data/levels.js).
const ANCHORS = Object.freeze({
  spawn: toImage(380, 860),
  documentChlum: toImage(410, 760),
  documentNesmen: toImage(790, 460),
  documentBesednice: toImage(1130, 780),
  eva: toImage(1450, 430),
  franta: toImage(1020, 260),
  venue: toImage(1630, 520)
});

// Actors are ~86 px tall in plate space; keep authored props out of those columns
// so no mandatory target is hidden behind painted geometry.
const CLEAR_ZONES = Object.values(ANCHORS).map(([x, y]) => ({
  x0: x - 58,
  y0: y - 112,
  x1: x + 58,
  y1: y + 26
}));

const WALKABLE = {
  x0: 340 * SCALE,
  x1: 1700 * SCALE,
  y0: (WORLD.height - 980) * SCALE,
  y1: (WORLD.height - 120) * SCALE
};

function blocked(x0, y0, x1, y1) {
  return CLEAR_ZONES.some(zone => x0 <= zone.x1 && x1 >= zone.x0 && y0 <= zone.y1 && y1 >= zone.y0);
}

const RIVER_EDGE = y => 178 + Math.sin(y * 0.0072) * 24 + Math.sin(y * 0.021 + 1.7) * 10;
const QUAY_EDGE = y => RIVER_EDGE(y) + 64;

function paintGrass(surface) {
  forEachPixel(surface, (x, y) => {
    const base = paintedGround(x, y, 3301, [[86, 106, 56], [122, 140, 74]], { scale: 0.0052, contrast: 1.25 });
    const dry = fbm(x * 0.011, y * 0.011, { seed: 771, octaves: 4 });
    const tone = mixColor(base, [150, 152, 92], clamp((dry - 0.58) * 1.9, 0, 0.55));
    const band = Math.sin((x * 0.34 + y * 0.9) * 0.06 + fbm(x * 0.004, y * 0.004, { seed: 88, octaves: 2 }) * 5) * 0.5 + 0.5;
    const mown = mixColor(tone, mixColor(tone, [176, 184, 128], 0.34), band * 0.55);
    const clover = valueNoise(x * 0.32, y * 0.32, 9001) > 0.82 ? 0.3 : 0;
    const flowered = mixColor(mown, [196, 200, 150], clover * (valueNoise(x * 2.4, y * 2.4, 9002) > 0.7 ? 1 : 0.15));
    const blade = (valueNoise(x * 1.9, y * 2.7, 4402) - 0.5) * 13;
    return [flowered[0] + blade, flowered[1] + blade * 1.1, flowered[2] + blade * 0.6];
  });
}

function paintRiver(surface) {
  const rng = createRng(9111);
  for (let y = 0; y < surface.height; y++) {
    const edge = RIVER_EDGE(y);
    for (let x = 0; x < edge + 30; x++) {
      const depth = clamp((edge - x) / 170, 0, 1);
      const swell = fbm(x * 0.013, y * 0.05, { seed: 88, octaves: 5, gain: 0.58 });
      const chop = fbm(x * 0.07, y * 0.19, { seed: 143, octaves: 3, gain: 0.5 });
      const deep = mixColor([38, 62, 74], [58, 92, 100], swell);
      const shallow = mixColor([96, 126, 118], [142, 162, 142], swell * 0.6 + chop * 0.4);
      const water = mixColor(shallow, deep, smoothstep(0, 0.62, depth));
      const alpha = smoothstep(edge + 10, edge - 16, x);
      if (alpha <= 0) continue;
      // reflected bank vegetation drifts along the near shore
      const reflection = clamp((0.34 - depth) * 2.4, 0, 1) * (0.4 + chop * 0.6);
      const tinted = mixColor(water, [64, 92, 70], reflection * 0.42);
      const glintSource = swell * 0.55 + chop * 0.45;
      const glint = glintSource > 0.72 ? (glintSource - 0.72) * 320 * (0.35 + depth) : 0;
      fillRect(surface, x, y, x, y, () => [
        clamp(tinted[0] + glint, 0, 255),
        clamp(tinted[1] + glint, 0, 255),
        clamp(tinted[2] + glint * 0.86, 0, 255),
        alpha
      ]);
    }
    // foam line where the current meets the gravel shore
    fillRect(surface, edge - 12, y, edge + 6, y, x => {
      const foam = fbm(x * 0.16, y * 0.16, { seed: 205, octaves: 3 });
      return [232, 236, 228, clamp((foam - 0.44) * 1.5, 0, 0.5) * smoothstep(edge + 8, edge - 10, x)];
    });
  }
  // wet gravel shore between the water and the quay wall
  for (let y = 0; y < surface.height; y++) {
    const edge = RIVER_EDGE(y);
    fillRect(surface, edge - 4, y, edge + 22, y, x => {
      const t = clamp((x - edge) / 26, 0, 1);
      const pebble = valueNoise(x * 1.3, y * 1.3, 551);
      const tone = mixColor([120, 122, 108], [166, 158, 136], pebble);
      return [...tone, (1 - t) * 0.85];
    });
  }
  // current lines — flowing surface streaks that break the flat water read
  for (let index = 0; index < 40; index++) {
    const streamY = rng() * surface.height;
    const streamX = rng() * (RIVER_EDGE(streamY) - 40) + 10;
    const streamLen = 20 + rng() * 60;
    strokeLine(surface, streamX, streamY, streamX - streamLen * 0.15, streamY + streamLen, 1.6 + rng() * 1.4, (_x, _y, _u, v) => {
      return [186, 202, 206, 0.14 * (1 - Math.abs(v - 0.5) * 2)];
    });
  }
  for (let index = 0; index < 900; index++) {
    const y = rng() * surface.height;
    const x = RIVER_EDGE(y) + 4 + rng() * 30;
    fillEllipse(surface, x, y, 1.4 + rng() * 2.6, 1.1 + rng() * 1.8, (_px, _py, distance) => [
      ...mixColor([150, 146, 130], [206, 198, 176], rng()),
      0.7 * (1 - distance)
    ], { softness: 0.5 });
  }
}

function paintQuay(surface) {
  const rng = createRng(6421);
  for (let y = 0; y < surface.height; y++) {
    const start = RIVER_EDGE(y) + 18;
    const end = QUAY_EDGE(y);
    fillRect(surface, start, y, end, y, x => {
      const u = (x - start) / Math.max(1, end - start);
      const block = Math.floor((y + Math.sin(x * 0.05) * 3) / 34) + Math.floor(u * 3);
      const stone = mixColor([150, 142, 126], [188, 180, 160], valueNoise(block * 5.7, y * 0.03, 77));
      const joint = Math.abs(((y + 17) % 34) - 17) < 1.4 ? 0.72 : 1;
      const light = 1.1 - u * 0.24;
      return [...shade(stone, clamp(light * joint + (valueNoise(x * 1.6, y * 1.6, 903) - 0.5) * 0.16, 0.6, 1.3)), 1];
    });
    // railing shadow onto the promenade
    fillRect(surface, end, y, end + 10, y, x => [40, 44, 38, 0.22 * (1 - (x - end) / 12)]);
  }
  for (let y = 12; y < surface.height; y += 46) {
    const x = QUAY_EDGE(y) - 8;
    strokeLine(surface, x, y, x, y - 34, 4.4, () => [214, 208, 192, 0.95]);
    groundShadow(surface, x + 7, y + 1, 8, 3.4, 0.3);
  }
  for (let y = 12; y < surface.height - 46; y += 46) {
    const x0 = QUAY_EDGE(y) - 8;
    const x1 = QUAY_EDGE(y + 46) - 8;
    strokeLine(surface, x0, y - 30, x1, y + 16, 2.6, () => [206, 200, 184, 0.9]);
    strokeLine(surface, x0, y - 18, x1, y + 28, 2.2, () => [188, 182, 168, 0.85]);
  }
  for (let index = 0; index < 26; index++) {
    const y = rng() * surface.height;
    drawBush(surface, RIVER_EDGE(y) + 22, y, 12 + rng() * 12, 700 + index);
  }
}

const PLAZA = [
  [268, 150],
  [520, 120],
  [940, 128],
  [1330, 172],
  [1436, 214],
  [1436, 705],
  [1180, 760],
  [700, 786],
  [332, 758],
  [284, 520]
];

function paintPlaza(surface) {
  fillPolygon(surface, PLAZA, (x, y) => {
    const wear = fbm(x * 0.005, y * 0.005, { seed: 211, octaves: 5 });
    const grit = valueNoise(x * 1.9, y * 1.9, 314);
    // warp the slab grid with low-frequency noise so no repeating joint rhythm survives
    const warpX = x + (fbm(x * 0.004, y * 0.012, { seed: 515, octaves: 3 }) - 0.5) * 46;
    const warpY = y + (fbm(x * 0.011, y * 0.004, { seed: 617, octaves: 3 }) - 0.5) * 38;
    const slabX = Math.floor(warpX / 74);
    const slabY = Math.floor(warpY / 56);
    const slabTone = valueNoise(slabX * 7.1, slabY * 5.3, 918);
    const sand = mixColor([168, 156, 134], [204, 192, 166], slabTone * 0.62 + wear * 0.38);
    const warm = mixColor(sand, [182, 158, 118], clamp((wear - 0.46) * 1.8, 0, 0.5));
    const jointX = 1 - smoothstep(35.2, 37, Math.abs((warpX % 74) - 37)) * 0.16;
    const jointY = 1 - smoothstep(26.4, 28, Math.abs((warpY % 56) - 28)) * 0.15;
    const chip = valueNoise(slabX * 3.7 + 11, slabY * 9.1, 733) > 0.86 ? 0.9 : 1;
    const tone = shade(warm, clamp(jointX * jointY * chip + (grit - 0.5) * 0.13, 0.55, 1.25));
    return [...tone, 0.97];
  });
  // puddles — small reflective patches that catch sunlight after rain
  const puddleRng = createRng(4422);
  for (let index = 0; index < 16; index++) {
    const px = 320 + puddleRng() * 1080;
    const py = 180 + puddleRng() * 560;
    if (blocked(px - 20, py - 14, px + 20, py + 14)) continue;
    const rx = 8 + puddleRng() * 18;
    const ry = rx * (0.45 + puddleRng() * 0.25);
    fillEllipse(surface, px, py, rx, ry, (ex, ey, distance) => {
      const ripple = Math.sin(distance * 14 + fbm(ex * 0.15, ey * 0.15, { seed: 4430 + index, octaves: 2 }) * 4) * 0.04;
      const reflection = smoothstep(1, 0.2, distance);
      const sky = mixColor([142, 164, 184], [186, 202, 216], 0.5 + ripple);
      return [...sky, 0.35 * reflection];
    }, { softness: 0.4 });
  }

  // service details keep the empty gameplay centre from reading as a blank slab field
  for (const [cx, cy, radius] of [[560, 300, 13], [980, 520, 11], [700, 690, 12]]) {
    fillEllipse(surface, cx, cy, radius, radius * 0.86, (px, py, distance) => [
      ...shade(mixColor([120, 116, 106], [158, 152, 138], valueNoise(px * 0.4, py * 0.4, 21)), 1 - distance * 0.2),
      0.9
    ], { softness: 0.18 });
    fillEllipse(surface, cx, cy, radius * 0.72, radius * 0.6, () => [96, 94, 88, 0.5], { softness: 0.3 });
  }
  for (let index = 0; index < 220; index++) {
    const px = 300 + valueNoise(index * 3.7, 1.3, 61) * 1100;
    const py = 150 + valueNoise(index * 2.9, 7.1, 62) * 600;
    const size = 1.6 + valueNoise(index * 5.1, 3.3, 63) * 3.4;
    fillEllipse(surface, px, py, size, size * 0.7, (_a, _b, distance) => [
      ...mixColor([132, 126, 114], [176, 168, 150], valueNoise(index * 1.7, 2.2, 64)),
      0.35 * (1 - distance)
    ], { softness: 0.5 });
  }
  // scattered leaf litter — autumn is just starting
  const leafRng = createRng(7788);
  const leafColors = [[168, 122, 48], [142, 86, 36], [186, 152, 56], [118, 82, 42], [196, 136, 44]];
  for (let index = 0; index < 180; index++) {
    const lx = 280 + leafRng() * 1150;
    const ly = 140 + leafRng() * 640;
    const leafColor = leafColors[Math.floor(leafRng() * leafColors.length)];
    const angle = leafRng() * Math.PI;
    const size = 2.2 + leafRng() * 3.4;
    fillEllipse(surface, lx, ly, size, size * 0.5, (_px, _py, distance) => [
      ...shade(leafColor, clamp(1.1 - distance * 0.3, 0.6, 1.2)),
      0.65 * (1 - distance * 0.5)
    ], { softness: 0.4, rotation: angle });
  }

  // trodden lanes between the canonical objective anchors
  const lanes = [
    [ANCHORS.spawn, ANCHORS.documentChlum, [520, 380], ANCHORS.documentNesmen],
    [ANCHORS.documentNesmen, [760, 380], ANCHORS.documentBesednice],
    [ANCHORS.documentBesednice, [1040, 380], ANCHORS.eva, ANCHORS.venue],
    [ANCHORS.documentNesmen, [700, 610], ANCHORS.franta]
  ];
  for (const [index, lane] of lanes.entries()) {
    strokePath(surface, lane, 74, (x, y, u, v) => {
      const dust = fbm(x * 0.02, y * 0.02, { seed: 400 + index, octaves: 4 });
      const tone = mixColor([196, 182, 154], [214, 204, 178], dust);
      const edge = 1 - Math.abs(v - 0.5) * 1.5;
      return [...tone, clamp(0.3 * edge + dust * 0.14, 0, 0.42)];
    });
  }
  // grass joints and moss at the plaza rim
  for (let index = 0; index < PLAZA.length; index++) {
    const [x0, y0] = PLAZA[index];
    const [x1, y1] = PLAZA[(index + 1) % PLAZA.length];
    strokeLine(surface, x0, y0, x1, y1, 16, (x, y, _u, v) => {
      const moss = fbm(x * 0.05, y * 0.05, { seed: 611, octaves: 3 });
      return [...mixColor([104, 118, 66], [138, 146, 88], moss), 0.5 * (1 - Math.abs(v - 0.5) * 1.8)];
    });
  }
}

function paintGravelPath(surface) {
  const promenade = [];
  for (let y = -20; y <= PLATE.height + 20; y += 40) promenade.push([QUAY_EDGE(y) + 30, y]);
  strokePath(surface, promenade, 62, (x, y) => {
    const grit = fbm(x * 0.05, y * 0.05, { seed: 731, octaves: 4 });
    const speck = valueNoise(x * 2.1, y * 2.1, 512);
    const tone = mixColor([182, 166, 136], [212, 200, 172], grit * 0.7 + speck * 0.3);
    return [...tone, 0.96];
  });
}

function drawVenue(surface) {
  // KD Slavia is the recognizable secondary anchor: a hall roof with a facade band,
  // cropped by the upper right of the plate so the plaza stays the playable subject.
  const groundY = 222;
  const annexLeft = 902;
  const annexRight = 1122;
  const right = PLATE.width;
  const facadeTop = 116;
  const roofTop = 6;
  const entranceX = 1298;

  // cast shadow of the whole mass onto the plaza
  fillRect(surface, annexLeft - 40, groundY - 8, right, groundY + 54, (x, y) => {
    const fall = clamp((y - groundY + 8) / 62, 0, 1);
    const spread = clamp((x - annexLeft + 40) / 80, 0, 1);
    return [30, 36, 34, 0.34 * (1 - fall) * spread];
  });

  // --- modern glazed annex (left wing) -------------------------------------
  fillPolygon(surface, [
    [annexLeft, groundY - 24],
    [annexRight, groundY - 18],
    [annexRight, facadeTop + 26],
    [annexLeft, facadeTop + 34]
  ], (x, y, _u, v) => {
    const tone = mixColor([242, 240, 232], [204, 204, 198], v * 0.75 + fbm(x * 0.02, y * 0.03, { seed: 42, octaves: 3 }) * 0.3);
    return shade(tone, clamp(1.06 - v * 0.14, 0.72, 1.2));
  });
  for (let index = 0; index < 5; index++) {
    const x0 = annexLeft + 18 + index * 42;
    fillPolygon(surface, [
      [x0, groundY - 30],
      [x0 + 30, groundY - 28],
      [x0 + 30, groundY - 78],
      [x0, groundY - 80]
    ], (px, py, u, v) => {
      const glass = mixColor([88, 122, 140], [186, 212, 216], clamp(v * 0.65 + u * 0.45, 0, 1));
      return [...glass, 0.95];
    });
    strokeLine(surface, x0 + 4, groundY - 74, x0 + 25, groundY - 36, 3.2, () => [244, 250, 250, 0.32]);
  }
  fillPolygon(surface, [
    [annexLeft - 8, facadeTop + 36],
    [annexRight + 6, facadeTop + 26],
    [annexRight + 6, facadeTop + 6],
    [annexLeft - 8, facadeTop + 16]
  ], () => [188, 190, 186, 1]);
  fillPolygon(surface, [
    [annexLeft - 8, facadeTop + 16],
    [annexRight + 6, facadeTop + 6],
    [annexRight + 6, roofTop + 4],
    [annexLeft - 8, roofTop + 14]
  ], (x, y) => shade(mixColor([158, 160, 158], [192, 194, 190], fbm(x * 0.012, y * 0.03, { seed: 61, octaves: 3 })), 1));
  for (let index = 0; index < 3; index++) {
    fillRect(surface, annexLeft + 34 + index * 62, roofTop + 34, annexLeft + 74 + index * 62, roofTop + 58, () => [128, 140, 144, 0.9]);
  }

  // --- historic hall (right wing) ------------------------------------------
  fillPolygon(surface, [
    [annexRight, groundY - 18],
    [right, groundY - 10],
    [right, facadeTop - 6],
    [annexRight, facadeTop + 26]
  ], (x, y, _u, v) => {
    const plaster = mixColor([244, 230, 200], [212, 192, 158], v * 0.68 + fbm(x * 0.018, y * 0.035, { seed: 17, octaves: 4 }) * 0.42);
    const pilaster = Math.abs(((x - annexRight + 20) % 78) - 39) > 34 ? 1.08 : 1;
    return shade(plaster, clamp(pilaster * (1.07 - v * 0.22), 0.68, 1.26));
  });
  for (let index = 0; index < 5; index++) {
    const x0 = annexRight + 22 + index * 66;
    if (x0 + 40 > entranceX - 62 && x0 < entranceX + 62) continue;
    const y0 = groundY - 40;
    fillPolygon(surface, [
      [x0, y0],
      [x0 + 40, y0 + 1],
      [x0 + 40, y0 - 52],
      [x0, y0 - 53]
    ], (px, py, u, v) => {
      const glass = mixColor([58, 72, 84], [142, 162, 170], clamp(v * 0.5 + u * 0.5, 0, 1));
      return [...glass, 0.95];
    });
    strokeLine(surface, x0 - 2, y0 - 55, x0 + 42, y0 - 54, 4, () => [250, 242, 218, 0.85]);
    strokeLine(surface, x0 + 20, y0 - 1, x0 + 20, y0 - 53, 2.4, () => [236, 226, 200, 0.55]);
    strokeLine(surface, x0, y0 - 27, x0 + 40, y0 - 26, 2.2, () => [236, 226, 200, 0.45]);
  }

  // flower boxes on historic hall windows
  for (let index = 0; index < 5; index++) {
    const x0 = annexRight + 22 + index * 66;
    if (x0 + 40 > entranceX - 62 && x0 < entranceX + 62) continue;
    const y0 = groundY - 40;
    fillRect(surface, x0 - 2, y0 + 2, x0 + 42, y0 + 10, (x, y) => [
      ...shade(mixColor([96, 72, 56], [134, 98, 68], valueNoise(x * 0.3, y * 0.3, 1600 + index)), 1), 0.95
    ]);
    const flowerRng = createRng(1700 + index);
    const flowerColors = [[196, 62, 72], [214, 142, 68], [186, 76, 148], [216, 186, 72]];
    for (let flower = 0; flower < 6; flower++) {
      const fx = x0 + 4 + flowerRng() * 34;
      const fy = y0 - 2 - flowerRng() * 16;
      const fc = flowerColors[Math.floor(flowerRng() * flowerColors.length)];
      fillEllipse(surface, fx, fy, 3.6, 2.8, () => [...fc, 0.9], { softness: 0.3 });
      fillEllipse(surface, fx, fy + 4, 2.4, 3.2, () => [68, 112, 52, 0.85], { softness: 0.3 });
    }
  }

  // clock on pediment
  const clockX = entranceX;
  const clockY = facadeTop - 28;
  const clockR = 18;
  fillEllipse(surface, clockX, clockY, clockR + 4, clockR + 4, () => [84, 72, 56, 0.95], { softness: 0.15 });
  fillEllipse(surface, clockX, clockY, clockR, clockR, (_px, _py, distance) => [
    ...mixColor([238, 232, 216], [212, 206, 190], distance), 0.97
  ], { softness: 0.1 });
  for (let hour = 0; hour < 12; hour++) {
    const angle = (hour / 12) * Math.PI * 2 - Math.PI / 2;
    const markR = clockR * 0.78;
    const mx = clockX + Math.cos(angle) * markR;
    const my = clockY + Math.sin(angle) * markR;
    fillEllipse(surface, mx, my, 1.6, 1.6, () => [42, 38, 32, 0.9]);
  }
  strokeLine(surface, clockX, clockY, clockX + Math.cos(-Math.PI * 0.33) * clockR * 0.55, clockY + Math.sin(-Math.PI * 0.33) * clockR * 0.55, 2.8, () => [36, 32, 28, 0.95]);
  strokeLine(surface, clockX, clockY, clockX + Math.cos(Math.PI * 0.12) * clockR * 0.72, clockY + Math.sin(Math.PI * 0.12) * clockR * 0.72, 2, () => [36, 32, 28, 0.9]);

  // entrance: steps, double doors, canopy and house sign
  fillPolygon(surface, [
    [entranceX - 104, groundY + 30],
    [entranceX + 104, groundY + 34],
    [entranceX + 86, groundY - 14],
    [entranceX - 86, groundY - 18]
  ], (x, y) => {
    const step = Math.floor((y - groundY + 18) / 11);
    const tone = mixColor([198, 190, 172], [228, 220, 202], (step % 2) * 0.45 + fbm(x * 0.05, y * 0.05, { seed: 91, octaves: 3 }) * 0.55);
    return shade(tone, clamp(1.04 - (y - groundY) / 260, 0.8, 1.15));
  });
  fillPolygon(surface, [
    [entranceX - 58, groundY - 18],
    [entranceX + 58, groundY - 16],
    [entranceX + 54, groundY - 92],
    [entranceX - 54, groundY - 94]
  ], (px, py, u, v) => shade(mixColor([70, 52, 40], [124, 92, 64], clamp(v * 0.55 + u * 0.35, 0, 1)), 1));
  strokeLine(surface, entranceX, groundY - 20, entranceX, groundY - 92, 3.2, () => [214, 192, 152, 0.85]);
  for (const handleY of [groundY - 52, groundY - 50]) {
    strokeLine(surface, entranceX - 16, handleY, entranceX - 8, handleY, 3, () => [226, 206, 150, 0.9]);
    strokeLine(surface, entranceX + 8, handleY, entranceX + 16, handleY, 3, () => [226, 206, 150, 0.9]);
  }
  fillPolygon(surface, [
    [entranceX - 78, groundY - 96],
    [entranceX + 78, groundY - 94],
    [entranceX + 70, groundY - 112],
    [entranceX - 70, groundY - 114]
  ], () => [176, 88, 68, 1]);

  const label = "KD SLAVIE";
  const pixel = 3;
  const signWidth = textWidth(label, pixel) + 28;
  fillRect(surface, entranceX - signWidth / 2, facadeTop + 6, entranceX + signWidth / 2, facadeTop + 48, (x, y) => {
    const tone = mixColor([34, 76, 58], [58, 112, 80], fbm(x * 0.03, y * 0.06, { seed: 12, octaves: 3 }));
    return [...tone, 0.97];
  });
  drawText(surface, label, entranceX - textWidth(label, pixel) / 2, facadeTop + 14, pixel, [246, 242, 222], 0.98);

  // event runner leading from the plaza approach point up to the steps
  fillPolygon(surface, [
    [entranceX - 24, 448],
    [entranceX + 24, 448],
    [entranceX + 40, groundY + 34],
    [entranceX - 40, groundY + 30]
  ], (x, y, u, v) => {
    const nap = fbm(x * 0.05, y * 0.05, { seed: 143, octaves: 3 });
    const tone = mixColor([124, 44, 44], [162, 62, 54], nap * 0.7 + (1 - Math.abs(u - 0.5) * 2) * 0.3);
    return [...shade(tone, clamp(1.02 - v * 0.14, 0.72, 1.12)), 0.62];
  });
  for (let index = 0; index < 5; index++) {
    const t = index / 4;
    const y = 452 - t * (452 - groundY - 32);
    const spread = 34 + t * 24;
    for (const side of [-1, 1]) {
      const x = entranceX + side * spread;
      groundShadow(surface, x + 5, y + 2, 9, 4, 0.28);
      strokeLine(surface, x, y, x, y - 34, 4, () => [188, 168, 116, 0.95]);
      fillEllipse(surface, x, y - 36, 5, 5, () => [214, 194, 138, 1], { softness: 0.3 });
    }
    if (index > 0) {
      const previousY = 452 - ((index - 1) / 4) * (452 - groundY - 32);
      const previousSpread = 34 + ((index - 1) / 4) * 24;
      for (const side of [-1, 1]) {
        strokeLine(surface, entranceX + side * previousSpread, previousY - 26, entranceX + side * spread, y - 26, 3, () => [156, 42, 40, 0.9]);
      }
    }
  }

  // pediment and tiled roof
  fillPolygon(surface, [
    [annexRight - 8, facadeTop + 28],
    [right, facadeTop - 8],
    [right, roofTop - 10],
    [annexRight - 8, roofTop + 6]
  ], (x, y) => {
    const courses = Math.sin(y * 0.5) * 0.5 + 0.5;
    const tile = mixColor([146, 76, 56], [192, 112, 82], fbm(x * 0.02, y * 0.06, { seed: 27, octaves: 4 }) * 0.68 + courses * 0.32);
    return shade(tile, clamp(1.08 - (y - roofTop) / 380, 0.74, 1.22));
  });
  fillPolygon(surface, [
    [entranceX - 104, facadeTop + 6],
    [entranceX + 104, facadeTop + 2],
    [entranceX, facadeTop - 62]
  ], (x, y, _u, v) => shade(mixColor([246, 234, 206], [204, 186, 152], v), clamp(1.1 - v * 0.22, 0.7, 1.22)));
  strokeLine(surface, annexRight - 8, roofTop + 4, right, roofTop - 12, 6, () => [126, 66, 50, 0.9]);
  for (const chimneyX of [1188, 1386]) {
    fillPolygon(surface, [
      [chimneyX - 14, roofTop + 60],
      [chimneyX + 14, roofTop + 56],
      [chimneyX + 14, roofTop + 6],
      [chimneyX - 14, roofTop + 10]
    ], (x, y, _u, v) => shade(mixColor([176, 120, 92], [122, 78, 60], v), 1));
    fillRect(surface, chimneyX - 17, roofTop + 2, chimneyX + 17, roofTop + 12, () => [96, 64, 52, 1]);
  }
}

function drawServiceRoad(surface) {
  const road = [[250, 74], [520, 58], [820, 62], [886, 86]];
  strokePath(surface, road, 70, (x, y, _u, v) => {
    const asphalt = mixColor([88, 88, 88], [124, 122, 118], fbm(x * 0.02, y * 0.04, { seed: 333, octaves: 4 }));
    return [...asphalt, clamp(1 - Math.abs(v - 0.5) * 0.6, 0.7, 1)];
  });
  for (let x = 280; x < 940; x += 74) {
    strokeLine(surface, x, 66, x + 34, 65, 4, () => [226, 222, 200, 0.6]);
  }
  drawVan(surface, 372, 96, 168, 4501, { color: [236, 236, 230] });
  drawCar(surface, 620, 100, 150, 4502, { color: [72, 96, 140] });
  drawCar(surface, 806, 104, 146, 4503, { color: [186, 178, 168] });
}

function drawEventLayout(surface) {
  const stalls = [
    { x: 404, y: 344, width: 132, stripe: [196, 66, 58], seed: 811 },
    { x: 566, y: 336, width: 128, stripe: [58, 104, 152], seed: 812 },
    { x: 728, y: 350, width: 132, stripe: [216, 172, 66], seed: 813 },
    { x: 1046, y: 392, width: 136, stripe: [66, 122, 84], seed: 814 },
    { x: 1186, y: 378, width: 128, stripe: [196, 66, 58], seed: 815 },
    { x: 420, y: 618, width: 130, stripe: [66, 122, 84], seed: 816 },
    { x: 588, y: 640, width: 126, stripe: [216, 172, 66], seed: 817 },
    { x: 1006, y: 640, width: 132, stripe: [58, 104, 152], seed: 818 },
    { x: 1180, y: 672, width: 128, stripe: [196, 66, 58], seed: 819 }
  ];
  for (const stall of stalls) {
    if (blocked(stall.x - stall.width * 0.6, stall.y - 150, stall.x + stall.width * 0.6, stall.y + 12)) continue;
    drawStall(surface, stall.x, stall.y, stall.width, stall.seed, { stripe: stall.stripe });
  }

  // certification corner behind Eva
  drawStall(surface, 1264, 596, 138, 820, { stripe: [46, 96, 138] });
  drawDisplayCase(surface, 1078, 560, 74, 830);
  drawDisplayCase(surface, 1258, 528, 68, 831);
  drawDisplayCase(surface, 486, 470, 70, 832);
  drawDisplayCase(surface, 880, 430, 66, 833);

  drawGateArch(surface, 566, 158, 210, 104, "NA ZELENE VLNE", 2.4);

  for (const [x, y, color, seed] of [
    [352, 430, [196, 66, 58], 3.1],
    [352, 620, [58, 104, 152], 3.4],
    [1392, 320, [216, 172, 66], 3.7],
    [1396, 604, [66, 122, 84], 3.9],
    [700, 250, [196, 66, 58], 4.2],
    [1150, 246, [58, 104, 152], 4.5]
  ]) {
    if (blocked(x - 20, y - 130, x + 40, y + 10)) continue;
    drawFlagPole(surface, x, y, 118, seed, { color });
  }

  for (const [x, y, seed] of [[430, 742, 940], [566, 764, 941], [1268, 726, 942]]) {
    if (blocked(x - 46, y - 96, x + 46, y + 12)) continue;
    groundShadow(surface, x + 12, y + 4, 52, 18, 0.32);
    fillEllipse(surface, x, y - 26, 40, 15, (px, py, distance) => [
      ...shade(mixColor([204, 196, 178], [166, 156, 138], distance), 1),
      1
    ], { softness: 0.14 });
    fillEllipse(surface, x, y - 74, 58, 22, (px, py, distance) => {
      const wedge = Math.atan2(py - (y - 74), px - x);
      const stripe = Math.floor((wedge + Math.PI) / (Math.PI / 5)) % 2 === 0 ? [206, 82, 68] : [238, 232, 216];
      return [...shade(stripe, clamp(1.14 - distance * 0.3, 0.7, 1.3)), 1];
    }, { softness: 0.1 });
    strokeLine(surface, x, y - 26, x, y - 76, 3.4, () => [128, 108, 82, 0.95]);
  }
  drawBench(surface, 372, 700, 76, 901);
  drawBench(surface, 700, 742, 82, 902);
  drawBench(surface, 1112, 742, 78, 903);
  drawBin(surface, 470, 706, 904);
  drawBin(surface, 968, 736, 905);
  drawPottedPlant(surface, 1206, 430, 906);
  drawPottedPlant(surface, 1006, 470, 907);
  drawPottedPlant(surface, 620, 236, 908);
}

function drawCrowd(surface) {
  const rng = createRng(20250819);
  const clusters = [
    { x: 404, y: 392, spread: 96, count: 3 },
    { x: 592, y: 388, spread: 104, count: 3 },
    { x: 744, y: 402, spread: 96, count: 2 },
    { x: 1060, y: 386, spread: 104, count: 3 },
    { x: 1212, y: 402, spread: 92, count: 2 },
    { x: 470, y: 668, spread: 110, count: 3 },
    { x: 1030, y: 700, spread: 116, count: 3 },
    { x: 880, y: 560, spread: 150, count: 3 },
    { x: 1250, y: 250, spread: 120, count: 2 },
    { x: 640, y: 214, spread: 130, count: 2 }
  ];
  let seed = 5000;
  for (const cluster of clusters) {
    let placed = 0;
    let attempts = 0;
    while (placed < cluster.count && attempts < 60) {
      attempts++;
      const x = cluster.x + (rng() - 0.5) * cluster.spread;
      const y = cluster.y + (rng() - 0.5) * cluster.spread * 0.5;
      if (x < WALKABLE.x0 - 40 || x > WALKABLE.x1 + 40 || y < 120 || y > 800) continue;
      if (blocked(x - 22, y - 76, x + 22, y + 8)) continue;
      drawPerson(surface, x, y, seed++, { facing: rng() > 0.5 ? 1 : -1, scale: 0.92 + rng() * 0.2 });
      placed++;
    }
  }
}

function drawVegetation(surface) {
  const trees = [
    [232, 176, 62, 1201], [214, 452, 58, 1202], [236, 726, 64, 1203], [206, 862, 56, 1204],
    [318, 108, 58, 1205], [880, 96, 62, 1206], [700, 118, 46, 1207],
    [1394, 806, 66, 1208], [1120, 812, 52, 1209], [830, 826, 58, 1210], [520, 828, 54, 1211],
    [326, 210, 44, 1212]
  ];
  for (const [x, y, size, seed] of trees) {
    if (blocked(x - size * 1.2, y - size * 2.6, x + size * 1.2, y + size * 0.4)) continue;
    drawTree(surface, x, y, size, seed, { autumn: seed % 3 === 0 });
  }
  const rng = createRng(3311);
  for (let index = 0; index < 30; index++) {
    const x = 250 + rng() * 1180;
    const y = 96 + rng() * 760;
    const insidePlaza = y > 150 && y < 740 && x > 300 && x < 1400;
    if (insidePlaza) continue;
    if (blocked(x - 26, y - 40, x + 26, y + 8)) continue;
    drawBush(surface, x, y, 12 + rng() * 14, 3400 + index);
  }
}

function paintFinalGrade(surface) {
  forEachPixel(surface, (x, y) => {
    const u = x / surface.width;
    const v = y / surface.height;
    // Sluneční směr musí souhlasit se stíny rekvizit, které padají doprava dolů.
    const sun = clamp(0.5 + ((1 - u) * 0.45 - v * 0.4), 0, 1);
    const tint = mixColor([100, 114, 138], [255, 228, 186], smoothstep(0, 1, sun));
    const strength = 0.05 + Math.abs(sun - 0.5) * 0.12;
    const vignette = smoothstep(1.34, 0.5, Math.hypot(u - 0.5, v - 0.5) * 1.85);
    // Atmosférická perspektiva: vzdálený horní okraj mapy je o něco světlejší a studenější.
    const haze = smoothstep(0.42, 0, v) * 0.16;
    return [...mixColor(tint, [198, 210, 214], haze * 3), strength + (1 - vignette) * 0.1 + haze];
  });
  forEachPixel(surface, (x, y) => {
    const speck = (valueNoise(x * 3.1, y * 3.1, 777) - 0.5) * 9;
    return [128 + speck, 128 + speck, 128 + speck, 0.045];
  });
}

function paintTreeShadows(surface) {
  const shadowTrees = [
    [232, 176, 62], [318, 108, 58], [880, 96, 62], [700, 118, 46],
    [1394, 806, 66], [1120, 812, 52], [830, 826, 58], [520, 828, 54]
  ];
  for (const [x, y, size] of shadowTrees) {
    const shadowX = x + size * 0.7;
    const shadowY = y + size * 0.35;
    fillEllipse(surface, shadowX, shadowY, size * 1.1, size * 0.55, (_px, _py, distance) => {
      const dapple = valueNoise(_px * 0.18, _py * 0.18, 6600) > 0.45 ? 0.6 : 1;
      return [22, 28, 18, 0.18 * (1 - distance * 0.8) * dapple];
    }, { softness: 0.5 });
  }
}

function buildPlate() {
  const surface = createSurface(PLATE.width, PLATE.height, 3);
  paintGrass(surface);
  paintRiver(surface);
  paintQuay(surface);
  paintPlaza(surface);
  paintGravelPath(surface);
  paintTreeShadows(surface);
  drawVenue(surface);
  drawServiceRoad(surface);
  drawEventLayout(surface);
  drawCrowd(surface);
  drawVegetation(surface);
  paintFinalGrade(surface);
  return surface;
}

function drawForegroundCanopy(surface, x, y, radius, seed, { alpha = 1, autumn = false } = {}) {
  const rng = createRng(seed);
  const base = autumn ? [96, 84, 40] : [38, 62, 36];
  const light = autumn ? [176, 148, 62] : [96, 128, 62];
  for (let index = 0; index < 120; index++) {
    const angle = rng() * Math.PI * 2;
    const radial = Math.pow(rng(), 0.55) * radius;
    const cx = x + Math.cos(angle) * radial * 1.15;
    const cy = y + Math.sin(angle) * radial * 0.82;
    const blob = radius * (0.1 + rng() * 0.16);
    const tone = mixColor(base, light, clamp(rng() * 0.9 - radial / (radius * 2.4) + 0.3, 0, 1));
    const falloff = clamp(1.12 - radial / radius, 0, 1);
    fillEllipse(surface, cx, cy, blob * 1.2, blob * 0.92, (px, py, distance) => [
      ...shade(tone, clamp(1 + (valueNoise(px * 1.8, py * 1.8, seed + index) - 0.5) * 0.5 - distance * 0.2, 0.5, 1.4)),
      alpha * falloff * (1 - distance * 0.35)
    ], { softness: 0.5, rotation: rng() * Math.PI });
  }
}

function buildForeground() {
  const surface = createSurface(PLATE.width, PLATE.height, 4);
  // Upper-left chestnut crown overhanging the riverside promenade.
  drawForegroundCanopy(surface, 74, 40, 250, 8801, { alpha: 0.98 });
  drawForegroundCanopy(surface, 250, -30, 190, 8802, { alpha: 0.94 });
  strokeLine(surface, -20, -10, 210, 120, 20, (x, y) => [
    ...shade([62, 48, 36], clamp(1 + (valueNoise(x * 1.4, y * 1.4, 8811) - 0.5) * 0.4, 0.7, 1.3)),
    0.95
  ]);

  // Lower-left willow over the river bend, keeps the left border occluded.
  drawForegroundCanopy(surface, 40, 838, 230, 8803, { alpha: 0.96 });
  drawForegroundCanopy(surface, 236, 902, 190, 8804, { alpha: 0.9 });

  // Lower-right linden crown; the plaza exit reads deeper behind it.
  drawForegroundCanopy(surface, 1394, 842, 250, 8805, { alpha: 0.97, autumn: true });
  drawForegroundCanopy(surface, 1210, 900, 200, 8806, { alpha: 0.92, autumn: true });

  // Upper-right crown next to the venue roof.
  drawForegroundCanopy(surface, 1420, 46, 210, 8807, { alpha: 0.9 });

  // Bunting strung across the event, drawn above the actors for depth.
  drawBuntingLine(surface, [[300, 96], [720, 78]], 3.1, { sag: 34, flagHeight: 22, alpha: 0.96 });
  drawBuntingLine(surface, [[720, 78], [1140, 104]], 5.4, { sag: 30, flagHeight: 22, alpha: 0.96 });
  drawBuntingLine(surface, [[236, 830], [660, 848]], 7.2, { sag: 26, flagHeight: 20, alpha: 0.9 });
  return surface;
}

function writeAsset(relativePath, buffer) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, buffer);
  const digest = crypto.createHash("sha256").update(buffer).digest("hex");
  console.log(`${relativePath}  ${buffer.length} B  sha256:${digest}`);
  return { relativePath, bytes: buffer.length, sha256: digest };
}

const plate = encodePng(buildPlate());
const foreground = encodePng(buildForeground());
writeAsset("assets/textures/terrain/slavia-event-plate-v7.png", plate);
writeAsset("assets/sprites/foreground/slavia-event-edge-v7.png", foreground);
console.log(`plate ${PLATE.width}x${PLATE.height}, world ${WORLD.width}x${WORLD.height}, scale ${SCALE}`);
