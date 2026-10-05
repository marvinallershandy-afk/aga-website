// Unit-Test der FuPa-Abbildung (supabase/functions/fupa-sync/map.mjs) gegen die
// ECHTEN FuPa-Beispieldaten in fixtures/fupa/ (einmal per curl gezogen).
// Kein Netzwerk, keine DB. Ausführen:
//   node supabase/tests/fupa_map.test.mjs
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  configAusFupaUrl, istTestspiel, ligaCompetitionSlug, mapMatch, mapMatches, mapStandings, stufenSuffix,
} from '../functions/fupa-sync/map.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fx = (n) => JSON.parse(fs.readFileSync(join(here, 'fixtures', 'fupa', n), 'utf8'))
const current = fx('matches-current.json')
const past = fx('matches-past.json')
const standings = fx('standings.json')

let fails = 0
const ok = (cond, msg) => { console.log(cond ? 'OK  ' : 'FAIL', msg); if (!cond) fails++ }
const eq = (a, b, msg) => ok(a === b, `${msg} (ist ${JSON.stringify(a)}, erwartet ${JSON.stringify(b)})`)

// ── Konfiguration aus fupa_url ───────────────────────────────────────────────
const cfg = configAusFupaUrl('https://www.fupa.net/team/sv-agathenburg-dollern-m1-2026-27')
eq(cfg.teamSlug, 'sv-agathenburg-dollern-m1-2026-27', 'teamSlug')
eq(cfg.clubSlug, 'sv-agathenburg-dollern', 'clubSlug (ohne -m1-2026-27)')
eq(cfg.seasonSlug, '2026-27', 'seasonSlug')
eq(cfg.saison, '2026/27', 'saison (Anzeigeform)')
ok(configAusFupaUrl('https://example.com') === null, 'fremde URL → null')

// ── Teamstufen-Suffix ────────────────────────────────────────────────────────
eq(stufenSuffix(1), '', 'Stufe 1 ohne Suffix')
eq(stufenSuffix(2), ' II', 'Stufe 2 → II')
eq(stufenSuffix(3), ' III', 'Stufe 3 → III')

// ── Einzel-Abbildung bekannter Spiele ────────────────────────────────────────
const byId = new Map([...current, ...past].map((m) => [m.id, m]))

// Heimsieg gegen die Zweite: VfL Güldenstern Stade II, 2:1, Spieltag 5
const heimSieg = mapMatch(byId.get(15241610), cfg)
eq(heimSieg.gegner, 'VfL Güldenstern Stade II', 'Gegnername mit Stufe II')
eq(heimSieg.heim, true, 'Heimspiel erkannt')
eq(heimSieg.ort, 'Waldsportplatz Agathenburg', 'Heim → Waldsportplatz')
eq(heimSieg.tore_sva, 2, 'tore_sva Heim')
eq(heimSieg.tore_gegner, 1, 'tore_gegner Heim')
eq(heimSieg.status, 'beendet', 'POST mit Toren → beendet')
eq(heimSieg.spieltag_nr, 5, 'Liga-Spieltag übernommen')
eq(heimSieg.wettbewerb, 'Kreisliga Stade', 'Wettbewerb')
eq(heimSieg.notizen, 'fupa:15241610', 'Idempotenz-Notiz')

// Auswärtsspiel: Tore werden korrekt gedreht (SVA = Gast). TuS Eiche Bargstedt 2:0
const auswaerts = mapMatch(byId.get(15241627), cfg)
eq(auswaerts.heim, false, 'Auswärtsspiel erkannt')
eq(auswaerts.ort, null, 'Auswärts → kein fester Ort')
eq(auswaerts.tore_sva, 0, 'tore_sva = Gast-Tore')
eq(auswaerts.tore_gegner, 2, 'tore_gegner = Heim-Tore')

// Pokal: kein Liga-Spieltag
const pokal = mapMatch(byId.get(15268750), cfg)
eq(pokal.wettbewerb, 'Kreispokal Stade', 'Pokal-Wettbewerb')
eq(pokal.spieltag_nr, null, 'Pokal → kein Spieltag')
eq(pokal.tore_sva, 0, 'Pokal tore_sva')
eq(pokal.tore_gegner, 3, 'Pokal tore_gegner')

// Zukünftiges Ligaspiel (section PRE): geplant, keine Tore
const geplant = mapMatch(byId.get(15241737), cfg)
eq(geplant.status, 'geplant', 'PRE → geplant')
eq(geplant.tore_sva, null, 'geplant → keine Tore')

// Auswärts-Stufe-III-Gegner
const ahlerstedt = [...current, ...past].map((m) => mapMatch(m, cfg)).find((r) => r && r.gegner.startsWith('SV Ahlerstedt'))
ok(ahlerstedt && ahlerstedt.gegner === 'SV Ahlerstedt/Ottendorf III', 'Stufe III am Gegnernamen: ' + (ahlerstedt && ahlerstedt.gegner))

// ── Testspiele werden ausgelassen ────────────────────────────────────────────
const testspiele = [...current, ...past].filter(istTestspiel)
ok(testspiele.length === 3, `3 Testspiele im Fixture erkannt (${testspiele.length})`)
testspiele.forEach((m) => ok(mapMatch(m, cfg) === null, `Testspiel ${m.id} → null`))

// ── Gesamtlauf + Deduplizierung ──────────────────────────────────────────────
const alle = mapMatches([current, past], cfg)
const roh = [...current, ...past].filter((m) => !istTestspiel(m)).length
ok(alle.length < roh, `Duplikat zusammengefasst (${alle.length} aus ${roh} Roh-Nicht-Testspielen)`)
const ids = alle.map((r) => r.notizen)
ok(new Set(ids).size === ids.length, 'keine doppelten fupa:-Notizen nach mapMatches')
ok(alle.every((r) => /^fupa:\d+$/.test(r.notizen)), 'alle Notizen im Format fupa:<id>')

// Liga-Slug für den standings-Aufruf
eq(ligaCompetitionSlug([current, past]), 'kreisliga-stade', 'Liga-Wettbewerbs-Slug')

// ── Tabelle ──────────────────────────────────────────────────────────────────
const tab = mapStandings(standings, cfg)
eq(tab.length, 14, 'Tabelle: 14 Plätze')
eq(tab[0].platz, 1, 'Platz 1 zuerst')
ok(tab.every((r) => !('diff' in r)), 'diff NICHT gesetzt (generierte Spalte)')
ok(tab.every((r) => r.saison === '2026/27'), 'Saison 2026/27 an jeder Zeile')
const sva = tab.find((r) => r.self)
ok(sva, 'eigene Mannschaft in der Tabelle markiert (self=true)')
ok(sva && sva.team.startsWith('SV Agathenburg'), 'self-Zeile ist SVA: ' + (sva && sva.team))
const p1 = tab[0]
ok(p1.punkte === 27 && p1.spiele === 9 && p1.tore === 36 && p1.gegentore === 8, 'Platz-1-Werte übernommen: ' + JSON.stringify(p1))

console.log(fails ? `\n${fails} FEHLER` : '\nAlle Tests grün.')
process.exit(fails ? 1 : 0)
