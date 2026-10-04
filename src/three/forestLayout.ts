import { mulberry32 } from './proceduralNoise'

// ─────────────────────────────────────────────────────────────
// v14-A „Waldsportplatz": EINE Quelle für die Lage des Laubwalds.
// Der echte Platz ist auf drei Seiten (W, S, O) von alten Buchen/
// Eichen umschlossen, Nord ist offen zu Dorf/Parkplatz. Die Lichtung
// ist als Vereinigung von Rechtecken modelliert (vorzeichenbehaftete
// Distanz, SDF): > 0 = im Wald, < 0 = auf der Lichtung. Dieselbe
// Funktion verteilt die Bäume (ForestTrees) UND malt den Waldboden
// (Ground) — Baumfüße und Laubstreu liegen so garantiert übereinander.
//
// Kompass: +x Ost, +z Süd. Maßstab 1 Einheit = 10 m.
// Fixpunkte: Reling ±5.8/±3.95, Fanblock bis z≈4.8 (SO), Masten
// (±6.95, ±5.1), Vereinsheim x 6.6…7.6 / z −3.65…1.95, Klinker-Hütte
// (−4.6, −4.6), Parkplatz NO.
// ─────────────────────────────────────────────────────────────

interface Box { x0: number; x1: number; z0: number; z1: number }

const CLEARING: Box[] = [
  // Platz + Reling + Wege + Fanblock (Nord offen → z0 weit draußen)
  { x0: -6.9, x1: 6.45, z0: -40, z1: 5.15 },
  // Vereinsheim + Hof + Zufahrt (bis Höhe Südgiebel)
  { x0: 5.8, x1: 8.35, z0: -40, z1: 2.45 },
  // Nord: Dorf, Parkplatz, Klinker-Hütte — bleibt frei (wie bisher)
  { x0: -9.6, x1: 40, z0: -40, z1: -4.05 },
]

function boxSdf(b: Box, x: number, z: number): number {
  const cx = (b.x0 + b.x1) / 2
  const cz = (b.z0 + b.z1) / 2
  const hx = (b.x1 - b.x0) / 2
  const hz = (b.z1 - b.z0) / 2
  const dx = Math.abs(x - cx) - hx
  const dz = Math.abs(z - cz) - hz
  const ox = Math.max(dx, 0)
  const oz = Math.max(dz, 0)
  return Math.hypot(ox, oz) + Math.min(Math.max(dx, dz), 0)
}

/** Vorzeichenbehaftete Distanz zum Waldrand: > 0 im Wald (Einheiten). */
export function forestDepth(x: number, z: number): number {
  let d = Infinity
  for (const b of CLEARING) d = Math.min(d, boxSdf(b, x, z))
  return d
}

// Flutlicht-Masten: Stamm-Sperrzone (Kronen dürfen überhängen)
export const MAST_POSITIONS: [number, number][] = [
  [-6.95, -5.1], [6.95, -5.1], [6.95, 5.1], [-6.95, 5.1],
]

export interface TreePlacement {
  x: number
  z: number
  /** Gesamthöhe in Welt-Einheiten */
  h: number
  /** Kronen-Breitenfaktor */
  w: number
  rot: number
  variant: number
  /** Tiefe in den Wald (SDF, Einheiten) */
  depth: number
  tint: [number, number, number]
}

export interface ForestTier {
  maxDepth: number
  /** Mindestabstand am Rand / tief im Wald */
  spacingEdge: number
  spacingDeep: number
  /** ab dieser Tiefe die günstige Fern-Variante */
  farFrom: number
  bushes: number
}

export const FOREST_TIERS: Record<'full' | 'reduced', ForestTier> = {
  // v14-E6: Tiefe 6.2→5.0 + Abstand 1.5→1.8 — die hinteren Reihen sind im Bild kaum sichtbar,
  // kosteten aber die gelegentlichen 33-ms-Frames an den Wald-Stationen.
  full: { maxDepth: 5.0, spacingEdge: 0.98, spacingDeep: 1.8, farFrom: 2.4, bushes: 90 },
  reduced: { maxDepth: 3.4, spacingEdge: 1.12, spacingDeep: 1.6, farFrom: 0, bushes: 0 },
}

