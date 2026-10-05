// ─────────────────────────────────────────────────────────────
// v17-G: Datenmodell + Geometrie der TV-Aufstellung (/live) und des
// Story-Exports (1080×1920). Rein (kein React, kein DOM) → gleiche Regeln
// für Website, Admin-Export und Tests.
//
// Grundsatz: Es erscheinen IMMER 11 Positionen. Fehlt ein Spieler in den
// Daten (gelöscht, inaktiv, doppelt eingetragen, unstimmiger Wechsel), steht
// dort „N. N.“ statt einer Lücke.
// ─────────────────────────────────────────────────────────────
import { FORMATION_SLOTS, type Formation, type Slot } from '../../data/lineup'
import { playerMedia } from '../../data/playerMedia'
import { platzStand, minuteLabel, type LiveData, type LivePartner, type LivePlayer, type LiveStaff, type TickerTyp } from '../model'

export interface GrafikSpieler {
  id: string
  name: string
  vorname: string
  nachname: string
  number: number | null
  /** Brustbild-Quelle (Greenscreen-Karte → Freisteller → Foto) */
  bild: string | null
  /** Bild ist ein Freisteller (Alpha, Kartenkonvention) → Kopf darf aus dem Kreis ragen */
  freisteller: boolean
  kapitaen: boolean
}

export interface GrafikSlot {
  /** Prozent der Spielfeld-Box (Mittelpunkt des Brustbilds) */
  x: number
  y: number
  /** Größenfaktor (hinten kleiner) */
  k: number
  role: Slot['role']
  spieler: GrafikSpieler | null
  /** eingewechselt in Minute … */
  rein: string | null
  /** für wen (Nachname) */
  fuer: string | null
  tore: string[]
  karte: 'gelb' | 'rot' | null
}

export interface GrafikBank {
  spieler: GrafikSpieler
  /** ausgewechselt in Minute … */
  raus: string | null
}

export interface AufstellungGrafik {
  formation: Formation
  slots: GrafikSlot[]
  bank: GrafikBank[]
  trainer: { name: string; rolle: string }[]
  partner: LivePartner | null
  kopf: { titel: string; gegner: string | null; heim: boolean; zeile: string | null; stand: string | null }
  /** nur zur Info („zuletzt gespeicherte Elf“) */
  vorlaeufig: boolean
  /** Anzahl Platzhalter (fehlende Spieler) */
  luecken: number
}

export const ROLLE_LABEL: Record<string, string> = {
  trainer: 'Trainer',
  'co-trainer': 'Co-Trainer',
  'torwart-trainer': 'TW-Trainer',
  teammanager: 'Teammanager',
}

// ── Geometrie: Spielfeld in leichter Perspektive (eigenes Tor unten) ──
/** Breite der gegnerischen Torlinie relativ zur eigenen. */
export const FAR = 0.76
const K = 1 / FAR - 1
/** Spielfeld-Box: Torlinien bei y = TOP … BOTTOM (Prozent), halbe Breite vorn HALF. */
export const PITCH = { top: 0, bottom: 88, half: 48 }

/** Feldpunkt (u: −1 links … 1 rechts, v: 0 eigene … 1 gegnerische Torlinie) → Prozent der Box. */
export function proj(u: number, v: number): [number, number] {
  const s = 1 / (1 + K * v)
  return [50 + u * PITCH.half * s, PITCH.top + ((PITCH.bottom - PITCH.top) * (s - FAR)) / (1 - FAR)]
}

/** Lage eines Formations-Slots (Mittelpunkt des Brustbilds) + Größenfaktor. */
export function slotLage(slot: Slot): { x: number; y: number; k: number } {
  // Torwart vor dem eigenen Tor, Sturm etwa am gegnerischen Strafraum
  const v = slot.role === 'TW' ? 0.03 : 0.1 + slot.y * 0.78
  const u = Math.sign(slot.x) * Math.pow(Math.abs(slot.x), 0.9) * 0.98
  const [x, y] = proj(u, v)
  const s = 1 / (1 + K * v)
  return { x, y, k: 0.8 + 0.2 * ((s - FAR) / (1 - FAR)) }
}

export function splitName(name: string) {
  const t = name.trim().split(/\s+/)
  return { vorname: t.slice(0, -1).join(' '), nachname: t.slice(-1)[0] ?? name }
}

function alsGrafik(p: LivePlayer): GrafikSpieler {
  const m = playerMedia(p.id, p)
  const { vorname, nachname } = splitName(p.name)
  return { id: p.id, name: p.name, vorname, nachname, number: p.number ?? null, bild: m.bild, freisteller: m.cutout, kapitaen: !!p.isCaptain }
}

