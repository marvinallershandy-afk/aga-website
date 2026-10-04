// ─────────────────────────────────────────────────────────────
// v14-D „Startelf-Flyover": gemeinsame Aufstellungs-Geometrie und
// Fokus-Dramaturgie der Mannschafts-Station.
//
// Bewusst OHNE three-Import: Kamera (CameraPath/CameraRig), 3D-Karten
// (PlayerCards3D) UND der DOM-Text der Sektion (PlayerCardGrid) lesen
// dieselben Zahlen. Der DOM-Pfad bleibt damit three-frei.
//
// Weltkoordinaten (Kompass wie Scene.tsx): +x Ost, +z Süd. Das eigene
// Tor liegt im Westen (x = −5.25), gespielt wird nach Osten. Die Elf
// steht wie beim Anstoß in der eigenen Hälfte (x ∈ [−5.25, 0]).
// ─────────────────────────────────────────────────────────────

import { LINEUP, FORMATION_SLOTS, PLAYERS, STAFF, type Player, type Staff, type Slot } from '../data/content'

const HALF_LEN = 5.25 // halbe Platzlänge (PITCH.width / 2)

/** Slot (x −1…1 aus Sicht des eigenen Tores, y 0 Torlinie … 1 Mittellinie)
 *  → Weltposition. Aus Sicht des eigenen Tores (Blick nach Osten) liegt
 *  „links" im Norden (−z). Der Torwart steht 0.6 vor der Torlinie, die
 *  Spitzen knapp einen Meter vor der Mittellinie. */
export function slotToWorld(slot: Slot): { x: number; z: number } {
  return { x: -HALF_LEN + 0.32 + slot.y * 4.75, z: slot.x * 2.7 }
}

export interface TeamCard {
  kind: 'start' | 'bank' | 'staff'
  player?: Player
  staff?: Staff
  role: Slot['role'] | 'STAB'
  x: number
  z: number
  /** Kartenbreite in Welt-Einheiten (Höhe ergibt sich aus dem Kartenformat). */
  w: number
  /** Reveal-Staffel 0 (Sturm) … 4 (Bank/Stab). */
  line: number
}

const byId = new Map(PLAYERS.map((p) => [p.id, p]))

/** Startelf in Slot-Reihenfolge — unbekannte ids fallen still heraus. */
export const STARTELF: { player: Player; slot: Slot }[] = (() => {
  const slots = FORMATION_SLOTS[LINEUP.formation] ?? FORMATION_SLOTS['4-4-2']
  const out: { player: Player; slot: Slot }[] = []
  LINEUP.startelf.forEach((id, i) => {
    const p = byId.get(id)
    const slot = slots[i]
    if (p && slot) out.push({ player: p, slot })
  })
  return out
})()

export const BANK: Player[] = LINEUP.bank.map((id) => byId.get(id)).filter((p): p is Player => !!p)
/** Trainerstab an der Seitenlinie: nur echte Namen (Platzhalter bleiben im DOM). */
export const STAB: Staff[] = STAFF.filter((m) => !m.isPlaceholder)

export const FORMATION_LABEL = LINEUP.formation
export const MATCH_LABEL = LINEUP.matchLabel ?? null

// Kartenmaße (Breite in Welt-Einheiten). Startelf groß, Bank/Stab kleiner.
export const START_W = 0.9
export const BANK_W = 0.5
export const STAB_W = 0.56

// Coaching-Zone: Südseitenlinie (z = +3.4) bis zur Reling (z ≈ 3.95).
// Die Bank steht zwischen Linie und Reling, der Stab daneben Richtung
// Mittellinie — so wie an einem echten Spieltag.
const BENCH_Z = 3.7
const BENCH_X0 = -3.1
const BENCH_STEP = 0.54
const STAB_STEP = 0.64

const ROW_LINE: Record<Slot['role'], number> = { ANG: 0, MIT: 1, ABW: 2, TW: 3 }

export const TEAM_CARDS: TeamCard[] = (() => {
  const cards: TeamCard[] = STARTELF.map(({ player, slot }) => {
    const w = slotToWorld(slot)
    return { kind: 'start' as const, player, role: slot.role, x: w.x, z: w.z, w: START_W, line: ROW_LINE[slot.role] }
  })
  BANK.forEach((p, i) => {
    cards.push({ kind: 'bank', player: p, role: p.position, x: BENCH_X0 + i * BENCH_STEP, z: BENCH_Z, w: BANK_W, line: 4 })
  })
  const stabX0 = BENCH_X0 + BANK.length * BENCH_STEP + 0.3
  STAB.forEach((m, i) => {
    cards.push({ kind: 'staff', staff: m, role: 'STAB', x: stabX0 + i * STAB_STEP, z: BENCH_Z, w: STAB_W, line: 4 })
  })
  return cards
})()

