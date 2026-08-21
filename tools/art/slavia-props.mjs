// Painted prop vocabulary for the Slavia V7 event plate.
// Every prop is anchored on its ground point and grows upward in image space,
// matching the fixed orthographic 3/4 top-down projection used by the V7 plates.

import {
  clamp,
  createRng,
  fbm,
  fillEllipse,
  fillPolygon,
  fillRect,
  mixColor,
  shade,
  smoothstep,
  strokeLine,
  valueNoise
} from "./raster.mjs";

export const GLYPHS = Object.freeze({
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "11110", "10001", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "11110", "10000", "10000", "10000", "11111"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  Z: ["11111", "00010", "00100", "01000", "10000", "10000", "11111"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"]
});

export function drawText(surface, text, x, y, pixel, color, alpha = 1) {
  let cursor = x;
  for (const character of text.toUpperCase()) {
    const glyph = GLYPHS[character] ?? GLYPHS[" "];
    for (let row = 0; row < glyph.length; row++) {
      for (let column = 0; column < 5; column++) {
        if (glyph[row][column] !== "1") continue;
        fillRect(surface, cursor + column * pixel, y + row * pixel, cursor + (column + 1) * pixel - 0.01, y + (row + 1) * pixel - 0.01, () => [...color, alpha]);
      }
    }
    cursor += pixel * 6;
  }
  return cursor - x;
}

export function textWidth(text, pixel) {
  return text.length * pixel * 6 - pixel;
}

export function groundShadow(surface, x, y, rx, ry, strength = 0.34) {
  fillEllipse(surface, x, y, rx, ry, (_px, _py, distance) => [22, 24, 18, strength * (1 - distance * 0.72)], { softness: 0.5 });
}

function grain(x, y, seed, amount) {
  return (valueNoise(x * 0.9, y * 0.9, seed) - 0.5) * amount;
}

export function drawTree(surface, x, y, size, seed, { autumn = false } = {}) {
  const rng = createRng(seed);
  const canopyRadius = size;
  const trunkHeight = size * 1.05;
  groundShadow(surface, x + size * 0.34, y + size * 0.1, size * 0.95, size * 0.42, 0.36);

  const trunkWidth = Math.max(5, size * 0.19);
  fillPolygon(surface, [
    [x - trunkWidth * 0.6, y],
    [x + trunkWidth * 0.6, y],
    [x + trunkWidth * 0.36, y - trunkHeight],
    [x - trunkWidth * 0.36, y - trunkHeight]
  ], (px, py) => {
    const light = 1 + grain(px, py, seed + 5, 0.34) - (px - x) / (trunkWidth * 4);
    return shade([84, 63, 46], clamp(light, 0.6, 1.35));
  });

  const centerY = y - trunkHeight - canopyRadius * 0.42;
  const base = autumn ? [138, 120, 52] : [74, 104, 52];
  const highlight = autumn ? [196, 168, 74] : [136, 166, 84];
  const deep = autumn ? [92, 74, 38] : [40, 64, 38];
  const clusters = Math.round(26 + size * 0.42);
  for (let index = 0; index < clusters; index++) {
    const angle = rng() * Math.PI * 2;
    const radial = Math.sqrt(rng()) * canopyRadius * 0.95;
    const cx = x + Math.cos(angle) * radial * 1.08;
    const cy = centerY + Math.sin(angle) * radial * 0.78;
    const blobRadius = canopyRadius * (0.22 + rng() * 0.24);
    const lift = clamp(((x - cx) + (centerY - cy)) / (canopyRadius * 1.6), -1, 1);
    const tone = mixColor(mixColor(deep, base, clamp(0.35 + lift * 0.5 + rng() * 0.3, 0, 1)), highlight, clamp(lift * 0.62, 0, 1));
    fillEllipse(surface, cx, cy, blobRadius * 1.12, blobRadius * 0.9, (px, py, distance) => {
      const noise = grain(px * 1.7, py * 1.7, seed + index, 0.5);
      return [...shade(tone, clamp(1 + noise - distance * 0.22, 0.55, 1.4)), 0.92];
    }, { softness: 0.44, rotation: rng() * Math.PI });
  }
}

export function drawBush(surface, x, y, size, seed) {
  const rng = createRng(seed);
  groundShadow(surface, x + size * 0.22, y + size * 0.12, size * 0.9, size * 0.36, 0.26);
  for (let index = 0; index < 14; index++) {
    const cx = x + (rng() - 0.5) * size * 1.7;
    const cy = y - rng() * size * 0.95;
    const radius = size * (0.28 + rng() * 0.3);
    const tone = mixColor([56, 86, 46], [124, 152, 74], rng());
    fillEllipse(surface, cx, cy, radius * 1.15, radius * 0.8, (px, py, distance) => [
      ...shade(tone, clamp(1 + grain(px * 2, py * 2, seed + index, 0.42) - distance * 0.2, 0.6, 1.35)),
      0.94
    ], { softness: 0.5 });
  }
}

export function drawStall(surface, x, y, width, seed, { stripe = [200, 68, 60], depth = 54, height = 86 } = {}) {
  const rng = createRng(seed);
  const half = width / 2;
  groundShadow(surface, x + 20, y + 6, half * 1.25, depth * 0.52, 0.4);

  // counter and goods
  const counterTop = y - 26;
  fillPolygon(surface, [
    [x - half * 0.92, y],
    [x + half * 0.92, y],
    [x + half * 0.86, counterTop],
    [x - half * 0.86, counterTop]
  ], (px, py) => shade([132, 106, 78], clamp(1 + grain(px, py, seed + 3, 0.28), 0.7, 1.3)));
  fillPolygon(surface, [
    [x - half * 0.86, counterTop],
    [x + half * 0.86, counterTop],
    [x + half * 0.78, counterTop - depth * 0.44],
    [x - half * 0.78, counterTop - depth * 0.44]
  ], (px, py) => {
    const cloth = mixColor([214, 206, 188], [178, 168, 150], clamp(0.4 + grain(px, py, seed + 4, 0.7), 0, 1));
    return shade(cloth, 1);
  });
  for (let index = 0; index < 9; index++) {
    const gx = x - half * 0.7 + rng() * width * 0.7;
    const gy = counterTop - depth * (0.08 + rng() * 0.3);
    const radius = 3.4 + rng() * 4.2;
    const moldavite = rng() > 0.45;
    const tone = moldavite
      ? mixColor([62, 108, 58], [128, 172, 96], rng())
      : mixColor([146, 126, 100], [206, 190, 158], rng());
    fillEllipse(surface, gx, gy, radius, radius * 0.74, (px, py, distance) => [
      ...shade(tone, clamp(1.12 - distance * 0.5 + grain(px * 3, py * 3, seed + index, 0.3), 0.5, 1.5)),
      0.95
    ], { softness: 0.4 });
  }

  // legs
  for (const legX of [x - half * 0.94, x + half * 0.94]) {
    strokeLine(surface, legX, y + 2, legX, y - height, 4.2, () => [96, 84, 66, 0.95]);
    strokeLine(surface, legX + depth * 0.16, y - depth * 0.5, legX + depth * 0.16, y - height - depth * 0.24, 3.6, () => [88, 76, 60, 0.9]);
  }

  // canopy: top plane plus front valance
  const canopyY = y - height;
  const canopyBack = canopyY - depth * 0.62;
  const stripes = Math.max(4, Math.round(width / 26));
  for (let index = 0; index < stripes; index++) {
    const t0 = index / stripes;
    const t1 = (index + 1) / stripes;
    const color = index % 2 === 0 ? stripe : [238, 232, 216];
    fillPolygon(surface, [
      [x - half * 1.06 + width * 1.06 * t0, canopyY + 6],
      [x - half * 1.06 + width * 1.06 * t1, canopyY + 6],
      [x - half * 0.92 + width * 0.92 * t1, canopyBack],
      [x - half * 0.92 + width * 0.92 * t0, canopyBack]
    ], (px, py) => {
      const light = 1.06 - (py - canopyBack) / (depth * 3.2) + grain(px, py, seed + 9, 0.16);
      return shade(color, clamp(light, 0.72, 1.25));
    });
  }
  for (let index = 0; index < stripes; index++) {
    const t0 = index / stripes;
    const t1 = (index + 1) / stripes;
    const color = index % 2 === 0 ? shade(stripe, 0.82) : [212, 205, 190];
    const valance = 15 + Math.sin(index * 1.7 + seed) * 2.5;
    fillPolygon(surface, [
      [x - half * 1.06 + width * 1.06 * t0, canopyY + 6],
      [x - half * 1.06 + width * 1.06 * t1, canopyY + 6],
      [x - half * 1.06 + width * 1.06 * t1, canopyY + 6 + valance],
      [x - half * 1.06 + width * 1.06 * t0, canopyY + 6 + valance]
    ], (px, py) => shade(color, clamp(1 - (py - canopyY) / 90 + grain(px, py, seed + 11, 0.12), 0.7, 1.2)));
  }
  // canopy shadow on the counter area
  fillEllipse(surface, x + 12, y - 12, half * 1.05, depth * 0.42, (_px, _py, distance) => [30, 32, 26, 0.2 * (1 - distance * 0.6)], { softness: 0.6 });
}

export function drawDisplayCase(surface, x, y, width, seed) {
  const rng = createRng(seed);
  const height = 40;
  groundShadow(surface, x + 12, y + 4, width * 0.72, 13, 0.34);
  fillPolygon(surface, [
    [x - width / 2, y],
    [x + width / 2, y],
    [x + width / 2 - 4, y - height],
    [x - width / 2 + 4, y - height]
  ], (px, py) => shade([92, 82, 70], clamp(1 + grain(px, py, seed, 0.2), 0.75, 1.2)));
  fillPolygon(surface, [
    [x - width / 2 + 4, y - height],
    [x + width / 2 - 4, y - height],
    [x + width / 2 - 10, y - height - 26],
    [x - width / 2 + 10, y - height - 26]
  ], (px, py, u, v) => {
    const glass = mixColor([176, 204, 206], [226, 240, 238], clamp(v + grain(px, py, seed + 2, 0.3), 0, 1));
    return [...glass, 0.86];
  });
  for (let index = 0; index < 5; index++) {
    const gx = x - width * 0.34 + rng() * width * 0.68;
    const gy = y - height - 8 - rng() * 12;
    fillEllipse(surface, gx, gy, 4 + rng() * 3, 3 + rng() * 2, (_px, _py, distance) => [
      ...mixColor([64, 118, 62], [148, 196, 118], clamp(1 - distance, 0, 1)),
      0.95
    ], { softness: 0.4 });
  }
  strokeLine(surface, x - width / 2 + 9, y - height - 24, x + width / 2 - 11, y - height - 21, 2.2, () => [246, 250, 244, 0.5]);
}

export function drawPerson(surface, x, y, seed, { shirt, facing = 1, scale = 1 } = {}) {
  const rng = createRng(seed);
  const palette = shirt ?? [
    [188, 74, 64], [64, 92, 148], [214, 186, 96], [72, 118, 88], [206, 206, 200], [128, 78, 142], [222, 138, 86]
  ][Math.floor(rng() * 7)];
  const trouser = [58, 62, 76];
  const skin = mixColor([226, 186, 152], [198, 152, 118], rng());
  const hair = mixColor([56, 40, 30], [140, 106, 62], rng());
  const height = 62 * scale;

  groundShadow(surface, x + 9 * scale, y + 2 * scale, 15 * scale, 6.5 * scale, 0.42);
  for (const offset of [-4.4 * scale, 4.4 * scale]) {
    strokeLine(surface, x + offset * 0.6, y, x + offset, y - height * 0.38, 5.4 * scale, () => [...trouser, 0.97]);
  }
  fillPolygon(surface, [
    [x - 9 * scale, y - height * 0.34],
    [x + 9 * scale, y - height * 0.34],
    [x + 8 * scale, y - height * 0.74],
    [x - 8 * scale, y - height * 0.74]
  ], (px, py, u, v) => {
    const light = 1.1 - v * 0.32 + (u - 0.5) * 0.14 * facing;
    return [...shade(palette, clamp(light, 0.65, 1.3)), 0.98];
  });
  for (const offset of [-10.4 * scale, 10.4 * scale]) {
    strokeLine(surface, x + offset * 0.86, y - height * 0.7, x + offset, y - height * 0.4, 4.6 * scale, () => [...shade(palette, 0.86), 0.96]);
  }
  fillEllipse(surface, x, y - height * 0.84, 7.4 * scale, 8 * scale, (_px, _py, distance) => [
    ...shade(skin, clamp(1.12 - distance * 0.35, 0.6, 1.3)),
    0.99
  ], { softness: 0.28 });
  fillEllipse(surface, x - 0.6 * scale, y - height * 0.9, 7.6 * scale, 6 * scale, (_px, _py, distance) => [
    ...shade(hair, clamp(1.1 - distance * 0.4, 0.6, 1.3)),
    0.98
  ], { softness: 0.3 });
}

export function drawCar(surface, x, y, length, seed, { color = [176, 62, 56] } = {}) {
  const width = length * 0.44;
  const body = width * 0.92;
  groundShadow(surface, x + 13, y + 4, length * 0.54, width * 0.36, 0.44);
  // wheels sit under the body, only their contact patch is visible from above
  for (const wheelX of [x - length * 0.3, x + length * 0.3]) {
    fillEllipse(surface, wheelX, y - 2, length * 0.07, width * 0.1, () => [44, 44, 46, 0.9], { softness: 0.4 });
    fillEllipse(surface, wheelX, y - body * 0.86, length * 0.07, width * 0.1, () => [44, 44, 46, 0.8], { softness: 0.4 });
  }
  fillEllipse(surface, x, y - body * 0.44, length * 0.5, body * 0.52, (px, py, distance, edge) => {
    const light = 1.22 - distance * 0.3 + grain(px, py, seed, 0.1);
    return [...shade(color, clamp(light, 0.55, 1.4)), edge > 0 ? 1 : 0];
  }, { softness: 0.1 });
  // cabin plus front and rear glass
  fillEllipse(surface, x - length * 0.02, y - body * 0.46, length * 0.24, body * 0.36, (_px, _py, distance) => [
    ...shade(color, clamp(1.3 - distance * 0.2, 0.7, 1.5)),
    1
  ], { softness: 0.12 });
  fillPolygon(surface, [
    [x - length * 0.2, y - body * 0.2],
    [x + length * 0.02, y - body * 0.2],
    [x + length * 0.02, y - body * 0.34],
    [x - length * 0.22, y - body * 0.34]
  ], () => [58, 76, 92, 0.92]);
  fillPolygon(surface, [
    [x - length * 0.2, y - body * 0.58],
    [x + length * 0.02, y - body * 0.58],
    [x + length * 0.02, y - body * 0.72],
    [x - length * 0.22, y - body * 0.72]
  ], () => [66, 86, 104, 0.9]);
  strokeLine(surface, x - length * 0.34, y - body * 0.62, x + length * 0.34, y - body * 0.6, 3, () => [255, 252, 240, 0.24]);
  fillEllipse(surface, x + length * 0.44, y - body * 0.3, length * 0.05, body * 0.1, () => [244, 238, 210, 0.75], { softness: 0.4 });
  fillEllipse(surface, x + length * 0.44, y - body * 0.6, length * 0.05, body * 0.1, () => [244, 238, 210, 0.75], { softness: 0.4 });
  fillEllipse(surface, x - length * 0.45, y - body * 0.44, length * 0.04, body * 0.22, () => [176, 62, 52, 0.7], { softness: 0.45 });
}

export function drawVan(surface, x, y, length, seed, { color = [232, 232, 226] } = {}) {
  const width = length * 0.46;
  groundShadow(surface, x + 14, y + 6, length * 0.58, width * 0.46, 0.44);
  fillPolygon(surface, [
    [x - length / 2, y],
    [x + length / 2, y],
    [x + length / 2 - 6, y - width],
    [x - length / 2 + 6, y - width]
  ], (px, py, u, v) => {
    const light = 1.16 - v * 0.3 + grain(px, py, seed, 0.1);
    return shade(color, clamp(light, 0.62, 1.3));
  });
  fillPolygon(surface, [
    [x + length * 0.24, y - width * 0.1],
    [x + length / 2 - 4, y - width * 0.16],
    [x + length / 2 - 9, y - width * 0.86],
    [x + length * 0.22, y - width * 0.8]
  ], () => [64, 82, 96, 0.9]);
  strokeLine(surface, x - length * 0.42, y - width * 0.52, x + length * 0.08, y - width * 0.52, 12, () => [88, 132, 96, 0.55]);
  for (const wheelX of [x - length * 0.3, x + length * 0.28]) {
    fillEllipse(surface, wheelX, y - 1, length * 0.075, width * 0.14, () => [40, 40, 42, 0.94], { softness: 0.3 });
  }
}

export function drawBench(surface, x, y, width, seed) {
  groundShadow(surface, x + 8, y + 3, width * 0.6, 8, 0.3);
  fillPolygon(surface, [
    [x - width / 2, y - 8],
    [x + width / 2, y - 8],
    [x + width / 2 - 3, y - 20],
    [x - width / 2 + 3, y - 20]
  ], (px, py) => shade([146, 108, 68], clamp(1 + grain(px, py, seed, 0.24), 0.7, 1.25)));
  fillPolygon(surface, [
    [x - width / 2 + 3, y - 22],
    [x + width / 2 - 3, y - 22],
    [x + width / 2 - 5, y - 38],
    [x - width / 2 + 5, y - 38]
  ], (px, py) => shade([124, 92, 58], clamp(1 + grain(px, py, seed + 2, 0.2), 0.7, 1.2)));
}

export function drawBin(surface, x, y, seed) {
  groundShadow(surface, x + 5, y + 2, 12, 5, 0.3);
  fillPolygon(surface, [
    [x - 9, y],
    [x + 9, y],
    [x + 7, y - 26],
    [x - 7, y - 26]
  ], (px, py) => shade([72, 88, 74], clamp(1 + grain(px, py, seed, 0.22), 0.72, 1.24)));
  fillEllipse(surface, x, y - 27, 8, 3.4, () => [96, 112, 96, 1], { softness: 0.3 });
}

export function drawFlagPole(surface, x, y, height, seed, { color = [188, 68, 60] } = {}) {
  groundShadow(surface, x + 6, y + 2, 8, 4, 0.28);
  strokeLine(surface, x, y, x, y - height, 3.4, () => [206, 202, 190, 0.95]);
  const wave = Math.sin(seed) * 6;
  fillPolygon(surface, [
    [x + 1.5, y - height],
    [x + 34, y - height + 6 + wave],
    [x + 34, y - height + 26 + wave],
    [x + 1.5, y - height + 30]
  ], (px, py, u, v) => shade(color, clamp(1.12 - v * 0.34 + Math.sin(u * 6 + seed) * 0.08, 0.66, 1.3)));
}

export function drawPottedPlant(surface, x, y, seed) {
  const rng = createRng(seed);
  groundShadow(surface, x + 6, y + 2, 15, 6, 0.3);
  fillPolygon(surface, [
    [x - 12, y],
    [x + 12, y],
    [x + 9, y - 18],
    [x - 9, y - 18]
  ], (px, py) => shade([166, 108, 78], clamp(1 + grain(px, py, seed, 0.2), 0.74, 1.2)));
  for (let index = 0; index < 9; index++) {
    const cx = x + (rng() - 0.5) * 26;
    const cy = y - 20 - rng() * 20;
    fillEllipse(surface, cx, cy, 8 + rng() * 5, 6 + rng() * 4, (_px, _py, distance) => [
      ...mixColor([58, 96, 52], [136, 170, 88], clamp(1 - distance + rng() * 0.2, 0, 1)),
      0.95
    ], { softness: 0.45 });
  }
}

export function drawBuntingLine(surface, points, seed, { sag = 26, flagHeight = 20, alpha = 1 } = {}) {
  const rng = createRng(seed);
  const colors = [[196, 66, 58], [232, 222, 206], [64, 104, 152], [214, 172, 66], [72, 122, 84]];
  const [x0, y0] = points[0];
  const [x1, y1] = points[1];
  const segments = Math.max(8, Math.round(Math.hypot(x1 - x0, y1 - y0) / 26));
  let previous = null;
  for (let index = 0; index <= segments; index++) {
    const t = index / segments;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t + Math.sin(Math.PI * t) * sag;
    if (previous) strokeLine(surface, previous[0], previous[1], x, y, 2.2, () => [58, 54, 48, 0.8 * alpha]);
    if (index < segments) {
      const color = colors[index % colors.length];
      const lean = (rng() - 0.5) * 5;
      fillPolygon(surface, [
        [x - 8, y + 1],
        [x + 8, y + 1],
        [x + lean, y + flagHeight]
      ], (px, py, _u, v) => [...shade(color, clamp(1.14 - v * 0.4, 0.6, 1.3)), 0.97 * alpha]);
    }
    previous = [x, y];
  }
}

export function drawGateArch(surface, x, y, width, height, label, seed) {
  const half = width / 2;
  groundShadow(surface, x + 10, y + 4, half * 0.5, 10, 0.3);
  for (const poleX of [x - half, x + half]) {
    fillPolygon(surface, [
      [poleX - 7, y],
      [poleX + 7, y],
      [poleX + 5, y - height],
      [poleX - 5, y - height]
    ], (px, py) => shade([116, 96, 74], clamp(1 + grain(px, py, seed, 0.2), 0.7, 1.24)));
  }
  fillPolygon(surface, [
    [x - half - 6, y - height],
    [x + half + 6, y - height],
    [x + half + 4, y - height - 46],
    [x - half - 4, y - height - 46]
  ], (px, py, u, v) => {
    const banner = mixColor([46, 104, 74], [78, 148, 104], clamp(v + Math.sin(u * 9) * 0.08, 0, 1));
    return shade(banner, clamp(1 + grain(px, py, seed + 3, 0.1), 0.8, 1.18));
  });
  const pixel = Math.max(2, Math.round(width / 108));
  drawText(surface, label, x - textWidth(label, pixel) / 2, y - height - 34, pixel, [242, 238, 220], 0.96);
}

export function paintedGround(x, y, seed, palette, { scale = 0.02, contrast = 1 } = {}) {
  const noise = fbm(x * scale, y * scale, { seed, octaves: 5, gain: 0.55 });
  const detail = fbm(x * scale * 6.5, y * scale * 6.5, { seed: seed + 31, octaves: 3, gain: 0.5 });
  const t = clamp((noise * 0.72 + detail * 0.28 - 0.5) * contrast + 0.5, 0, 1);
  return mixColor(palette[0], palette[1], smoothstep(0, 1, t));
}
