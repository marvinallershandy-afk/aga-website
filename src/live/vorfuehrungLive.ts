// ─────────────────────────────────────────────────────────────
// v23-U Vorführung (/live?vorfuehrung=1): die neuen v23-Elemente rein im
// Browser simulieren — Bot-Ereignisse (Quelle FuPa), Konferenz, Live-Tabelle,
// Tipp-Kurzkennzahl. KEIN Netz, keine Reaktions-RPCs (Reaktionen simuliert der
// Hook in Reaktionen.tsx). web_live_demo() liefert nur das Vorführ-Spiel; hier
// kommen die Konferenz/Tabelle/Quelle additiv dazu.
// ─────────────────────────────────────────────────────────────
import type { Konferenz, LiveData, TippKurz } from './model'

const LIGA_SPIELE: Konferenz['spiele'] = [
  { fupaId: 901, heim: 'Agathenb./Do', gast: 'Fischbek', heimSlug: 'sva', gastSlug: 'fis', toreHeim: 2, toreGast: 1, section: 'LIVE', minute: 58, nachspielzeit: null, tickerTyp: 'live', anstoss: '', url: 'https://www.fupa.net/match/901', sva: true },
  { fupaId: 902, heim: 'Horneburg', gast: 'Buxtehude', heimSlug: 'hor', gastSlug: 'bux', toreHeim: 1, toreGast: 1, section: 'LIVE', minute: 61, nachspielzeit: null, tickerTyp: 'live', anstoss: '', url: 'https://www.fupa.net/match/902', sva: false },
  { fupaId: 903, heim: 'SG Lühe', gast: 'Dollern II', heimSlug: 'lue', gastSlug: 'do2', toreHeim: 0, toreGast: 3, section: 'LIVE', minute: 55, nachspielzeit: null, tickerTyp: 'live', anstoss: '', url: 'https://www.fupa.net/match/903', sva: false },
  { fupaId: 904, heim: 'Jork', gast: 'Stade', heimSlug: 'jor', gastSlug: 'sta', toreHeim: 2, toreGast: 0, section: 'POST', minute: null, nachspielzeit: null, tickerTyp: 'live', anstoss: '', url: 'https://www.fupa.net/match/904', sva: false },
  { fupaId: 905, heim: 'Harsefeld', gast: 'Apensen', heimSlug: 'har', gastSlug: 'ape', toreHeim: 1, toreGast: 2, section: 'POST', minute: null, nachspielzeit: null, tickerTyp: 'live', anstoss: '', url: 'https://www.fupa.net/match/905', sva: false },
  { fupaId: 906, heim: 'Ahlerstedt', gast: 'Deinste', heimSlug: 'ahl', gastSlug: 'dei', toreHeim: null, toreGast: null, section: 'PRE', minute: null, nachspielzeit: null, tickerTyp: null, anstoss: new Date().toISOString(), url: 'https://www.fupa.net/match/906', sva: false },
]

const TABELLE: NonNullable<Konferenz['zeilen']> = [
  { platz: 1, team: 'TuS Jork', slug: 'jor', sp: 10, s: 8, u: 1, n: 1, tore: 26, gegen: 9, diff: 17, pkt: 25, live: false, trend: 0 },
  { platz: 2, team: 'VfL Horneburg', slug: 'hor', sp: 10, s: 7, u: 2, n: 1, tore: 22, gegen: 11, diff: 11, pkt: 23, live: true, trend: 1 },
  { platz: 3, team: 'SV Harsefeld', slug: 'har', sp: 10, s: 6, u: 2, n: 2, tore: 18, gegen: 12, diff: 6, pkt: 20, live: false, trend: -1 },
  { platz: 4, team: 'SV Agathenburg-Dollern', slug: 'sva', sp: 10, s: 5, u: 3, n: 2, tore: 19, gegen: 13, diff: 6, pkt: 18, live: true, self: true, trend: 2 },
  { platz: 5, team: 'Buxtehuder SV', slug: 'bux', sp: 10, s: 5, u: 2, n: 3, tore: 17, gegen: 15, diff: 2, pkt: 17, live: true, trend: -1 },
  { platz: 6, team: 'TuS Fischbek', slug: 'fis', sp: 10, s: 4, u: 3, n: 3, tore: 15, gegen: 14, diff: 1, pkt: 15, live: true, trend: 0 },
  { platz: 7, team: 'SG Lühe', slug: 'lue', sp: 10, s: 3, u: 2, n: 5, tore: 12, gegen: 18, diff: -6, pkt: 11, live: true, trend: -1 },
  { platz: 8, team: 'SV Ahlerstedt', slug: 'ahl', sp: 9, s: 2, u: 2, n: 5, tore: 10, gegen: 17, diff: -7, pkt: 8, live: false, trend: 0 },
]

/** web_live_demo()-Antwort um die v23-Elemente ergänzen (nur Vorführung). */
export function mitVorfuehrLive(d: LiveData): LiveData {
  const m = d.match
  if (!m) return d
  const laeuft = m.status === 'live' || m.status === 'halbzeit'
  const beendet = m.status === 'beendet'
  if (!laeuft && !beendet) return d

  const conference: Konferenz = {
    spiele: LIGA_SPIELE.map((s) => (s.sva ? { ...s, toreHeim: m.goalsFor, toreGast: m.goalsAgainst, minute: m.minute ?? s.minute } : s)),
    spieltag: m.matchday ?? 10,
    zeilen: TABELLE,
    stimmt: true,
  }
  // Tendenz erst nach Tippschluss (Anpfiff) sichtbar.
  const tipp: TippKurz = { tipps: 312, sieg: 58, remis: 24, niederlage: 18 }

  // Ereignisse im Bot-Look: Quelle FuPa, ein paar Reportertexte, Rest Vorlage.
  const events = d.events.map((e, i) => {
    const istTor = e.type === 'tor' || e.type === 'gegentor'
    const reporter = !!e.text && i % 3 === 0
    return {
      ...e,
      source: 'fupa' as const,
      textSource: (reporter ? 'reporter' : 'vorlage') as 'reporter' | 'vorlage',
      text: reporter ? e.text : undefined,
      zusatz: istTor && !e.text && i % 2 === 0 ? 'Kopfball' : e.zusatz,
    }
  })

  return {
    ...d,
    events,
    conference,
    tipp,
    match: {
      ...m,
      source: 'fupa',
      fupaUrl: 'https://www.fupa.net/match/901',
      fupaAutor: 'Niko Hause',
    },
  }
}