/** Schwerpunkt der Startelf (für den gemeinsamen Team-Yaw der Karten). */
export const TEAM_CENTER = (() => {
  const s = TEAM_CARDS.filter((c) => c.kind === 'start')
  const n = Math.max(1, s.length)
  return { x: s.reduce((a, c) => a + c.x, 0) / n, z: s.reduce((a, c) => a + c.z, 0) / n }
})()

// ─── Fokus-Reihenfolge ───────────────────────────────────────
// Die Kamera fliegt vom Sturm zum Torwart. Der Fokus wandert als
// „Schlange" durch die Reihen (Sturm rechts→links aus Kamerasicht,
// Mittelfeld zurück, Abwehr wieder hin, dann der Torwart), damit der
// Blick nie quer über das ganze Feld springen muss.
export const FOCUS_ORDER: number[] = (() => {
  const rows: Slot['role'][] = ['ANG', 'MIT', 'ABW', 'TW']
  const out: number[] = []
  rows.forEach((role, r) => {
    const idx = TEAM_CARDS.map((c, i) => ({ c, i })).filter(({ c }) => c.kind === 'start' && c.role === role)
    // Kamera blickt nach Westen: Bildschirm-links = Süden (+z).
    idx.sort((a, b) => (r % 2 === 0 ? b.c.z - a.c.z : a.c.z - b.c.z))
    idx.forEach(({ i }) => out.push(i))
  })
  return out
})()

// Zeitplan der Fahrt (s = Fortschritt durch die Sektion, 0…1).
// Vor FOCUS_S0: Establishing-Shot hinter den Spitzen. Nach FOCUS_S1:
// Totale hinter dem eigenen Tor mit Bank und Trainerstab.
export const FOCUS_S0 = 0.07
export const FOCUS_S1 = 0.84

/** Fokus-Lage bei s: Index in FOCUS_ORDER (kontinuierlich) oder −1. */
export function focusPos(s: number): number {
  const n = FOCUS_ORDER.length
  if (n === 0 || s < FOCUS_S0 || s > FOCUS_S1 + 0.04) return -1
  const k = (s - FOCUS_S0) / (FOCUS_S1 - FOCUS_S0)
  return Math.min(n - 1, Math.max(0, k * n - 0.5))
}

/** Index in TEAM_CARDS der aktuellen Fokus-Karte oder −1. */
export function focusCardAt(s: number): number {
  const f = focusPos(s)
  if (f < 0) return -1
  return FOCUS_ORDER[Math.round(f)]
}

/** Phase der Sektion für den DOM-Text: Intro, Fokus oder Totale. */
export function teamPhaseAt(s: number): 'intro' | 'focus' | 'outro' {
  if (s < FOCUS_S0) return 'intro'
  if (s > FOCUS_S1 + 0.04) return 'outro'
  return 'focus'
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Blickpunkt auf der Fokus-Karte (Weltkoordinaten) — mit Plateaus pro
 *  Karte: der Blick ruht kurz auf jedem Spieler und gleitet dann weiter.
 *  Schreibt in out und gibt das Fokus-Gewicht 0…1 zurück. */
export function focusLookAt(s: number, out: { x: number; y: number; z: number }): number {
  const n = FOCUS_ORDER.length
  if (n === 0) return 0
  const k = (s - FOCUS_S0) / (FOCUS_S1 - FOCUS_S0)
  const f = Math.min(n - 1, Math.max(0, k * n - 0.5))
  const i0 = Math.floor(f)
  const i1 = Math.min(n - 1, i0 + 1)
  const e = smooth(0.35, 0.65, f - i0)
  const a = TEAM_CARDS[FOCUS_ORDER[i0]]
  const b = TEAM_CARDS[FOCUS_ORDER[i1]]
  out.x = a.x + (b.x - a.x) * e
  out.z = a.z + (b.z - a.z) * e
  out.y = 0.62
  // Ein-/Ausblenden des Fokus-Blicks an den Rändern der Fokus-Phase
  return smooth(FOCUS_S0 - 0.04, FOCUS_S0 + 0.05, s) * (1 - smooth(FOCUS_S1 - 0.02, FOCUS_S1 + 0.08, s))
}

// ─── Geteilter Fahrt-Zustand der Station (pro Frame vom CameraRig) ──
/** s: Fortschritt durch die Mannschafts-Fahrt 0…1 (gedämpft),
 *  w: Präsenz der Station 0…1 (0 weit weg, 1 in der Sektion). */
export const teamState = { s: 0, w: 0 }
