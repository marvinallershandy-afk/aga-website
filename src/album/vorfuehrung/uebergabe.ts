// ─────────────────────────────────────────────────────────────
// v24-P Vorführung: Übergabe von Packs zwischen /tippen?vorfuehrung=1 und
// /album?vorfuehrung=1. Beide Seiten sind eigene Seiten (eigene Bundles) —
// ohne Übergabe war das Tipp-Pack nach dem Seitenwechsel weg. Gespeichert
// wird nur im sessionStorage dieses Tabs (kein Netz, keine Datenbank).
// Die Tipp-Vorführung legt Packs hier ab, die Album-Vorführung übernimmt sie
// in ihren Stand und vermerkt „geöffnet“.
// ─────────────────────────────────────────────────────────────
import type { PackTyp } from '../packTypen'

export const UEBERGABE_KEY = 'sva-vf-packs'

export interface UebergabePack {
  id: string
  art: string
  typ: PackTyp
  titel: string
  karten: number
  gegner?: string
  geoeffnet?: boolean
  at: string
}

export function uebergabeLesen(): UebergabePack[] {
  try {
    const l = JSON.parse(sessionStorage.getItem(UEBERGABE_KEY) ?? '[]')
    return Array.isArray(l) ? l : []
  } catch {
    return []
  }
}

function schreiben(l: UebergabePack[]) {
  try {
    sessionStorage.setItem(UEBERGABE_KEY, JSON.stringify(l.slice(-40)))
  } catch {
    /* privat-Modus: Vorführung läuft trotzdem, nur ohne Übergabe */
  }
}

/** Pack übergeben (idempotent je id). */
export function uebergeben(p: Omit<UebergabePack, 'at'>): UebergabePack {
  const l = uebergabeLesen()
  const da = l.find((x) => x.id === p.id)
  if (da) return da
  const neu = { ...p, at: new Date().toISOString() }
  schreiben([...l, neu])
  return neu
}

export function uebergabeGeoeffnet(id: string) {
  schreiben(uebergabeLesen().map((x) => (x.id === id ? { ...x, geoeffnet: true } : x)))
}

export function uebergabeLeeren() {
  try {
    sessionStorage.removeItem(UEBERGABE_KEY)
  } catch {
    /* egal */
  }
}
