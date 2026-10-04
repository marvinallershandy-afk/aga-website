import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fbm3, mulberry32, noise3, smoothstep } from './proceduralNoise'

// ─────────────────────────────────────────────────────────────
// v14-A: Prozeduraler Laubbaum (Buche/Eiche), normiert auf Höhe 1
// (Instanz skaliert auf 21–33 m). Zwei Geometrien je Art:
//  · core  — opaker Kronen-Kern aus verrauschten Icosphären
//            („Blumenkohl"-Silhouette alter Buchen), Normalen halb zum
//            Kronen-Ellipsoid gebogen → volumige Schattierung statt
//            Facetten; dazu Stamm mit Wurzelanlauf + Hauptäste.
//  · cards — kleine alpha-getestete Laub-Büschel auf der Kronenhaut:
//            ausgefranste Silhouette gegen den Nachthimmel, Lücken,
//            durch die der Himmel blitzt.
// Vertex-Colors tragen Albedo + gebackene Kronen-AO, `aWind` die
// Biegsamkeit (0 Stammfuß → 1 Wipfel), `aLeaf` Laub (1) vs. Holz (0).
// ─────────────────────────────────────────────────────────────

export interface TreeShape {
  seed: number
  blobs: number
  /** Icosphären-Unterteilung (1 = 80, 2 = 180 Dreiecke je Blob) */
  detail: number
  /** Höhe des Kronenansatzes (0 = Busch ohne Stamm) */
  crownBase: number
  /** Kronenradius horizontal (relativ zur Höhe) */
  width: number
  /** vertikale Stauchung der Krone */
  squash?: number
  leaf: string
  leafVar: number
  bark: string
  limbs: number
  trunkR: number
}

export interface TreeGeometries {
  core: THREE.BufferGeometry
  cards: THREE.BufferGeometry | null
}

const _c = new THREE.Color()

/** Zylinder zwischen zwei Punkten (für Äste) */
function branch(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, seg: number): THREE.BufferGeometry {
  const dir = b.clone().sub(a)
  const len = dir.length()
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 2, true)
  g.translate(0, len / 2, 0)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  g.applyQuaternion(q)
  g.translate(a.x, a.y, a.z)
  return g
}

function finish(
  g: THREE.BufferGeometry,
  color: (p: THREE.Vector3) => THREE.Color,
  wind: (p: THREE.Vector3) => number,
  leafFlag: number,
) {
  g.deleteAttribute('uv')
  const pos = g.attributes.position
  const n = pos.count
  const col = new Float32Array(n * 3)
  const wnd = new Float32Array(n)
  const p = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i)
    const c = color(p)
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
    wnd[i] = wind(p)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setAttribute('aWind', new THREE.BufferAttribute(wnd, 1))
  g.setAttribute('aLeaf', new THREE.BufferAttribute(new Float32Array(n).fill(leafFlag), 1))
  return g
}

interface Blob { c: THREE.Vector3; r: number; tone: number }

