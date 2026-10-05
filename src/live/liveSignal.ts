// v15-L: Mini-Signal „Live-Stand" im Onepager. Die Spieltag-Leiste schreibt
// (nur im Spieltagsfenster, nur nach Anpfiff), die LED-Tafel (Scoreboard.tsx)
// liest. Kein Store-Paket, kein Netz — reiner Modul-Zustand.
export interface LiveSignal {
  status: 'live' | 'halbzeit' | 'beendet'
  home: boolean
  opponent: string
  goalsFor: number
  goalsAgainst: number
  minuteLabel: string | null
}

let wert: LiveSignal | null = null
const hoerer = new Set<(v: LiveSignal | null) => void>()

export function setLiveSignal(v: LiveSignal | null) {
  if (JSON.stringify(v) === JSON.stringify(wert)) return
  wert = v
  hoerer.forEach((h) => h(v))
}
export function getLiveSignal() {
  return wert
}
export function onLiveSignal(h: (v: LiveSignal | null) => void) {
  hoerer.add(h)
  return () => {
    hoerer.delete(h)
  }
}
