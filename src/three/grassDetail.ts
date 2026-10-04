import * as THREE from 'three'
import { mulberry32 } from './proceduralNoise'

// ─────────────────────────────────────────────────────────────
// v14-A: Kachelbare Gras-Detailtextur (256², nahtlos), geteilt von
// Rasen (Pitch) und Umraum (Ground). Löst das „Tapete"-Problem bei
// tiefen Kameras: die 2048er-Platztextur hat ~5,5 cm/px — bei der
// Banden-Kamera (1 Einheit Abstand) ist das matschig. Die Detail-
// kachel wird in Weltkoordinaten dicht wiederholt (~3,5 m pro Kachel)
// und liefert Halm-Struktur für Albedo + Bump.
//  R = Halm-Höhenfeld (Bump + feine Albedo-Modulation)
//  G = kachelbares Büschel-Rauschen (mittlere Frequenz)
//  B = zweites, gegenläufiges Halm-Feld (bricht die Kachelung)
// ─────────────────────────────────────────────────────────────

const S = 256

// Draufsicht auf Rasen: Halme stehen in Büscheln und zeigen in alle
// Richtungen (kein Vorzugswinkel → keine „Cord"-Riefen). Dunkle Lücken
// zwischen den Büscheln, helle Halmspitzen obenauf.
function strokeField(seed: number, count: number): Uint8ClampedArray {
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = 'rgb(84,84,84)'
  ctx.fillRect(0, 0, S, S)
  const rng = mulberry32(seed)
  ctx.lineCap = 'round'
  const tufts = Math.round(count / 7)
  const blades: [number, number, number, number, number, number][] = []
  for (let t = 0; t < tufts; t++) {
    const cx = rng() * S
    const cy = rng() * S
    const n = 4 + Math.floor(rng() * 7)
    const base = rng() * Math.PI * 2
    for (let k = 0; k < n; k++) {
      const ang = base + (k / n) * Math.PI * 2 + (rng() - 0.5) * 0.9
      const len = 2.5 + rng() * 5.5
      const l = Math.round(70 + rng() * 170)
      blades.push([cx + (rng() - 0.5) * 2, cy + (rng() - 0.5) * 2, ang, len, l, 0.7 + rng() * 0.8])
    }
  }
  // dunkle zuerst, helle obenauf (Spitzen fangen das Licht)
  blades.sort((a, b) => a[4] - b[4])
  for (const [x, y, ang, len, l, w] of blades) {
    ctx.strokeStyle = 'rgba(' + l + ',' + l + ',' + l + ',0.75)'
    ctx.lineWidth = w
    const dx = Math.cos(ang) * len
    const dy = Math.sin(ang) * len
    // nahtlos: Striche an den Kanten auf der Gegenseite wiederholen
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        if (x + ox < -12 || x + ox > S + 12 || y + oy < -12 || y + oy > S + 12) continue
        ctx.beginPath()
        ctx.moveTo(x + ox, y + oy)
        ctx.lineTo(x + ox + dx, y + oy + dy)
        ctx.stroke()
      }
    }
  }
  return ctx.getImageData(0, 0, S, S).data
}

// periodisches Value-Noise (Periode = cells) → nahtlos kachelbar
function periodicNoise(cells: number, seed: number): Float32Array {
  const rng = mulberry32(seed)
  const lat = Array.from({ length: cells * cells }, () => rng())
  const out = new Float32Array(S * S)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const fx = (x / S) * cells
      const fy = (y / S) * cells
      const ix = Math.floor(fx)
      const iy = Math.floor(fy)
      let tx = fx - ix
      let ty = fy - iy
      tx = tx * tx * (3 - 2 * tx)
      ty = ty * ty * (3 - 2 * ty)
      const g = (i: number, j: number) => lat[((j % cells) * cells + (i % cells)) % lat.length]
      const a = g(ix, iy)
      const b = g(ix + 1, iy)
      const c = g(ix, iy + 1)
      const d = g(ix + 1, iy + 1)
      out[y * S + x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
    }
  }
  return out
}

let cached: THREE.DataTexture | null = null

/** Gemeinsame Detail-Kachel (RGBA, linear, RepeatWrapping, Mipmaps). */
export function getGrassDetailTexture(): THREE.DataTexture {
  if (cached) return cached
  const r = strokeField(31, 5200)
  const b = strokeField(77, 4200)
  const n1 = periodicNoise(8, 5)
  const n2 = periodicNoise(16, 9)
  const data = new Uint8Array(S * S * 4)
  for (let i = 0; i < S * S; i++) {
    data[i * 4] = r[i * 4]
    data[i * 4 + 1] = Math.round((n1[i] * 0.65 + n2[i] * 0.35) * 255)
    data[i * 4 + 2] = b[i * 4]
    data[i * 4 + 3] = 255
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 8
  tex.needsUpdate = true
  cached = tex
  return tex
}

/** GLSL-Baustein: Detail-Modulation in Weltkoordinaten (xz).
 *  Erwartet uniform sampler2D uGrassDetail und vec2 wxz. */
export const GRASS_DETAIL_GLSL = /* glsl */ `
float grassDetail(vec2 wxz, float dist) {
  vec4 a = texture2D(uGrassDetail, wxz * 2.9);
  vec4 b = texture2D(uGrassDetail, vec2(wxz.y, -wxz.x) * 1.13 + 0.37);
  float blades = mix(a.r, b.b, 0.4);
  float clumps = texture2D(uGrassDetail, wxz * 0.31 + 0.11).g;
  // Mittlere Frequenz (0,5–1,5 m): das Gesprenkelte, das echten Rasen
  // aus 20–50 m von Kunstrasen unterscheidet (Drohnen-Referenz)
  float mottle = texture2D(uGrassDetail, wxz * 0.93 + 0.53).g * 0.6
               + texture2D(uGrassDetail, vec2(-wxz.y, wxz.x) * 2.3 + 0.17).g * 0.4;
  // nah: Halme dominieren; fern: nur noch die Büschel-Flecken
  float near = 1.0 - smoothstep(4.0, 16.0, dist);
  return mix(1.0, 0.7 + blades * 0.6, near * 0.85) * (0.86 + clumps * 0.28) * (0.8 + mottle * 0.4);
}
`