export function makeTreeGeometry(s: TreeShape, cardsPerBlob = 0): TreeGeometries {
  const rng = mulberry32(s.seed)
  const parts: THREE.BufferGeometry[] = []
  const squash = s.squash ?? 1
  const cb = s.crownBase
  const ry = ((1 - cb) / 2) * squash
  const cy = 1 - ry
  const rx = s.width
  const C = new THREE.Vector3(0, cy, 0)
  const leaf = new THREE.Color(s.leaf) // Hex → linearer Arbeitsfarbraum
  const bark = new THREE.Color(s.bark)
  const windOf = (p: THREE.Vector3) => Math.pow(smoothstep(cb * 0.75, 1.0, p.y), 1.4)

  // ── Krone: Blob-Zentren ──────────────────────────────────────
  const centers: Blob[] = []
  centers.push({ c: C.clone(), r: Math.min(rx, ry) * 0.82, tone: 0 })
  for (let i = 1; i < s.blobs; i++) {
    // Richtung mit Bias nach oben/außen (Buchenkronen sind oben voll)
    const th = rng() * Math.PI * 2
    const yv = -0.45 + rng() * 1.35
    const hr = Math.sqrt(Math.max(0, 1 - Math.min(1, yv * yv)))
    const d = new THREE.Vector3(Math.cos(th) * hr, Math.min(1, yv), Math.sin(th) * hr).normalize()
    const k = 0.56 + rng() * 0.24
    const c = new THREE.Vector3(d.x * rx * k, cy + d.y * ry * k, d.z * rx * k)
    const r = Math.min(rx, ry) * (0.4 + rng() * 0.2)
    centers.push({ c, r, tone: (rng() - 0.5) * 2 })
  }

  // Oberflächenradius eines Blobs in Richtung v: grobe Beulen
  // (Laub-Klumpen) + feines Knistern
  const surfR = (b: Blob, v: THREE.Vector3) => {
    const wx = b.c.x + v.x * b.r
    const wy = b.c.y + v.y * b.r
    const wz = b.c.z + v.z * b.r
    const n1 = (fbm3(wx * 11.0, wy * 11.0, wz * 11.0, 2, s.seed) - 0.5) * 2
    const n2 = (noise3(wx * 23, wy * 23, wz * 23, s.seed + 5) - 0.5) * 2
    return b.r * (1 + n1 * 0.38 + n2 * 0.1)
  }
  // gebackene Kronen-AO: unten + innen dunkler, Wipfel hell
  const leafColor = (p: THREE.Vector3, tone: number, boost: number) => {
    const ey = (p.y - cy) / ry
    const er = Math.hypot((p.x - C.x) / rx, (p.y - C.y) / ry, (p.z - C.z) / rx)
    const ao = (0.42 + 0.58 * smoothstep(-1.05, 0.85, ey)) * (0.5 + 0.5 * smoothstep(0.45, 1.0, er))
    const jitter = (noise3(p.x * 31, p.y * 31, p.z * 31, s.seed + 9) - 0.5) * 0.22
    const l = (1 + tone * s.leafVar + jitter) * ao * boost
    _c.copy(leaf).multiplyScalar(l)
    // Wipfel minimal gelber (junges Laub), Unterseite kühler
    _c.r *= 1 + 0.12 * smoothstep(0.2, 1, ey)
    _c.b *= 1 + 0.15 * smoothstep(0.0, -1, ey)
    return _c
  }
  // mit Blatt-Karten wird der Kern etwas kleiner — die Karten bilden
  // dann die äußere, ausgefranste Kronenhaut
  const coreK = cardsPerBlob > 0 ? 0.86 : 1
  const radial = new THREE.Vector3()
  const ln = new THREE.Vector3()
  const volumeNormal = (x: number, y: number, z: number, local: THREE.Vector3, wLocal: number) => {
    radial.set((x - C.x) / (rx * rx), (y - C.y) / (ry * ry), (z - C.z) / (rx * rx)).normalize()
    return ln.copy(local).multiplyScalar(wLocal).addScaledVector(radial, 1 - wLocal).normalize()
  }

  for (const b of centers) {
    let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, s.detail)
    g.deleteAttribute('normal')
    g.deleteAttribute('uv')
    g = mergeVertices(g)
    const pos = g.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize()
      const rr = surfR(b, v) * coreK
      let py = b.c.y + v.y * rr
      // Kronen-Unterseite leicht abgeflacht (Lichtkrone, kein Ball)
      if (py < cb + 0.02) py = cb + 0.02 + (py - cb - 0.02) * 0.35
      pos.setXYZ(i, b.c.x + v.x * rr, py, b.c.z + v.z * rr)
    }
    g.computeVertexNormals()
    // Normalen zum Kronen-Ellipsoid biegen → volumige Gesamtform
    const nrm = g.attributes.normal
    const local = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      local.fromBufferAttribute(nrm, i)
      const n = volumeNormal(pos.getX(i), pos.getY(i), pos.getZ(i), local, 0.42)
      nrm.setXYZ(i, n.x, n.y, n.z)
    }
    const tone = b.tone
    finish(g, (p) => leafColor(p, tone, 1), windOf, 1)
    parts.push(g)
  }

  // ── Stamm + Hauptäste ────────────────────────────────────────
  if (cb > 0.05) {
    const th = cb + 0.16
    let trunk: THREE.BufferGeometry = new THREE.CylinderGeometry(s.trunkR * 0.55, s.trunkR, th, 8, 5, true)
    trunk.translate(0, th / 2, 0)
    const tp = trunk.attributes.position
    const lean = (rng() - 0.5) * 0.04
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i)
      const y = tp.getY(i)
      const z = tp.getZ(i)
      const flare = 1 + Math.pow(Math.max(0, 1 - y / 0.06), 2) * 0.85
      const bend = Math.sin(y * 5 + s.seed) * 0.006 + lean * y
      tp.setXYZ(i, x * flare + bend, y, z * flare)
    }
    trunk.computeVertexNormals()
    trunk = finish(
      trunk,
      (p) => {
        const ao = 0.5 + 0.5 * smoothstep(0.0, 0.18, p.y) - 0.25 * smoothstep(cb - 0.05, cb + 0.15, p.y)
        const streak = (noise3(p.x * 60, p.y * 9, p.z * 60, s.seed + 3) - 0.5) * 0.35
        return _c.copy(bark).multiplyScalar(Math.max(0.2, ao + streak))
      },
      windOf,
      0,
    )
    parts.push(trunk)

    for (let i = 0; i < s.limbs; i++) {
      const target = centers[1 + ((i * 3 + 1) % (centers.length - 1))].c
      const a = new THREE.Vector3(0, cb * (0.8 + rng() * 0.15), 0)
      const b = new THREE.Vector3(target.x * 0.85, Math.max(target.y, cb + 0.12), target.z * 0.85)
      let g = branch(a, b, s.trunkR * 0.42, s.trunkR * 0.16, 5)
      g = finish(g, () => _c.copy(bark).multiplyScalar(0.55), windOf, 0)
      parts.push(g)
    }
  }

  for (const p of parts) {
    if (!p.index) {
      const idx = Array.from({ length: p.attributes.position.count }, (_, i) => i)
      p.setIndex(idx)
    }
  }
  const core = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  core.computeBoundingSphere()

  // ── Blatt-Karten ─────────────────────────────────────────────
  let cards: THREE.BufferGeometry | null = null
  if (cardsPerBlob > 0) {
    const crng = mulberry32(s.seed * 7 + 3)
    const P: number[] = []
    const N: number[] = []
    const UV: number[] = []
    const COL: number[] = []
    const W: number[] = []
    const CEN: number[] = []
    const IDX: number[] = []
    const v = new THREE.Vector3()
    const n = new THREE.Vector3()
    const t = new THREE.Vector3()
    const bt = new THREE.Vector3()
    const q = new THREE.Vector3()
    const out = new THREE.Vector3()
    const corners = [
      [-1, -1, 0, 0],
      [1, -1, 1, 0],
      [1, 1, 1, 1],
      [-1, 1, 0, 1],
    ]
    for (const b of centers) {
      out.copy(b.c).sub(C)
      const outLen = out.length()
      if (outLen > 1e-4) out.divideScalar(outLen)
      for (let k = 0; k < cardsPerBlob; k++) {
        v.set(crng() * 2 - 1, crng() * 2 - 1 + 0.35, crng() * 2 - 1).normalize()
        if (outLen > 1e-4) v.addScaledVector(out, 0.9).normalize()
        const rr = surfR(b, v)
        const p = b.c.clone().addScaledVector(v, rr * (0.88 + crng() * 0.2))
        if (p.y < cb + 0.04) continue
        const sz = b.r * (0.95 + crng() * 0.55)
        n.copy(v).add(q.set(crng() - 0.5, crng() - 0.5, crng() - 0.5).multiplyScalar(1.1)).normalize()
        t.set(crng() - 0.5, crng() - 0.5, crng() - 0.5).cross(n).normalize()
        bt.copy(n).cross(t)
        const base = P.length / 3
        const flip = crng() < 0.5
        const tone = (crng() - 0.5) * 2
        for (const [a, c, u, w] of corners) {
          const x = p.x + (t.x * a + bt.x * c) * sz * 0.5
          const y = p.y + (t.y * a + bt.y * c) * sz * 0.5
          const z = p.z + (t.z * a + bt.z * c) * sz * 0.5
          P.push(x, y, z)
          const nn = volumeNormal(x, y, z, v, 0.35)
          N.push(nn.x, nn.y, nn.z)
          UV.push(flip ? 1 - u : u, w)
          q.set(x, y, z)
          const cc = leafColor(q, tone, 1.2)
          COL.push(cc.r, cc.g, cc.b)
          W.push(windOf(q))
          CEN.push(p.x, p.y, p.z)
        }
        IDX.push(base, base + 1, base + 2, base, base + 2, base + 3)
      }
    }
    cards = new THREE.BufferGeometry()
    cards.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
    cards.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3))
    cards.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2))
    cards.setAttribute('color', new THREE.Float32BufferAttribute(COL, 3))
    cards.setAttribute('aWind', new THREE.Float32BufferAttribute(W, 1))
    cards.setAttribute('aCenter', new THREE.Float32BufferAttribute(CEN, 3))
    cards.setAttribute('aLeaf', new THREE.Float32BufferAttribute(new Float32Array(W.length).fill(1), 1))
    cards.setIndex(IDX)
    cards.computeBoundingSphere()
  }
  return { core, cards }
}

