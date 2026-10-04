// ─────────────────────────────────────────────────────────────
// v14: Aufstellung (Startelf + Bank). Gemeinsamer Vertrag zwischen
// Website (Mannschafts-Station) und Admin (Vereins-Pflege → Aufstellung).
//
// Die Website liest LINEUP über src/data/content.ts (Overlay aus dem
// Build-Fetch, sonst dieser Seed). Spieler werden per Player.id
// referenziert, nie per Name.
//
// SEED-HINWEIS: Die Elf unten ist eine positionsgerechte Beispiel-Elf aus
// dem echten Kader, KEINE echte Spieltags-Aufstellung. Solange
// `matchLabel` leer ist, behauptet die UI auch keine („Unsere Elf“ statt
// „Aufstellung gegen …“). Marvin setzt die echte Elf im Admin.
// ─────────────────────────────────────────────────────────────

export type Formation = '4-4-2' | '4-3-3' | '4-2-3-1' | '3-5-2'

export interface Lineup {
  formation: Formation
  /** Genau 11 Player.ids in Slot-Reihenfolge von FORMATION_SLOTS[formation]. */
  startelf: string[]
  /** Auswechselbank, beliebig viele Player.ids. */
  bank: string[]
  /** z. B. „vs TuS Harsefeld · 28.09.“ — leer = keine konkrete Partie behaupten. */
  matchLabel?: string | null
  /** ISO-Zeitstempel der letzten Pflege im Admin. */
  updatedAt?: string | null
}

/** Ein Slot auf dem Feld. x: −1 (links) … 1 (rechts) aus Sicht des eigenen
 *  Tores; y: 0 (eigene Torlinie) … 1 (Mittellinie). Nur eigene Hälfte —
 *  die Elf steht wie beim Anstoß. */
export interface Slot {
  x: number
  y: number
  /** Positionsgruppe für Kartenbeschriftung/Validierung im Admin. */
  role: 'TW' | 'ABW' | 'MIT' | 'ANG'
}

export const FORMATION_SLOTS: Record<Formation, Slot[]> = {
  '4-4-2': [
    { x: 0, y: 0.06, role: 'TW' },
    { x: -0.72, y: 0.3, role: 'ABW' }, { x: -0.25, y: 0.26, role: 'ABW' }, { x: 0.25, y: 0.26, role: 'ABW' }, { x: 0.72, y: 0.3, role: 'ABW' },
    { x: -0.72, y: 0.58, role: 'MIT' }, { x: -0.25, y: 0.54, role: 'MIT' }, { x: 0.25, y: 0.54, role: 'MIT' }, { x: 0.72, y: 0.58, role: 'MIT' },
    { x: -0.25, y: 0.86, role: 'ANG' }, { x: 0.25, y: 0.86, role: 'ANG' },
  ],
  '4-3-3': [
    { x: 0, y: 0.06, role: 'TW' },
    { x: -0.72, y: 0.3, role: 'ABW' }, { x: -0.25, y: 0.26, role: 'ABW' }, { x: 0.25, y: 0.26, role: 'ABW' }, { x: 0.72, y: 0.3, role: 'ABW' },
    { x: -0.45, y: 0.55, role: 'MIT' }, { x: 0, y: 0.5, role: 'MIT' }, { x: 0.45, y: 0.55, role: 'MIT' },
    { x: -0.68, y: 0.84, role: 'ANG' }, { x: 0, y: 0.9, role: 'ANG' }, { x: 0.68, y: 0.84, role: 'ANG' },
  ],
  '4-2-3-1': [
    { x: 0, y: 0.06, role: 'TW' },
    { x: -0.72, y: 0.3, role: 'ABW' }, { x: -0.25, y: 0.26, role: 'ABW' }, { x: 0.25, y: 0.26, role: 'ABW' }, { x: 0.72, y: 0.3, role: 'ABW' },
    { x: -0.25, y: 0.48, role: 'MIT' }, { x: 0.25, y: 0.48, role: 'MIT' },
    { x: -0.65, y: 0.7, role: 'MIT' }, { x: 0, y: 0.68, role: 'MIT' }, { x: 0.65, y: 0.7, role: 'MIT' },
    { x: 0, y: 0.9, role: 'ANG' },
  ],
  '3-5-2': [
    { x: 0, y: 0.06, role: 'TW' },
    { x: -0.5, y: 0.27, role: 'ABW' }, { x: 0, y: 0.24, role: 'ABW' }, { x: 0.5, y: 0.27, role: 'ABW' },
    { x: -0.8, y: 0.58, role: 'MIT' }, { x: -0.38, y: 0.52, role: 'MIT' }, { x: 0, y: 0.5, role: 'MIT' }, { x: 0.38, y: 0.52, role: 'MIT' }, { x: 0.8, y: 0.58, role: 'MIT' },
    { x: -0.25, y: 0.86, role: 'ANG' }, { x: 0.25, y: 0.86, role: 'ANG' },
  ],
}

export const LINEUP: Lineup = {
  formation: '4-4-2',
  startelf: [
    'p-pils',
    'p-sladek', 'p-brettschneider', 'p-neuber-m', 'p-huettry',
    'p-kalwa', 'p-helck', 'p-becker', 'p-paruzel',
    'p-warkehr-a', 'p-biedermann',
  ],
  bank: ['p-ebeling-t', 'p-nauerz', 'p-elsen', 'p-pejas-n', 'p-pejas-e', 'p-bruenjes', 'p-matthes'],
  matchLabel: null,
  updatedAt: null,
}
