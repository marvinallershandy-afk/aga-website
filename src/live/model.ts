// ─────────────────────────────────────────────────────────────
// v15-L „Spieltag-Modus": gemeinsames Modell des Livetickers.
//
// Bewusst OHNE React, three.js oder Supabase-SDK — genutzt von
//   · der öffentlichen Live-Seite /live (eigenes schlankes Bundle),
//   · der Spieltag-Leiste im Onepager (nur im Spieltagsfenster),
//   · dem Admin „Live" (gleiche Regeln für Minute, Spielstand, Wechsel).
// Vertrag = Rückgabe der RPC web_live() (Migration 20261005100000).
// ─────────────────────────────────────────────────────────────

export type LiveStatus = 'geplant' | 'live' | 'halbzeit' | 'beendet'

export const TICKER_TYPEN = [
  'anpfiff', 'tor', 'gegentor', 'gelb', 'gelbrot', 'rot', 'wechsel',
  'halbzeit', 'wiederanpfiff', 'abpfiff', 'elfmeter', 'kommentar',
] as const
export type TickerTyp = (typeof TICKER_TYPEN)[number]

export const STATUS_TYPEN: TickerTyp[] = ['anpfiff', 'halbzeit', 'wiederanpfiff', 'abpfiff']

export interface LivePlayer {
  id: string
  name: string
  number?: number | null
  position?: 'TW' | 'ABW' | 'MIT' | 'ANG'
  photoUrl?: string | null
  cutoutUrl?: string | null
  isCaptain?: boolean
}

export interface LiveStaff {
  id: string
  name: string
  role: string
  photoUrl?: string | null
  cutoutUrl?: string | null
}

export interface LiveEvent {
  id: string
  type: TickerTyp
  minute?: number | null
  extra?: number | null
  /** tor: Torschütze · wechsel: kommt rein · Karten: Spieler (slug) */
  player?: string
  /** tor: Vorlage · wechsel: geht raus (slug) */
  player2?: string
  text?: string
  /** Zeitpunkt auf dem Gerät des Tickernden (ISO) */
  at: string
}

export interface LiveMatch {
  id: string
  opponent: string
  home: boolean
  kickoff: string
  venue?: string
  competition?: string
  matchday?: number
  status: LiveStatus
  half?: 1 | 2
  minute?: number
  anpfiffAt?: string
  wiederanpfiffAt?: string
  motm?: string
  goalsFor: number
  goalsAgainst: number
  updatedAt?: string
}

export interface LiveLineup {
  formation: '4-4-2' | '4-3-3' | '4-2-3-1' | '3-5-2'
  startelf: string[]
  bank: string[]
  /** true = ausdrücklich für dieses Spiel gespeichert */
  forMatch: boolean
  matchLabel?: string | null
  updatedAt?: string
}

export interface LiveSettings {
  address?: string
  fussballDeTeamId?: string
  widgetTabelle?: string
  widgetSpielplan?: string
  fupaUrl?: string
  instagram?: string
  saison?: string
}

export interface PreviousMatch {
  opponent: string
  home: boolean
  kickoff: string
  goalsFor: number
  goalsAgainst: number
}

export interface LiveData {
  version: number
  serverNow: string
  match: LiveMatch | null
  /** neueste zuerst */
  events: LiveEvent[]
  lineup: LiveLineup | null
  players: LivePlayer[]
  staff: LiveStaff[]
  previous: PreviousMatch | null
  settings: LiveSettings
}

// ── Spielminute ─────────────────────────────────────────────
export const HALBZEIT_MIN = 45

/** „67'" bzw. „45+2'" — minute = erfasste Minute, extra = Nachspielzeit. */
export function minuteLabel(minute: number | null | undefined, extra?: number | null): string {
  if (minute == null) return ''
  if (extra) return `${minute}+${extra}'`
  return `${minute}'`
}

