// ─────────────────────────────────────────────────────────────
// v18-R „Rundgang mit Sinn": die Haltepunkte des Scroll-Rundgangs in
// Geh-Reihenfolge über das Gelände (Doku: docs/RUNDGANG.md).
//
//   Karten-Totale (= Startseite, nahtlos) → Sinkflug über die Südseite
//   hinter den Torwart → Startelf Spieler für Spieler
//   (Torwart im Westen → Abwehr → Mittelfeld → Sturm) → Totale hinter dem
//   eigenen Tor → Südseite: Bande → Südost: Fanblock → Ost: Anzeigetafel
//   am Vereinsheim → Nordost: vor die Tür, rein in den Partyraum, wieder
//   raus vor die Tür → aufsteigen in die Anfahrts-Karte.
//
// Bewusst OHNE three-Import: useScrollProgress (DOM-Pfad) misst hiermit
// die Scroll-Anker, die Kamera (tourRoute.ts) kennt dieselben Ids.
// ─────────────────────────────────────────────────────────────

import { STARTELF } from './teamLayout'

/** Reihenfolge der Startelf auf dem Rundgang: Torwart, dann Reihe für Reihe
 *  nach vorn, innerhalb der Reihe als „Schlange" (kein Querspringen). */
export const TEAM_ORDER: number[] = (() => {
  const rows: ('TW' | 'ABW' | 'MIT' | 'ANG')[] = ['TW', 'ABW', 'MIT', 'ANG']
  const out: number[] = []
  rows.forEach((role, r) => {
    const idx = STARTELF.map((e, i) => ({ e, i })).filter(({ e }) => e.slot.role === role)
    // gerade Reihen Nord→Süd, ungerade Süd→Nord (slot.x: −1 Nord … 1 Süd)
    idx.sort((a, b) => (r % 2 === 1 ? a.e.slot.x - b.e.slot.x : b.e.slot.x - a.e.slot.x))
    idx.forEach(({ i }) => out.push(i))
  })
  return out
})()

export const TEAM_N = TEAM_ORDER.length

export type StopId = string

/** Alle Haltepunkte in Fahrt-Reihenfolge. */
export const STOP_IDS: StopId[] = [
  'karte',
  ...TEAM_ORDER.map((_, k) => `team-${k}`),
  'team-totale',
  'sponsoren',
  'fanblock',
  'tabelle',
  'musik-tuer',
  'musik-raum',
  'musik-raum-ende',
  'musik-raus',
  'kontakt',
]
export const STOP_COUNT = STOP_IDS.length
export const STOP_INDEX: Record<StopId, number> = Object.fromEntries(STOP_IDS.map((id, i) => [id, i]))
export const TEAM_FIRST = STOP_INDEX['team-0']
export const TEAM_TOTALE = STOP_INDEX['team-totale']

/** Welt-Parameter u je Halt (Flutlicht, Karten, Fan-Feuer, Karten-Fade
 *  lesen u). Entlang der Route monoton → Effekte blenden in Gehrichtung. */
export function stopWorldU(id: StopId): number {
  // Karte: wie die Karten-Totale (mapCamera.U_OVERVIEW) — Flutlicht an,
  // der Anstoß-Beat ist vorbei; ab hier steigt u nur noch.
  if (id === 'karte') return 0.185
  if (id.startsWith('team-')) return 2 / 7
  if (id === 'sponsoren') return 0.34
  if (id === 'fanblock') return 3 / 7
  if (id === 'tabelle') return 0.62
  if (id.startsWith('musik-')) return 0.7
  return 1
}

// Höhe des Spieler-Abschnitts: pro Spieler so viel Scroll-Weg (in vh).
export const TEAM_STEP_VH = 0.3
/** Musik-Sektion: Höhe in vh und Lage der Party-Halte relativ zur Mitte. */
export const MUSIK_VH = 2.6
const MUSIK_HOLD = 0.3 // ± um die Mitte: ankommen/verweilen im Raum
const MUSIK_RIDE = 0.8 // Scroll-Weg Tür → Raum (und zurück)

/** Scroll-Anker (scrollY in px) aller Halte aus dem DOM. */
export function measureStopAnchors(): { y: number[]; max: number } | null {
  const doc = document.documentElement
  const vh = window.innerHeight
  const max = doc.scrollHeight - vh
  if (max <= 0) return null
  const el = (id: string) => document.getElementById(id)
  const center = (e: HTMLElement) => e.offsetTop + e.offsetHeight / 2 - vh / 2
  const rest = (id: string) => {
    const e = el(id)
    if (!e) return 0
    return e.classList.contains('section--snap-start') ? e.offsetTop : center(e)
  }
  const y: number[] = new Array(STOP_COUNT).fill(0)
  // Karte = Scroll 0 (die Kamera steht dort, wo die Startseite stand)
  y[0] = 0
  const team = el('mannschaft')
  const tTop = team ? team.offsetTop : vh
  const tLen = team && team.classList.contains('section--team-fly') ? Math.max(0, team.offsetHeight - vh) : 0
  for (let k = 0; k <= TEAM_N; k++) y[TEAM_FIRST + k] = tTop + (tLen * k) / Math.max(1, TEAM_N)
  y[STOP_INDEX.sponsoren] = rest('sponsoren')
  y[STOP_INDEX.fanblock] = rest('fanblock')
  y[STOP_INDEX.tabelle] = rest('tabelle')
  const m = el('musik')
  const mc = m ? center(m) : y[STOP_INDEX.tabelle] + vh
  y[STOP_INDEX['musik-raum']] = mc - MUSIK_HOLD * vh
  y[STOP_INDEX['musik-raum-ende']] = mc + MUSIK_HOLD * vh
  y[STOP_INDEX['musik-tuer']] = mc - (MUSIK_HOLD + MUSIK_RIDE) * vh
  y[STOP_INDEX['musik-raus']] = mc + (MUSIK_HOLD + MUSIK_RIDE) * vh
  // Finale: Ankunft, sobald die Mitmachen-Sektion oben ankommt (danach
  // liest man in Ruhe weiter — die Kamera steht in der Anfahrts-Karte)
  const k = el('kontakt')
  y[STOP_COUNT - 1] = k ? Math.min(max, k.offsetTop) : max
  // monoton + im Dokument
  for (let i = 0; i < STOP_COUNT; i++) {
    y[i] = Math.min(max, Math.max(0, y[i]))
    if (i > 0 && y[i] < y[i - 1] + 1) y[i] = Math.min(max, y[i - 1] + 1)
  }
  return { y, max }
}
