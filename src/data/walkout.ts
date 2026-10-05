// ─────────────────────────────────────────────────────────────
// GENERIERT von scripts/walkout/build.mjs — nicht von Hand pflegen.
// v16-W: Walkout-Videos (freigestellte Dolly-Clips). Nur bestätigte
// Zuordnungen (walkout.config.json → confirmed: true). Doku: docs/WALKOUT.md
// ─────────────────────────────────────────────────────────────

export interface WalkoutAsset {
  slug: string
}

/** v17-D: Walkout-Videos in Karten/Hover/Modal zeigen? Aus, bis die
 *  Greenscreen-Aufnahmen da sind (Dolly-Clips zu unscharf) — dann zeigen
 *  die Karten die scharfen Foto-Freisteller. Code + Assets bleiben.
 *  (Die 3D-Aufstellung auf /live nutzt den Atlas unabhängig davon.) */
export const WALKOUT_ENABLED = false

/** Cache-Buster der aktuellen Asset-Generation. */
export const WALKOUT_VERSION = 'muv5a9yx'
export const WALKOUT_BASE = '/players/walkout/'
/** Bildformat je Spieler-Video (Breite × Höhe; Spieler Scheitel 5 % … Sohle 96 %). */
export const WALKOUT_SIZE = { w: 360, h: 720, headY: 0.05, feetY: 0.96 } as const

export const WALKOUT: Record<string, WalkoutAsset> = {
  'p-sladek': { slug: 'justin-sladek' },
  'p-bruenjes': { slug: 'janek-bruenjes' },
  'p-pejas-e': { slug: 'elias-pejas' },
  'p-neuber-m': { slug: 'marcel-neuber' },
  'p-matthes': { slug: 'paul-matthes' },
  'p-ebeling-t': { slug: 'tino-ebeling' },
  'p-pils': { slug: 'malte-pils' },
  'p-warkehr-i': { slug: 'isaak-warkehr' },
  's-hause': { slug: 'niko-hause' },
  'p-paruzel': { slug: 'julio-paruzel' },
  'p-elsen': { slug: 'joshua-elsen' },
  'p-warkehr-a': { slug: 'aaron-warkehr' },
  'p-becker': { slug: 'niclas-becker' },
  'p-brettschneider': { slug: 'lennard-brettschneider' },
  'p-huettry': { slug: 'justin-huettry' },
  'p-biedermann': { slug: 'marc-kevin-biedermann' },
  's-ebeling-a': { slug: 'adolf-ebeling' },
}

/** Atlas für die 3D-Aufstellung: oben Farbe, unten Alpha; Zellen zeilenweise. */
export const WALKOUT_ATLAS = {
  src: '/players/walkout/atlas.mp4?v=muv5a9yx',
  cols: 1,
  rows: 1,
  width: 160,
  height: 640,
  frames: 130,
  /** Player-/Staff-id → Zellindex (nur bestätigte). */
  cells: {
    'p-warkehr-i': 0,
  } as Record<string, number>,
}

export function walkoutSources(id: string): { mp4: string; webm: string; mov: string; poster: string } | null {
  const a = WALKOUT[id]
  if (!a) return null
  const b = WALKOUT_BASE + a.slug
  const v = '?v=' + WALKOUT_VERSION
  return { mp4: b + '.mp4' + v, webm: b + '.webm' + v, mov: b + '.mov' + v, poster: b + '.webp' + v }
}
