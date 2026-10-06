// ─────────────────────────────────────────────────────────────
// v20-K: Gemeinsames Kartensystem — Datentyp einer Sammelkarte.
//
// EIN neutrales Format für alle Karten der Website: Album (/album),
// Spielerkarten (Galerie/Modal/3D-Rundgang), Story-Export, Tipp-Liga.
// Quellen werden über Adapter (adapter.ts) hierher abgebildet — die
// Darstellung (SvaKarte.tsx, zeichnen.ts) kennt nur diesen Typ.
//
// Grundsatz (mit dem Vorstand abgestimmt): Seltenheit bewertet NIE einen
// Spieler. Bronze = „Kader" (Basis), Silber/Gold-Glanz sind Varianten
// (Sammelstücke), Gold-Grundkarten nur für objektive Rollen (Kapitän,
// Trainer), Spezial = Momente + limitierte Karten. Keine Ratings.
// ─────────────────────────────────────────────────────────────

export type Seltenheit = 'bronze' | 'silber' | 'gold' | 'spezial'
export type KartenArt = 'spieler' | 'trainer' | 'moment' | 'fan' | 'partner'
export type Position = 'TW' | 'ABW' | 'MIT' | 'ANG'

/** Video-Quellen einer lebenden Karte (Greenscreen-Loop, Alpha). */
export interface KartenLoop {
  webm: string
  mov: string
  mp4: string
  poster: string
}

export interface KartenWert {
  label: string
  wert: string
}

export interface KartenDaten {
  /** stabiler Schlüssel (Cache, React-Key) */
  id: string
  art: KartenArt
  seltenheit: Seltenheit
  /** Name (Personen) bzw. Titel (Moment, Kurve, Partner) */
  titel: string
  /** Zusatz unter dem Titel, z. B. „Silber-Glanz", „90+7. Minute" */
  untertitel?: string
  /** Rückennummer (Gold) */
  nummer?: number | null
  position?: Position
  /** Trainerstab: lesbare Rolle („Trainer", „Co-Trainer" …) */
  rolle?: string
  kapitaen?: boolean
  neuzugang?: boolean
  /** Freisteller mit Alpha (Spieler/Stab) — aus playerMedia */
  figur?: string | null
  /** Foto (Moment/Kurve; bei Personen ohne Freisteller Rückfall) */
  foto?: string | null
  /** Bildausschnitt für Querformat-Fotos im Hochformat, z. B. „50% 35%" */
  fokus?: string
  /** lebende Karte: Video-Loop mit Alpha (Greenscreen) */
  loop?: KartenLoop | null
  /** Geometrie des Loops (Scheitel/Sohle als Anteil der Höhe) */
  loopGeo?: { w: number; h: number; headY: number }
  /** Partner-Karte: Logo-URL */
  logo?: string | null
  partnerSeit?: number | null
  /** „präsentiert von" (Spezial-/Moment-Karten) */
  praesentiertVon?: { name: string; logoUrl?: string | null } | null
  /** Serie, z. B. „Meister 2026", „Urknall-Pokal 2026", „Spieler des Spiels" */
  serie?: string
  /** Foto-Credit (Pflicht bei Fotos von picture by Nele) */
  credit?: string
  /** Glanz-Variante eines Spielers (füllt keinen Album-Platz) */
  variante?: boolean
  /** limitierte Karte (Bonus-Seite) */
  limitiert?: boolean
  /** v22: Shiny — extrem seltene Schwarz-Gold-Fassung derselben Person (reines Sammler-Glück) */
  shiny?: boolean
  /** v22: Erstfund dieser Shiny-Person (wird auf der Rückseite verewigt) */
  erstfund?: { name: string; at: string } | null
  /** v22: Geheimkarte (nur durch Entdecken, Geheimseite) */
  geheim?: boolean
  /** v26: Kabinen-Kult-Karte (eigener Rahmen „Kabine statt Tresor") */
  kult?: boolean
  kollektion?: string
  /** Kartennummer in der Serie, z. B. 17 von 42 */
  kartenNr?: number
  kartenGesamt?: number
  saison?: string
  /** Steckbrief-Text der Rückseite */
  rueckseite?: string
  /** sachliche Werte der Rückseite (Position, seit, Tore …) — nie Bewertungen */
  werte?: KartenWert[]
}

export const SELTEN_RANG: Record<Seltenheit, number> = { bronze: 1, silber: 2, gold: 3, spezial: 4 }

/** Öffentliche Namen der Seltenheit („Bronze" heißt beim Fan „Kader"). */
export const SELTEN_NAME: Record<Seltenheit, string> = {
  bronze: 'Kader',
  silber: 'Silber',
  gold: 'Gold',
  spezial: 'Spezial',
}

export const POSITION_NAME: Record<Position, string> = {
  TW: 'Torwart',
  ABW: 'Abwehr',
  MIT: 'Mittelfeld',
  ANG: 'Angriff',
}

export const ART_NAME: Record<KartenArt, string> = {
  spieler: 'Spieler',
  trainer: 'Trainerstab',
  moment: 'Moment',
  fan: 'Kurve',
  partner: 'Partner',
}

export function teileName(name: string): { vorname: string; nachname: string } {
  const t = name.trim().split(/\s+/)
  return { vorname: t.slice(0, -1).join(' '), nachname: t.slice(-1)[0] ?? '' }
}

/** „017/042" */
export function kartenNummer(d: Pick<KartenDaten, 'kartenNr' | 'kartenGesamt'>): string | null {
  if (!d.kartenNr) return null
  const breite = Math.max(3, String(d.kartenGesamt ?? 0).length)
  const n = String(d.kartenNr).padStart(breite, '0')
  return d.kartenGesamt ? `${n}/${String(d.kartenGesamt).padStart(breite, '0')}` : n
}