/** Laub-Büschel-Textur: Graustufen + Alpha (Farbe kommt aus den Vertex-Colors) */
export function makeLeafTexture(): THREE.CanvasTexture {
  const S = 256
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const ctx = cv.getContext('2d')!
  const rng = mulberry32(4242)
  ctx.clearRect(0, 0, S, S)
  const leafAt = (x: number, y: number, len: number, wid: number, ang: number, l: number) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(ang)
    ctx.fillStyle = 'rgb(' + l + ',' + l + ',' + l + ')'
    ctx.beginPath()
    ctx.moveTo(-len / 2, 0)
    ctx.quadraticCurveTo(0, -wid, len / 2, 0)
    ctx.quadraticCurveTo(0, wid, -len / 2, 0)
    ctx.fill()
    ctx.restore()
  }
  // 9 Zweig-Büschel, hinten dunkel → vorne hell (Tiefe im Büschel)
  const clusters = Array.from({ length: 9 }, () => ({
    x: 52 + rng() * 152,
    y: 52 + rng() * 152,
    r: 30 + rng() * 26,
  }))
  for (let layer = 0; layer < 3; layer++) {
    for (const c of clusters) {
      const count = 26 - layer * 6
      for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2
        const rr = Math.sqrt(rng()) * c.r
        const x = c.x + Math.cos(a) * rr
        const y = c.y + Math.sin(a) * rr
        const len = 11 + rng() * 9
        leafAt(x, y, len, 4 + rng() * 3, a + (rng() - 0.5) * 1.2, Math.round(95 + layer * 45 + rng() * 35))
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 2
  return tex
}

// Die Baumarten am Waldsportplatz (Nacht-Albedo, sRGB-Hex)
export const TREE_SHAPES: TreeShape[] = [
  // 0 · alte Rotbuche: hohe, dichte, oben volle Krone, glatte graue Rinde
  { seed: 11, blobs: 15, detail: 2, crownBase: 0.34, width: 0.39, leaf: '#36562a', leafVar: 0.16, bark: '#77746b', limbs: 3, trunkR: 0.021 },
  // 1 · Stieleiche: breiter, lockerer, olivgrün, dunkle Borke
  { seed: 23, blobs: 16, detail: 2, crownBase: 0.3, width: 0.46, squash: 0.92, leaf: '#42572a', leafVar: 0.2, bark: '#4d4338', limbs: 4, trunkR: 0.024 },
  // 2 · Bestand dahinter (günstig, im Fog)
  { seed: 37, blobs: 10, detail: 1, crownBase: 0.32, width: 0.42, leaf: '#33502a', leafVar: 0.14, bark: '#5b5850', limbs: 0, trunkR: 0.02 },
  // 3 · Unterholz/Jungwuchs am Saum (kein Stamm)
  { seed: 51, blobs: 6, detail: 1, crownBase: 0, width: 0.62, squash: 1.0, leaf: '#2f4c26', leafVar: 0.2, bark: '#3a3530', limbs: 0, trunkR: 0 },
]
