// v14-C: Gemeinsame Spiel-Logik für Übersicht, Spiele und Aufstellung.
// Gleiche Regeln wie web_snapshot() (Migration 20261004101000):
//   nächstes Spiel = frühestes ohne Ergebnis, Anstoß höchstens 3 h her
//   letztes Spiel  = jüngstes mit Ergebnis
import type { SpielRow } from './db'

const DREI_STUNDEN = 3 * 3600_000

export function hatErgebnis(s: Pick<SpielRow, 'tore_sva' | 'tore_gegner'>): boolean {
  return s.tore_sva != null && s.tore_gegner != null
}

export function naechstesSpiel(spiele: SpielRow[], now = Date.now()): SpielRow | null {
  return (
    spiele
      .filter((s) => !hatErgebnis(s) && new Date(s.anstoss).getTime() >= now - DREI_STUNDEN)
      .sort((a, b) => +new Date(a.anstoss) - +new Date(b.anstoss))[0] ?? null
  )
}

export function letztesSpiel(spiele: SpielRow[]): SpielRow | null {
  return spiele.filter(hatErgebnis).sort((a, b) => +new Date(b.anstoss) - +new Date(a.anstoss))[0] ?? null
}

/** Gespielt (Anstoß > 3 h her), aber noch ohne Ergebnis. */
export function ergebnisOffen(spiele: SpielRow[], now = Date.now()): SpielRow[] {
  return spiele.filter((s) => !hatErgebnis(s) && new Date(s.anstoss).getTime() < now - DREI_STUNDEN)
}

export function paarung(s: Pick<SpielRow, 'heim' | 'gegner'>): string {
  return s.heim ? `SVA – ${s.gegner}` : `${s.gegner} – SVA`
}

/** Ergebnis aus Sicht der Paarung (Heim zuerst), z. B. „2:1". */
export function ergebnisText(s: SpielRow): string {
  if (!hatErgebnis(s)) return '–:–'
  return s.heim ? `${s.tore_sva}:${s.tore_gegner}` : `${s.tore_gegner}:${s.tore_sva}`
}

export function ergebnisArt(s: SpielRow): 'W' | 'U' | 'N' | null {
  if (!hatErgebnis(s)) return null
  if (s.tore_sva! > s.tore_gegner!) return 'W'
  if (s.tore_sva === s.tore_gegner) return 'U'
  return 'N'
}

/** Label für die Website-Aufstellung, Vertrag lineup.ts: „vs TuS Harsefeld · 28.09." */
export function matchLabelFor(s: Pick<SpielRow, 'gegner' | 'anstoss'>): string {
  const d = new Date(s.anstoss)
  const datum = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' })
  return `vs ${s.gegner} · ${datum.endsWith('.') ? datum : `${datum}.`}`
}
