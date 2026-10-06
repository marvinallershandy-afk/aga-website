// ─────────────────────────────────────────────────────────────
// v23-U: Brücke web_live() → Tipp-Liga-Live. Macht aus der öffentlichen
// Live-Antwort (src/live/model) die LiveDaten der Tipp-Liga, damit die
// Live-Hochrechnung der Elf jetzt auch im ECHTEN Spiel läuft (bisher nur in
// der Vorführung). web_live liefert Spieler als Slugs — die Tipp-Liga nutzt
// dieselben Slugs als Kader-ID (tipp_lage: 'id' = r.slug), also direktes Mapping.
// Platzhalter-Tore („Torschütze folgt") haben keinen Spieler → sie zählen übers
// Ergebnis (Spielstand), aber nicht für die Elf.
// ─────────────────────────────────────────────────────────────
import { spielstandVerlauf, type LiveData, type LiveEvent, type TickerTyp } from '../live/model'
import type { LiveDaten, LiveEreignis, MeineElf, MeinTipp, Position, TippSpiel } from './api'
import { hochrechnen } from './punkte'

// Nur Typen, die die Tipp-Liga kennt (Kommentar/Gegner-Wechsel/verschossen raus).
const TYP_MAP: Partial<Record<TickerTyp, LiveEreignis['typ']>> = {
  anpfiff: 'anpfiff',
  tor: 'tor',
  gegentor: 'gegentor',
  gelb: 'gelb',
  gelbrot: 'gelbrot',
  rot: 'rot',
  wechsel: 'wechsel',
  halbzeit: 'halbzeit',
  wiederanpfiff: 'wiederanpfiff',
  abpfiff: 'abpfiff',
  elfmeter: 'elfmeter',
}

/** web_live-Ereignisse (neueste zuerst) → Tipp-Liga-Ereignisse (chronologisch). */
export function ereignisseAus(d: LiveData): LiveEreignis[] {
  const verlauf = spielstandVerlauf(d.events)
  const chrono = [...d.events].sort((a, b) => +new Date(a.at) - +new Date(b.at) || a.id.localeCompare(b.id))
  const out: LiveEreignis[] = []
  for (const e of chrono) {
    const typ = TYP_MAP[e.type]
    if (!typ) continue
    const s = verlauf.get(e.id)
    out.push({
      minute: e.minute ?? 0,
      typ,
      // Nur Kader-Spieler (SVA) tragen einen Slug; Gegner-Ereignisse bleiben ohne.
      spieler: e.team === 'gegner' ? undefined : (e.player ?? undefined),
      spieler2: e.team === 'gegner' ? undefined : (e.player2 ?? undefined),
      text: (e as LiveEvent).text ?? undefined,
      stand: s ? [s[0], s[1]] : undefined,
    })
  }
  return out
}

/** Komplette LiveDaten (Minute, Ereignisse, meine Hochrechnung) aus web_live. */
export function liveDatenAus(
  d: LiveData,
  o: { tipp?: MeinTipp; elf?: MeineElf; fragen: TippSpiel['fragen']; heim: boolean; position: (id: string) => Position },
): LiveDaten | null {
  const m = d.match
  if (!m) return null
  if (m.status !== 'live' && m.status !== 'halbzeit' && m.status !== 'beendet') return null
  const ereignisse = ereignisseAus(d)
  const stand: [number, number] = [m.goalsFor, m.goalsAgainst]
  const rohMin = m.minute ?? 0
  const ende = m.status === 'beendet'
  const startelf = d.lineup?.startelf ?? []
  const ich =
    o.tipp || o.elf
      ? hochrechnen({ spiel: { fragen: o.fragen, heim: o.heim }, tipp: o.tipp, elf: o.elf, stand, ereignisse, minute: rohMin, ende, startelf, position: o.position })
      : undefined
  return {
    minute: Math.min(90, rohMin),
    nachspielzeit: rohMin > 90 ? rohMin - 90 : undefined,
    ereignisse,
    ich,
    tippLive: d.tipp ?? undefined,
    quelle: m.source,
    fupaUrl: m.fupaUrl,
  }
}