interface EreignisLike {
  id: string
  type: TickerTyp
  at: string
  player?: string | null
  player2?: string | null
  minute?: number | null
  extra?: number | null
}

export interface GrafikEingabe {
  formation: string
  /** Slot-Reihenfolge = FORMATION_SLOTS[formation]; null/'' = unbesetzt */
  startelf: (string | null)[]
  bank: string[]
  players: Map<string, LivePlayer>
  events: EreignisLike[]
  staff: LiveStaff[]
  partner?: LivePartner | null
  match?: { opponent: string; home: boolean; kickoff: string; competition?: string; matchday?: number; status?: string; goalsFor?: number; goalsAgainst?: number } | null
  forMatch?: boolean
}

export function baueAufstellung(e: GrafikEingabe): AufstellungGrafik {
  const formation = (e.formation in FORMATION_SLOTS ? e.formation : '4-4-2') as Formation
  const slots = FORMATION_SLOTS[formation]
  const elf = Array.from({ length: 11 }, (_, i) => e.startelf[i] || '')
  const stand = platzStand({ startelf: elf, bank: e.bank }, e.events)
  const nachnameVon = (id: string) => {
    const p = e.players.get(id)
    return p ? splitName(p.name).nachname : null
  }
  // Wer wurde für wen eingewechselt (für die Anzeige „für Kalwa“)
  const fuer = new Map<string, string>()
  for (const ev of e.events) if (ev.type === 'wechsel' && ev.player && ev.player2 && stand.eingewechselt.has(ev.player)) fuer.set(ev.player, ev.player2)

  let luecken = 0
  const gSlots: GrafikSlot[] = slots.map((slot, i) => {
    const id = stand.slots[i] ?? ''
    const p = id ? e.players.get(id) : undefined
    if (!p) luecken++
    const rot = id && stand.rot.has(id)
    return {
      ...slotLage(slot),
      role: slot.role,
      spieler: p ? alsGrafik(p) : null,
      rein: id ? stand.eingewechselt.get(id) ?? null : null,
      fuer: id && fuer.has(id) ? nachnameVon(fuer.get(id)!) : null,
      tore: id ? stand.torMinuten.get(id) ?? [] : [],
      karte: rot ? 'rot' : id && stand.gelb.has(id) ? 'gelb' : null,
    }
  })
  const bank: GrafikBank[] = []
  for (const id of stand.bank) {
    const p = e.players.get(id)
    if (p) bank.push({ spieler: alsGrafik(p), raus: null })
  }
  for (const [id, min] of stand.ausgewechselt) {
    const p = e.players.get(id)
    if (p) bank.push({ spieler: alsGrafik(p), raus: min })
  }

  const m = e.match ?? null
  let zeile: string | null = null
  let standTxt: string | null = null
  if (m) {
    const d = new Date(m.kickoff)
    const datum = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' })
    const zeit = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
    zeile = [m.competition, m.matchday ? `${m.matchday}. Spieltag` : null, `${datum} · ${zeit} Uhr`].filter(Boolean).join(' · ')
    if (m.status && m.status !== 'geplant' && m.goalsFor != null && m.goalsAgainst != null) {
      standTxt = m.home ? `${m.goalsFor}:${m.goalsAgainst}` : `${m.goalsAgainst}:${m.goalsFor}`
    }
  }
  return {
    formation,
    slots: gSlots,
    bank,
    trainer: e.staff.filter((s) => s.role !== 'teammanager').map((s) => ({ name: s.name, rolle: ROLLE_LABEL[s.role] ?? s.role })),
    partner: e.partner ?? null,
    kopf: { titel: m ? 'Aufstellung' : 'Unsere Elf', gegner: m?.opponent ?? null, heim: m?.home ?? true, zeile, stand: standTxt },
    vorlaeufig: e.forMatch === false,
    luecken,
  }
}

/** Aus der Antwort von web_live() (Live-Seite). */
export function ausLiveDaten(d: LiveData): AufstellungGrafik | null {
  const l = d.lineup
  if (!l || !l.startelf.length) return null
  return baueAufstellung({
    formation: l.formation,
    startelf: l.startelf,
    bank: l.bank,
    players: new Map(d.players.map((p) => [p.id, p])),
    events: d.events,
    staff: d.staff,
    partner: d.partner ?? null,
    match: d.match,
    forMatch: l.forMatch,
  })
}

/** Schriftgröße (in Einheiten der Brustbild-Breite) für Nummer + Nachname einzeilig. */
export function plattenSchrift(nachname: string, mitNummer: boolean): number {
  return Math.min(0.24, 1.32 / Math.max(4, nachname.length * 0.5 + (mitNummer ? 1.4 : 0)))
}

export { minuteLabel }