const MAX_R = 17.2 // dahinter übernimmt die Treeline-Silhouette

export function buildForest(tier: ForestTier): { trees: TreePlacement[]; bushes: TreePlacement[] } {
  const rng = mulberry32(19490712)
  const trees: TreePlacement[] = []
  // Dart-Throwing mit Gitter-Beschleunigung
  const CELL = 0.7
  const grid = new Map<string, TreePlacement[]>()
  const key = (gx: number, gz: number) => gx + ',' + gz
  const near = (x: number, z: number, r: number) => {
    const gx = Math.floor(x / CELL)
    const gz = Math.floor(z / CELL)
    const n = Math.ceil(r / CELL)
    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        const list = grid.get(key(gx + i, gz + j))
        if (!list) continue
        for (const t of list) if (Math.hypot(t.x - x, t.z - z) < r) return true
      }
    }
    return false
  }

  // Erst der Waldrand (dichte, beleuchtete Front), dann die Tiefe
  const passes = [
    { tries: 9000, dMin: 0.12, dMax: 1.3 },
    { tries: 16000, dMin: 0.12, dMax: tier.maxDepth },
  ]
  for (const pass of passes) {
    for (let k = 0; k < pass.tries; k++) {
      const x = -18 + rng() * 36
      const z = -11 + rng() * 29
      if (Math.hypot(x, z * 1.08) > MAX_R) continue
      const d = forestDepth(x, z)
      if (d < pass.dMin || d > pass.dMax) continue
      if (MAST_POSITIONS.some(([mx, mz]) => Math.hypot(mx - x, mz - z) < 0.42)) continue
      const t = Math.min(1, d / tier.maxDepth)
      const spacing = tier.spacingEdge + (tier.spacingDeep - tier.spacingEdge) * t
      if (near(x, z, spacing * (0.86 + rng() * 0.2))) continue

      const deep = d > tier.farFrom
      const variant = deep ? 2 : rng() < 0.58 ? 0 : 1
      // alte Buchen/Eichen: 21–33 m, tiefer im Bestand eher höher
      const h = 2.1 + rng() * 0.75 + t * 0.45
      const w = 0.86 + rng() * 0.36
      let tint: [number, number, number]
      const r = rng()
      if (variant === 1) tint = [1.08 + r * 0.1, 1.02 + r * 0.06, 0.82] // Eiche: olivgelber
      else if (r < 0.04 && d < 2) tint = [1.55, 0.72, 0.72] // vereinzelte Blutbuche
      else tint = [0.9 + r * 0.16, 0.94 + r * 0.14, 0.9 + r * 0.12]
      const p: TreePlacement = { x, z, h, w, rot: rng() * Math.PI * 2, variant, depth: d, tint }
      trees.push(p)
      const gk = key(Math.floor(x / CELL), Math.floor(z / CELL))
      const list = grid.get(gk)
      if (list) list.push(p)
      else grid.set(gk, [p])
    }
  }

  // Unterholz-Saum: Büsche/Jungwuchs genau an der Kante, schließt die
  // Lücken zwischen den Stämmen (der Wald wird eine Wand, kein Park).
  const bushes: TreePlacement[] = []
  const brng = mulberry32(777)
  for (let k = 0; k < 20000 && bushes.length < tier.bushes; k++) {
    const x = -14 + brng() * 28
    const z = -8 + brng() * 22
    const d = forestDepth(x, z)
    if (d < -0.12 || d > 1.0) continue
    if (MAST_POSITIONS.some(([mx, mz]) => Math.hypot(mx - x, mz - z) < 0.4)) continue
    if (bushes.some((b) => Math.hypot(b.x - x, b.z - z) < 0.42)) continue
    const r = brng()
    bushes.push({
      x, z,
      h: 0.22 + r * 0.32,
      w: 1.1 + brng() * 0.6,
      rot: brng() * Math.PI * 2,
      variant: 3,
      depth: Math.max(0, d),
      tint: [0.9 + r * 0.2, 0.95 + r * 0.15, 0.85],
    })
  }
  return { trees, bushes }
}
