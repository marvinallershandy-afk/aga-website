// ─────────────────────────────────────────────────────────────
// GENERIERT von scripts/greenscreen/build.mjs — nicht von Hand pflegen.
// v17-G: Greenscreen-Assets je Player-/Staff-id (nur bestätigte Zuordnungen).
// Nutzung NICHT direkt, sondern über src/data/playerMedia.ts (playerMedia(id)).
// Doku: docs/GREENSCREEN.md
// ─────────────────────────────────────────────────────────────

export interface GreenscreenAsset {
  slug: string
  /** card.webp — Foto-Freisteller 800×1200 (Kartenkonvention wie /players/cutout) */
  card?: boolean
  /** pose-loop.{webm,mov,mp4,webp} — Take 2 als nahtlose Schleife */
  loop?: boolean
  /** walkout.* — Take 3 (Aufstellungs-Reveal) */
  walkout?: boolean
  /** jubel.* — Take 4, 1080×1920 (Tor-Videos) */
  jubel?: boolean
  /** zeigen.* — Take 5 (Man of the Match) */
  zeigen?: boolean
  /** seite.webp — Take 7 Standbild */
  seite?: boolean
  /** ball.webp — Take 6 Standbild */
  ball?: boolean
}

export const GREENSCREEN_VERSION = 'muv8w5rg'
export const GREENSCREEN_BASE = '/players/gs/'
/** Video-Geometrie (pose-loop, walkout, zeigen, seite): gleich WALKOUT_SIZE-Konvention, doppelte Auflösung. */
export const GREENSCREEN_SIZE = { w: 720, h: 1440, headY: 0.05, feetY: 0.96 } as const

export const GREENSCREEN: Record<string, GreenscreenAsset> = {

}
