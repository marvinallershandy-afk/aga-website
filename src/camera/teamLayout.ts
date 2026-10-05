// ─────────────────────────────────────────────────────────────
// v14-D „Startelf-Flyover": gemeinsame Aufstellungs-Geometrie der
// Mannschafts-Station (v15-P: ohne Fokus-Dramaturgie).
//
// Bewusst OHNE three-Import: Kamera (CameraPath/CameraRig), 3D-Karten
// (PlayerCards3D) UND der DOM-Text der Sektion (PlayerCardGrid) lesen
// dieselben Zahlen. Der DOM-Pfad bleibt damit three-frei.
//
// Weltkoordinaten (Kompass wie Scene.tsx): +x Ost, +z Süd. Das eigene
// Tor liegt im Westen (x = −5.25), gespielt wird nach Osten.
// v14-M „Ganzer Platz": Die Elf steht über die VOLLE Feldlänge in ihrer
// Formation (Sturm in der gegnerischen Hälfte, s. slotDepth), die Bank
// sitzt AUSSERHALB der Südseitenlinie auf Höhe der Mittellinie (Unterstand),
// der Trainerstab steht daneben in der Coaching-Zone. Aus Sicht der Totale
// hinter dem eigenen Tor (Blick nach Osten) ist Süden = rechts.
// ─────────────────────────────────────────────────────────────

import { LINEUP, FORMATION_SLOTS, PLAYERS, STAFF, slotDepth, type Player, type Staff, type Slot } from '../data/content'

const HALF_LEN = 5.25 // halbe Platzlänge (PITCH.width / 2)
const FULL_LEN = HALF_LEN * 2
const LANE_Z = 2.75 // Slot-x ±1 → knapp innerhalb der Seitenlinien (±3.4)

/** Slot → Weltposition über den ganzen Platz. Aus Sicht des eigenen Tores
 *  (Blick nach Osten) liegt „links" im Norden (−z). */
export function slotToWorld(slot: Slot): { x: number; z: number } {
  return { x: -HALF_LEN + slotDepth(slot) * FULL_LEN, z: slot.x * LANE_Z }
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
/** Blätter-Liste fürs Karten-Modal: Startelf (TW → Sturm), dann Bank. */
export const TEAM_PLAYERS: Player[] = [...STARTELF.map((e) => e.player), ...BANK]
/** Trainerstab an der Seitenlinie: nur echte Namen (Platzhalter bleiben im DOM). */
export const STAB: Staff[] = STAFF.filter((m) => !m.isPlaceholder)

export const FORMATION_LABEL = LINEUP.formation
export const MATCH_LABEL = LINEUP.matchLabel ?? null

// Kartenmaße (Breite in Welt-Einheiten). Startelf so groß, dass zwischen
// Nachbarn Luft bleibt (4er-Kette: ~0.5 Abstand), Bank/Stab deutlich kleiner.
export const START_W = 0.8
export const BANK_W = 0.34
export const STAB_W = 0.38

// Unterstand an der Südseitenlinie (z = +3.4) vor der Reling (z ≈ 3.95),
// mittig um die Mittellinie. Die Bank-Karten stehen VOR dem Unterstand
// (zwischen Linie und Dach), der Trainerstab daneben Richtung Osten.
const BENCH_STEP = 0.4
const STAB_STEP = 0.44
export const BENCH_Z = 3.6
export const DUGOUT = (() => {
  const n = Math.max(1, LINEUP.bank.length)
  const len = (n - 1) * BENCH_STEP + 0.6
  const x0 = -0.7 - len / 2 // Bank+Stab zusammen mittig um die Mittellinie
  return { x0, x1: x0 + len, z: 3.78, depth: 0.26, height: 0.34 }
})()

const ROW_LINE: Record<Slot['role'], number> = { ANG: 0, MIT: 1, ABW: 2, TW: 3 }

export const TEAM_CARDS: TeamCard[] = (() => {
  const pos = STARTELF.map(({ slot }) => slotToWorld(slot))
  const cards: TeamCard[] = STARTELF.map(({ player, slot }, i) => {
    const w = pos[i]
    // Hintere Reihen minimal größer → in der Totale bleiben auch die Namen
    // der Spitzen lesbar, die Perspektive (Torwart vorn groß) bleibt.
    let cw = START_W * (0.95 + 0.25 * slotDepth(slot))
    // Luft zum Nachbarn in derselben Reihe (z. B. Fünfer-Mittelfeld 3-5-2)
    pos.forEach((o, j) => {
      if (j !== i && Math.abs(o.x - w.x) < 0.7) cw = Math.min(cw, 0.74 * Math.abs(o.z - w.z))
    })
    return { kind: 'start' as const, player, role: slot.role, x: w.x, z: w.z, w: cw, line: ROW_LINE[slot.role] }
  })
  const bx0 = DUGOUT.x0 + 0.3
  BANK.forEach((p, i) => {
    cards.push({ kind: 'bank', player: p, role: p.position, x: bx0 + i * BENCH_STEP, z: BENCH_Z, w: BANK_W, line: 4 })
  })
  const stabX0 = DUGOUT.x1 + 0.35
  STAB.forEach((m, i) => {
    cards.push({ kind: 'staff', staff: m, role: 'STAB', x: stabX0 + i * STAB_STEP, z: BENCH_Z - 0.05, w: STAB_W, line: 4 })
  })
  return cards
})()

/** Schwerpunkt der Startelf (für den gemeinsamen Team-Yaw der Karten). */
export const TEAM_CENTER = (() => {
  const s = TEAM_CARDS.filter((c) => c.kind === 'start')
  const n = Math.max(1, s.length)
  return { x: s.reduce((a, c) => a + c.x, 0) / n, z: s.reduce((a, c) => a + c.z, 0) / n }
})()

// ─── Fahrt-Phasen ────────────────────────────────────────────
// v18-R „Spieler zu Spieler" (zurück, Marvin): die Kamera hält nacheinander
// an jeder Karte der Startelf (Reihenfolge: tourPlan.TEAM_ORDER), danach die
// Totale. teamState.s läuft 0 … 1 über die N Spieler-Halte + Totale
// (Halt k bei s = k/N, Totale bei s = 1).
/** Ab hier gilt die Fahrt als in der Totale angekommen. */
export const TEAM_TOTALE_S = (STARTELF.length - 0.5) / Math.max(1, STARTELF.length)

/** Phase der Sektion für den DOM-Text. */
export function teamPhaseAt(s: number): 'fahrt' | 'totale' {
  return s >= TEAM_TOTALE_S ? 'totale' : 'fahrt'
}

// ─── Geteilter Fahrt-Zustand der Station (pro Frame vom CameraRig) ──
/** s: Fortschritt durch die Mannschafts-Fahrt 0…1 (gedämpft),
 *  w: Präsenz der Station 0…1 (0 weit weg, 1 in der Sektion). */
export const teamState = { s: 0, w: 0 }

/** v18-R: Fokus der Spieler-Fahrt. k = Position in TEAM_ORDER (Bruchteil
 *  zwischen zwei Spielern), −1 = kein Fokus (Anflug/Totale/weg);
 *  card = Index in TEAM_CARDS der nächstgelegenen Fokus-Karte oder −1;
 *  w = Gewicht 0…1 (Karten drehen sich voll zur Kamera). */
export const teamFocus = { k: -1, card: -1, w: 0 }
