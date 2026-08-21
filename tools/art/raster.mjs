// Deterministic software raster used to author repository-owned V7 environment art.
// The module has no runtime dependency: it is a build-time tool that writes PNG files
// which are then referenced by assets/manifests/assets.json.

import zlib from "node:zlib";

export function createSurface(width, height, channels = 3) {
  return { width, height, channels, data: new Float32Array(width * height * channels) };
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function mix(a, b, t) {
  return a + (b - a) * t;
}

export function mixColor(a, b, t) {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}

export function shade(color, factor) {
  return [clamp(color[0] * factor, 0, 255), clamp(color[1] * factor, 0, 255), clamp(color[2] * factor, 0, 255)];
}

export function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0 || 1e-9), 0, 1);
  return t * t * (3 - 2 * t);
}

export function createRng(seed = 1) {
  // Sequential seeds must not produce correlated streams: decorrelate first.
  let state = (Math.imul((seed | 0) ^ 0x9e3779b9, 2654435761) >>> 0) || 1;
  for (let index = 0; index < 4; index++) {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
  }
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise(x, y, seed = 0) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = hash2(x0, y0, seed);
  const n10 = hash2(x0 + 1, y0, seed);
  const n01 = hash2(x0, y0 + 1, seed);
  const n11 = hash2(x0 + 1, y0 + 1, seed);
  return mix(mix(n00, n10, sx), mix(n01, n11, sx), sy);
}

export function fbm(x, y, { seed = 0, octaves = 4, frequency = 1, gain = 0.5, lacunarity = 2 } = {}) {
  let amplitude = 1;
  let total = 0;
  let normalization = 0;
  let f = frequency;
  for (let octave = 0; octave < octaves; octave++) {
    total += valueNoise(x * f, y * f, seed + octave * 101) * amplitude;
    normalization += amplitude;
    amplitude *= gain;
    f *= lacunarity;
  }
  return total / (normalization || 1);
}

export function blendPixel(surface, x, y, color, alpha) {
  if (alpha <= 0) return;
  const px = x | 0;
  const py = y | 0;
  if (px < 0 || py < 0 || px >= surface.width || py >= surface.height) return;
  const a = alpha > 1 ? 1 : alpha;
  const index = (py * surface.width + px) * surface.channels;
  const data = surface.data;
  if (surface.channels === 4) {
    const dstA = data[index + 3];
    const outA = a + dstA * (1 - a);
    if (outA <= 0) {
      data[index] = data[index + 1] = data[index + 2] = data[index + 3] = 0;
      return;
    }
    data[index] = (color[0] * a + data[index] * dstA * (1 - a)) / outA;
    data[index + 1] = (color[1] * a + data[index + 1] * dstA * (1 - a)) / outA;
    data[index + 2] = (color[2] * a + data[index + 2] * dstA * (1 - a)) / outA;
    data[index + 3] = outA;
    return;
  }
  data[index] = data[index] * (1 - a) + color[0] * a;
  data[index + 1] = data[index + 1] * (1 - a) + color[1] * a;
  data[index + 2] = data[index + 2] * (1 - a) + color[2] * a;
}

export function forEachPixel(surface, paint) {
  for (let y = 0; y < surface.height; y++) {
    for (let x = 0; x < surface.width; x++) {
      const result = paint(x, y);
      if (!result) continue;
      blendPixel(surface, x, y, result, result[3] ?? 1);
    }
  }
}

export function fillRect(surface, x0, y0, x1, y1, paint) {
  const minX = Math.max(0, Math.floor(Math.min(x0, x1)));
  const maxX = Math.min(surface.width - 1, Math.ceil(Math.max(x0, x1)));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1)));
  const maxY = Math.min(surface.height - 1, Math.ceil(Math.max(y0, y1)));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const result = paint(x, y);
      if (!result) continue;
      blendPixel(surface, x, y, result, result[3] ?? 1);
    }
  }
}

export function fillEllipse(surface, cx, cy, rx, ry, paint, { rotation = 0, softness = 0.12 } = {}) {
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const reach = Math.max(Math.abs(rx * cos) + Math.abs(ry * sin), Math.abs(rx * sin) + Math.abs(ry * cos)) + 2;
  const minX = Math.max(0, Math.floor(cx - reach));
  const maxX = Math.min(surface.width - 1, Math.ceil(cx + reach));
  const minY = Math.max(0, Math.floor(cy - reach));
  const maxY = Math.min(surface.height - 1, Math.ceil(cy + reach));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const lx = (dx * cos - dy * sin) / (rx || 1e-6);
      const ly = (dx * sin + dy * cos) / (ry || 1e-6);
      const distance = Math.hypot(lx, ly);
      if (distance > 1 + softness) continue;
      const edge = 1 - smoothstep(1 - softness, 1 + softness, distance);
      const result = paint(x, y, distance, edge);
      if (!result) continue;
      blendPixel(surface, x, y, result, (result[3] ?? 1) * edge);
    }
  }
}

