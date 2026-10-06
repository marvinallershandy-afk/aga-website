// ─────────────────────────────────────────────────────────────
// v21-UX (Befund 1): Tipp-Stand für die Startseite (Karte) — OHNE supabase-js.
// Gleiches Muster wie src/album/fanStand.ts: die Startseite lädt bewusst kein
// Supabase-Bundle. /tippen schreibt beim Laden der Lage einen kompakten Stand
// in den Speicher; die Karten-Kachel liest ihn nur. Das nächste Spiel
// (Countdown) kommt aus den Build-Daten (src/data/content → nextKickoff()).
// ─────────────────────────────────────────────────────────────

export const TIPP_STAND_KEY = 'sva-tipp-stand'

export interface TippStand {
  /** Konto, zu dem der Stand gehört (Abgleich mit der Album-Sitzung, optional). */
  uid?: string
  /** ISO-Anpfiff des aktuell offenen Spiels (zum Abgleich mit dem Build-Spielplan). */
  offenAnstoss?: string
  /** Hat der Fan für das offene Spiel schon getippt? */
  getippt: boolean
  /** Zuletzt gewertete Punkte (für „+X Punkte“), noch frisch. */
  letztePunkte?: number
  /** ISO-Anpfiff des gewerteten Spiels (Frische-Prüfung). */
  letzteAnstoss?: string
  at: number
}

function lies<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key)
    return s ? (JSON.parse(s) as T) : null
  } catch {
    return null
  }
}

export function tippStandLesen(): TippStand | null {
  return lies<TippStand>(TIPP_STAND_KEY)
}

export function tippStandSchreiben(s: TippStand) {
  try {
    localStorage.setItem(TIPP_STAND_KEY, JSON.stringify(s))
  } catch {
    /* privat-Modus */
  }
}

export function tippStandVergessen() {
  try {
    localStorage.removeItem(TIPP_STAND_KEY)
  } catch {
    /* egal */
  }
}