/** Laufende Minute aus den Anpfiffzeiten (gleiche Regel wie web_live()).
 *  Über 45 bzw. 90 hinaus → Nachspielzeit („45+3'"). */
export function laufendeMinute(
  status: LiveStatus,
  anpfiffAt: string | null | undefined,
  wiederanpfiffAt: string | null | undefined,
  nowMs: number,
): { minute: number; extra: number; half: 1 | 2; label: string } | null {
  if (status === 'halbzeit') return { minute: HALBZEIT_MIN, extra: 0, half: 1, label: 'Halbzeit' }
  if (status !== 'live') return null
  const start = wiederanpfiffAt ?? anpfiffAt
  if (!start) return null
  const half: 1 | 2 = wiederanpfiffAt ? 2 : 1
  const lauf = Math.max(1, Math.floor((nowMs - new Date(start).getTime()) / 60000) + 1)
  const ende = HALBZEIT_MIN * half
  const roh = (half === 2 ? HALBZEIT_MIN : 0) + lauf
  if (roh > ende) return { minute: ende, extra: roh - ende, half, label: minuteLabel(ende, roh - ende) }
  return { minute: roh, extra: 0, half, label: minuteLabel(roh) }
}

// ── Ereignisse ──────────────────────────────────────────────
export const TYP_LABEL: Record<TickerTyp, string> = {
  anpfiff: 'Anpfiff',
  tor: 'Tor',
  gegentor: 'Gegentor',
  gelb: 'Gelbe Karte',
  gelbrot: 'Gelb-Rot',
  rot: 'Rote Karte',
  wechsel: 'Wechsel',
  halbzeit: 'Halbzeit',
  wiederanpfiff: 'Wiederanpfiff',
  abpfiff: 'Abpfiff',
  elfmeter: 'Elfmeter',
  kommentar: 'Kommentar',
}

/** Chronologisch (älteste zuerst) — Ticker kommen neueste zuerst. */
export function chronologisch<T extends { at: string; id: string }>(events: T[]): T[] {
  return [...events].sort((a, b) => +new Date(a.at) - +new Date(b.at) || a.id.localeCompare(b.id))
}

/** Spielstand nach jedem Tor-Ereignis (aus SVA-Sicht: [für, gegen]). */
export function spielstandVerlauf(events: { id: string; type: TickerTyp; at: string }[]): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>()
  let f = 0
  let g = 0
  for (const e of chronologisch(events)) {
    if (e.type === 'tor') f++
    else if (e.type === 'gegentor') g++
    else continue
    out.set(e.id, [f, g])
  }
  return out
}

/** Abgeleiteter Status aus den Status-Ereignissen (gleiche Regel wie der DB-Trigger). */
export function statusAusEreignissen(events: { type: TickerTyp; at: string; id: string }[]): {
  status: LiveStatus
  anpfiffAt: string | null
  wiederanpfiffAt: string | null
  hatStatus: boolean
} {
  const chrono = chronologisch(events)
  const st = chrono.filter((e) => STATUS_TYPEN.includes(e.type))
  const last = st[st.length - 1]?.type
  const anpfiff = chrono.find((e) => e.type === 'anpfiff')?.at ?? null
  const wieder = [...chrono].reverse().find((e) => e.type === 'wiederanpfiff')?.at ?? null
  const status: LiveStatus =
    last === 'anpfiff' || last === 'wiederanpfiff' ? 'live' : last === 'halbzeit' ? 'halbzeit' : last === 'abpfiff' ? 'beendet' : 'geplant'
  return { status, anpfiffAt: anpfiff, wiederanpfiffAt: wieder, hatStatus: !!last }
}

export function toreAusEreignissen(events: { type: TickerTyp }[]): [number, number] {
  let f = 0
  let g = 0
  for (const e of events) {
    if (e.type === 'tor') f++
    if (e.type === 'gegentor') g++
  }
  return [f, g]
}

