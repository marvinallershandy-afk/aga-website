// ─────────────────────────────────────────────────────────────
// v17-G: EINE Stelle, die entscheidet, welches Bild/Video ein Spieler bekommt.
//
//   playerMedia(id, fallback) → {
//     source:  'greenscreen' | 'walkout' | 'foto' | 'keins'
//     figure:  Freisteller mit Alpha für Karten (Kartenkonvention 2:3, Scheitel
//              ≈ 18,5 %, unten ≈ Hüfte): Greenscreen-card.webp → cutoutUrl → null
//     bild:    Brustbild/Avatar: figure → Foto (photoUrl) → null
//     cutout:  true, wenn bild ein Freisteller ist (Kopf darf aus dem Rahmen ragen)
//     loop:    lebende Karte (Video mit Alpha): Greenscreen-pose-loop →
//              Dolly-Walkout (src/data/walkout.ts) → null
//     loopSize: Geometrie des Loops (1:2, Scheitel/Sohle als Anteil der Höhe)
//     walkout/jubel/zeigen: Greenscreen-Takes 3/4/5 (nur Greenscreen)
//     seite/ball: Greenscreen-Standbilder Take 7/6
//   }
//
// Karten-Code (HoloCard, StaffCard, PlayerModal, storyShare, WalkoutVideo)
// und die Live-Aufstellung fragen nur noch hier — neue Asset-Quellen kommen
// ausschließlich in diese Datei. Doku: docs/GREENSCREEN.md („Schnittstelle“).
// ─────────────────────────────────────────────────────────────
import { GREENSCREEN, GREENSCREEN_BASE, GREENSCREEN_SIZE, GREENSCREEN_VERSION } from './greenscreen'
import { WALKOUT_ENABLED, WALKOUT_SIZE, walkoutSources } from './walkout'

export interface VideoSources {
  /** VP9 mit Alpha (Chrome/Firefox/Edge) */
  webm: string
  /** HEVC mit Alpha (Safari/iOS) */
  mov: string
  /** H.264 Stacked Alpha (oben Farbe, unten Alpha) — WebGL */
  mp4: string
  /** erstes Frame, WebP mit Alpha */
  poster: string
}

export interface MediaSize {
  w: number
  h: number
  headY: number
  feetY: number
}

export interface PlayerMedia {
  source: 'greenscreen' | 'walkout' | 'foto' | 'keins'
  figure: string | null
  bild: string | null
  cutout: boolean
  loop: VideoSources | null
  loopSize: MediaSize
  walkout: VideoSources | null
  jubel: VideoSources | null
  zeigen: VideoSources | null
  seite: string | null
  ball: string | null
}

interface Fallback {
  cutoutUrl?: string | null
  photoUrl?: string | null
}

const v = '?v=' + GREENSCREEN_VERSION
function gsVideo(slug: string, name: string): VideoSources {
  const b = `${GREENSCREEN_BASE}${slug}/${name}`
  return { webm: `${b}.webm${v}`, mov: `${b}.mov${v}`, mp4: `${b}.mp4${v}`, poster: `${b}.webp${v}` }
}

export function playerMedia(id: string, fallback?: Fallback | null): PlayerMedia {
  const gs = GREENSCREEN[id]
  // v17-D: Dolly-Walkouts sind aus (zu unscharf), bis Greenscreen-Loops da sind
  const walk = WALKOUT_ENABLED ? walkoutSources(id) : null
  const base = gs ? `${GREENSCREEN_BASE}${gs.slug}/` : ''
  const figure = gs?.card ? `${base}card.webp${v}` : fallback?.cutoutUrl ?? null
  const bild = figure ?? fallback?.photoUrl ?? null
  const loop = gs?.loop ? gsVideo(gs.slug, 'pose-loop') : walk
  return {
    source: gs ? 'greenscreen' : walk ? 'walkout' : bild ? 'foto' : 'keins',
    figure,
    bild,
    cutout: !!figure,
    loop,
    loopSize: gs?.loop ? GREENSCREEN_SIZE : WALKOUT_SIZE,
    walkout: gs?.walkout ? gsVideo(gs.slug, 'walkout') : null,
    jubel: gs?.jubel ? gsVideo(gs.slug, 'jubel') : null,
    zeigen: gs?.zeigen ? gsVideo(gs.slug, 'zeigen') : null,
    seite: gs?.seite ? `${base}seite.webp${v}` : null,
    ball: gs?.ball ? `${base}ball.webp${v}` : null,
  }
}