export function fillPolygon(surface, points, paint) {
  if (points.length < 3) return;
  let minY = Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const [x, y] of points) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
  }
  const startY = Math.max(0, Math.floor(minY));
  const endY = Math.min(surface.height - 1, Math.ceil(maxY));
  for (let y = startY; y <= endY; y++) {
    const sampleY = y + 0.5;
    const crossings = [];
    for (let index = 0; index < points.length; index++) {
      const [x0, y0] = points[index];
      const [x1, y1] = points[(index + 1) % points.length];
      if ((y0 <= sampleY && y1 > sampleY) || (y1 <= sampleY && y0 > sampleY)) {
        crossings.push(x0 + ((sampleY - y0) / (y1 - y0)) * (x1 - x0));
      }
    }
    crossings.sort((a, b) => a - b);
    for (let index = 0; index + 1 < crossings.length; index += 2) {
      const spanStart = Math.max(0, Math.floor(crossings[index]));
      const spanEnd = Math.min(surface.width - 1, Math.ceil(crossings[index + 1]));
      for (let x = spanStart; x <= spanEnd; x++) {
        const coverage = clamp(Math.min(x + 1, crossings[index + 1]) - Math.max(x, crossings[index]), 0, 1);
        if (coverage <= 0) continue;
        const result = paint(x, y, (x - minX) / (maxX - minX || 1), (y - minY) / (maxY - minY || 1));
        if (!result) continue;
        blendPixel(surface, x, y, result, (result[3] ?? 1) * coverage);
      }
    }
  }
}

export function strokeLine(surface, x0, y0, x1, y1, width, paint) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const half = width / 2;
  fillPolygon(surface, [
    [x0 + nx * half, y0 + ny * half],
    [x1 + nx * half, y1 + ny * half],
    [x1 - nx * half, y1 - ny * half],
    [x0 - nx * half, y0 - ny * half]
  ], paint);
}

export function strokePath(surface, points, width, paint) {
  for (let index = 0; index + 1 < points.length; index++) {
    const [x0, y0] = points[index];
    const [x1, y1] = points[index + 1];
    strokeLine(surface, x0, y0, x1, y1, width, paint);
    fillEllipse(surface, x1, y1, width / 2, width / 2, paint, { softness: 0.35 });
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index++) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, payload) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), payload]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, checksum]);
}

function filterRow(raw, previous, stride, channels) {
  const candidates = [];
  for (let type = 0; type <= 4; type++) {
    const filtered = Buffer.alloc(stride);
    let score = 0;
    for (let index = 0; index < stride; index++) {
      const left = index >= channels ? raw[index - channels] : 0;
      const up = previous[index];
      const upLeft = index >= channels ? previous[index - channels] : 0;
      let value;
      if (type === 0) value = raw[index];
      else if (type === 1) value = raw[index] - left;
      else if (type === 2) value = raw[index] - up;
      else if (type === 3) value = raw[index] - ((left + up) >> 1);
      else {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        value = raw[index] - predictor;
      }
      const byte = value & 0xff;
      filtered[index] = byte;
      score += byte < 128 ? byte : 256 - byte;
    }
    candidates.push({ type, filtered, score });
  }
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0];
}

export function encodePng(surface) {
  const { width, height, channels, data } = surface;
  const stride = width * channels;
  const raw = Buffer.alloc(stride);
  let previous = Buffer.alloc(stride);
  const rows = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let channel = 0; channel < channels; channel++) {
        const index = (y * width + x) * channels + channel;
        raw[x * channels + channel] = clamp(Math.round(data[index]), 0, 255);
      }
    }
    const best = filterRow(raw, previous, stride, channels);
    rows.push(Buffer.concat([Buffer.from([best.type]), best.filtered]));
    previous = Buffer.from(raw);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = channels === 4 ? 6 : 2;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  const compressed = zlib.deflateSync(Buffer.concat(rows), { level: 9, memLevel: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0))
  ]);
}
