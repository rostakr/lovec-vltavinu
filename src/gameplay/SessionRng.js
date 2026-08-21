export function createSessionSeed() {
  return (Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0;
}

export function createRng(seed) {
  let s = Math.imul((seed | 0) ^ 0x9e3779b9, 2654435761) >>> 0;
  if (s === 0) s = 1;
  for (let i = 0; i < 4; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; }
  return function next() {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}