/** Wer steht gerade auf dem Platz? Wechsel werden auf den Slot des
 *  ausgewechselten Spielers gelegt; Karten/Tore je Spieler gezählt. */
export interface PlatzStand {
  /** Slot-Reihenfolge wie lineup.startelf, Wechsel eingerechnet */
  slots: string[]
  eingewechselt: Map<string, string> // slug → Minuten-Label
  ausgewechselt: Map<string, string>
  gelb: Set<string>
  rot: Set<string>
  tore: Map<string, number>
  /** Bank ohne eingewechselte Spieler */
  bank: string[]
}

export function platzStand(
  lineup: { startelf: string[]; bank: string[] } | null,
  events: { id: string; type: TickerTyp; at: string; player?: string | null; player2?: string | null; minute?: number | null; extra?: number | null }[],
): PlatzStand {
  const slots = [...(lineup?.startelf ?? [])]
  const eingewechselt = new Map<string, string>()
  const ausgewechselt = new Map<string, string>()
  const gelb = new Set<string>()
  const rot = new Set<string>()
  const tore = new Map<string, number>()
  for (const e of chronologisch(events)) {
    const m = minuteLabel(e.minute, e.extra)
    if (e.type === 'wechsel' && e.player && e.player2) {
      const i = slots.indexOf(e.player2)
      if (i >= 0) slots[i] = e.player
      eingewechselt.set(e.player, m)
      ausgewechselt.set(e.player2, m)
    } else if (e.type === 'gelb' && e.player) gelb.add(e.player)
    else if ((e.type === 'rot' || e.type === 'gelbrot') && e.player) rot.add(e.player)
    else if (e.type === 'tor' && e.player) tore.set(e.player, (tore.get(e.player) ?? 0) + 1)
  }
  const bank = (lineup?.bank ?? []).filter((id) => !eingewechselt.has(id))
  return { slots, eingewechselt, ausgewechselt, gelb, rot, tore, bank }
}

// ── Paarung / Anzeige ───────────────────────────────────────
export const SVA_KURZ = 'SVA'
export const SVA_NAME = 'SV Agathenburg-Dollern'

/** Heim links, Gast rechts — Tore in Paarungs-Reihenfolge. */
export function paarung(m: Pick<LiveMatch, 'home' | 'opponent' | 'goalsFor' | 'goalsAgainst'>) {
  return m.home
    ? { heim: SVA_NAME, gast: m.opponent, toreHeim: m.goalsFor, toreGast: m.goalsAgainst, svaHeim: true }
    : { heim: m.opponent, gast: SVA_NAME, toreHeim: m.goalsAgainst, toreGast: m.goalsFor, svaHeim: false }
}

/** Spieltagsfenster der Onepager-Leiste: 48 h vor bis 3 h nach Anpfiff. */
export const FENSTER_VOR_MS = 48 * 3600_000
export const FENSTER_NACH_MS = 3 * 3600_000
export function imSpieltagsfenster(kickoffMs: number, nowMs: number): boolean {
  return nowMs >= kickoffMs - FENSTER_VOR_MS && nowMs <= kickoffMs + FENSTER_NACH_MS
}

/** Route zum Spielort (Heim: Vereinsadresse, Auswärts: Ort des Spiels). */
export function anfahrtUrl(ziel: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ziel)}`
}

/** fussball.de-Widget-ID aus ID oder eingefügtem Einbettungs-Code lesen. */
export function parseWidgetId(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  const m =
    s.match(/showWidget\(\s*['"][^'"]*['"]\s*,\s*['"]([A-Za-z0-9]{32})['"]/) ??
    s.match(/data-id=["']([A-Za-z0-9]{32})["']/) ??
    s.match(/schluessel\/([A-Za-z0-9]{32})/) ??
    s.match(/^([A-Za-z0-9]{32})$/)
  return m ? m[1].toUpperCase() : null
}
