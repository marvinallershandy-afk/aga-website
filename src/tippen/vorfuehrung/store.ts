// ─────────────────────────────────────────────────────────────
// v21-T Vorführung: Zustand der Simulation (nur im Speicher dieses Tabs).
// Phasen: vor (Countdown, Tipp abgeben) → live (Spiel läuft, Minute tickt)
// → abpfiff (Auflösung) → montag (MOTM, Spieltagssieger, Fans vs. Kabine).
// Nichts davon wird gespeichert oder verschickt.
// ─────────────────────────────────────────────────────────────
import type { MeineElf, MeinTipp } from '../api'

export type Phase = 'vor' | 'live' | 'abpfiff' | 'montag'
export const PHASEN: { id: Phase; label: string; kurz: string }[] = [
  { id: 'vor', label: 'Vor Anpfiff', kurz: 'Vorher' },
  { id: 'live', label: 'Live', kurz: 'Live' },
  { id: 'abpfiff', label: 'Abpfiff', kurz: 'Abpfiff' },
  { id: 'montag', label: 'Montag', kurz: 'Montag' },
]

/** Letzte Spielminute der Simulation (90 + 3 Nachspielzeit). */
export const ENDE_MINUTE = 93

export interface SimZustand {
  phase: Phase
  /** Spielminute (Kommazahl, live) */
  minute: number
  laeuft: boolean
  tempo: 1 | 3
  /** Startzeit der Vorführung (Countdown bis Anpfiff relativ dazu) */
  t0: number
  /** Tipp/Elf, die der Zuschauer in der Vorführung abgegeben hat */
  meinTipp?: MeinTipp
  meineElf?: MeineElf
  /** in der Vorführung gegründete Ligen */
  ligen: { id: string; name: string; code: string }[]
  /** zählt jeden Phasenwechsel (Ansichten neu aufbauen) */
  runde: number
}

function startPhase(): Phase {
  try {
    const p = new URLSearchParams(window.location.search).get('phase')
    if (p === 'vor' || p === 'live' || p === 'abpfiff' || p === 'montag') return p
  } catch {
    /* egal */
  }
  return 'vor'
}

function startMinute(): number {
  try {
    const m = Number(new URLSearchParams(window.location.search).get('minute'))
    if (Number.isFinite(m) && m > 0) return Math.min(ENDE_MINUTE, m)
  } catch {
    /* egal */
  }
  return 0
}

let z: SimZustand = {
  phase: startPhase(),
  minute: startMinute(),
  laeuft: false,
  tempo: 1,
  t0: Date.now(),
  ligen: [],
  runde: 0,
}
if (z.phase === 'live') z.laeuft = z.minute < ENDE_MINUTE && !new URLSearchParams(window.location.search).has('minute')

const hoerer = new Set<() => void>()
export const simLesen = () => z
export function simAbo(f: () => void) {
  hoerer.add(f)
  return () => {
    hoerer.delete(f)
  }
}
function melden() {
  hoerer.forEach((f) => f())
}

export function simSetzen(teil: Partial<SimZustand>) {
  z = { ...z, ...teil }
  melden()
}

export function phaseSetzen(p: Phase) {
  const teil: Partial<SimZustand> = { phase: p, runde: z.runde + 1 }
  if (p === 'live') {
    teil.minute = z.phase === 'live' ? z.minute : 0
    teil.laeuft = true
  } else {
    teil.laeuft = false
    if (p === 'vor') teil.minute = 0
    else teil.minute = ENDE_MINUTE
  }
  try {
    const u = new URL(window.location.href)
    u.searchParams.set('phase', p)
    u.searchParams.delete('minute')
    window.history.replaceState(null, '', u.pathname + u.search + u.hash)
  } catch {
    /* egal */
  }
  simSetzen(teil)
}

// ── Uhr: 1 Spielminute je Sekunde (×3 schnell) ───────────────
let letzte = 0
let tick = 0
function ticken(t: number) {
  tick = 0
  if (!z.laeuft || z.phase !== 'live') return
  const dt = letzte ? Math.min(0.25, (t - letzte) / 1000) : 0
  letzte = t
  const neu = Math.min(ENDE_MINUTE, z.minute + dt * z.tempo)
  const ganz = Math.floor(neu) !== Math.floor(z.minute)
  z = { ...z, minute: neu }
  if (neu >= ENDE_MINUTE) {
    z = { ...z, laeuft: false }
    melden()
    // kurz „Abpfiff“ stehen lassen, dann zur Auflösung
    window.setTimeout(() => {
      if (simLesen().phase === 'live' && simLesen().minute >= ENDE_MINUTE) phaseSetzen('abpfiff')
    }, 2600)
    return
  }
  tick = requestAnimationFrame(ticken)
  if (ganz) melden()
}
simAbo(() => {
  if (z.laeuft && z.phase === 'live' && !tick) {
    letzte = 0
    tick = requestAnimationFrame(ticken)
  }
})
if (z.laeuft) {
  tick = requestAnimationFrame(ticken)
}

/** Sprung zum nächsten Ereignis (Minuten der Simulation). */
export function naechstesEreignis(minuten: number[]) {
  const n = minuten.find((m) => m > z.minute + 0.01)
  if (n == null) return phaseSetzen('abpfiff')
  simSetzen({ minute: n, laeuft: z.laeuft })
}
