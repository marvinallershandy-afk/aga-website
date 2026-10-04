// ─────────────────────────────────────────────────────────────
// v14-A: Kleine, deterministische Rausch-Helfer für alles, was
// beim Start einmal prozedural gebacken wird (Rasen, Waldboden,
// Baumkronen). Bewusst ohne Abhängigkeit — Value-Noise reicht für
// organische Flecken/Beulen und ist schnell genug für ~100k Aufrufe.
// ─────────────────────────────────────────────────────────────

export function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function hash3(ix: number, iy: number, iz: number, seed: number): number {
  let h =
    Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 2147483647) ^ Math.imul(seed, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const fade = (t: number) => t * t * (3 - 2 * t)

/** 2D-Value-Noise 0..1 */
export function noise2(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = fade(x - ix)
  const fy = fade(y - iy)
  const a = hash2(ix, iy, seed)
  const b = hash2(ix + 1, iy, seed)
  const c = hash2(ix, iy + 1, seed)
  const d = hash2(ix + 1, iy + 1, seed)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

/** 3D-Value-Noise 0..1 */
export function noise3(x: number, y: number, z: number, seed = 0): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx = fade(x - ix)
  const fy = fade(y - iy)
  const fz = fade(z - iz)
  const l = (dx: number, dy: number, dz: number) => hash3(ix + dx, iy + dy, iz + dz, seed)
  const x00 = l(0, 0, 0) + (l(1, 0, 0) - l(0, 0, 0)) * fx
  const x10 = l(0, 1, 0) + (l(1, 1, 0) - l(0, 1, 0)) * fx
  const x01 = l(0, 0, 1) + (l(1, 0, 1) - l(0, 0, 1)) * fx
  const x11 = l(0, 1, 1) + (l(1, 1, 1) - l(0, 1, 1)) * fx
  const y0 = x00 + (x10 - x00) * fy
  const y1 = x01 + (x11 - x01) * fy
  return y0 + (y1 - y0) * fz
}

/** Fraktales 2D-Rauschen 0..1 (normiert) */
export function fbm2(x: number, y: number, octaves = 4, seed = 0): number {
  let amp = 0.5
  let freq = 1
  let sum = 0
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += noise2(x * freq, y * freq, seed + o * 17) * amp
    norm += amp
    amp *= 0.5
    freq *= 2.03
  }
  return sum / norm
}

export function fbm3(x: number, y: number, z: number, octaves = 3, seed = 0): number {
  let amp = 0.5
  let freq = 1
  let sum = 0
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += noise3(x * freq, y * freq, z * freq, seed + o * 31) * amp
    norm += amp
    amp *= 0.5
    freq *= 2.07
  }
  return sum / norm
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
