// v15-T: Tests der reinen Function-Logik — ohne API-Key, ohne Deno.
//   node supabase/functions/tabelle-aus-bild/logik.test.mjs
// (Node ≥ 23 lädt logik.ts direkt, die Typen werden nur entfernt.)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  MODELL,
  TOOL_NAME,
  TOOL_SCHEMA,
  baueAnfrage,
  baueSystemPrompt,
  base64Bytes,
  fehlerAusApi,
  istEigeneMannschaft,
  leseToolAntwort,
  pruefeBilder,
  pruefeZeile,
  verarbeite,
  zahl,
} from './logik.ts'

const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

// Beispielantwort, wie Claude sie über das Tool liefern würde — mit absichtlichen Fehlern:
// Platz 4 Punkte falsch, Platz 6 Niederlagen abgeschnitten, Platz 9 doppelt (Überlappung
// zweier Screenshots), Platz 11 fehlt, Tordifferenz-Widerspruch bei Platz 3.
const BEISPIEL = {
  liga: 'Kreisliga Stade',
  spieltag: 9,
  konfidenz: 'mittel',
  warnungen: ['Die Spalte „Niederlagen" ist bei einer Zeile verdeckt.'],
  rows: [
    { platz: 1, team: 'TuS Fischbek', spiele: 9, siege: 7, unentschieden: 1, niederlagen: 1, tore: 28, gegentore: 9, tordifferenz: 19, punkte: 22 },
    { platz: 2, team: 'SV Agathenburg/Dollern', spiele: 9, siege: 6, unentschieden: 2, niederlagen: 1, tore: 24, gegentore: 11, tordifferenz: 13, punkte: 20 },
    { platz: 3, team: 'VfL Horneburg', spiele: 9, siege: 5, unentschieden: 2, niederlagen: 2, tore: 19, gegentore: 12, tordifferenz: 8, punkte: 17 },
    { platz: 4, team: 'TSV Apensen', spiele: 9, siege: 5, unentschieden: 1, niederlagen: 3, tore: 17, gegentore: 14, tordifferenz: 3, punkte: 15 },
    { platz: 5, team: 'TuS Harsefeld II', spiele: '9', siege: 4, unentschieden: 2, niederlagen: 3, tore: 15, gegentore: 15, tordifferenz: 0, punkte: 14 },
    { platz: 6, team: 'SG Estetal', spiele: 9, siege: 3, unentschieden: 3, niederlagen: null, tore: 14, gegentore: 16, tordifferenz: -2, punkte: 12 },
    { platz: 7, team: 'VfL Güldenstern Stade III', spiele: 9, siege: 3, unentschieden: 1, niederlagen: 5, tore: 12, gegentore: 18, tordifferenz: -6, punkte: 10 },
    { platz: 8, team: 'FC Mulsum/Kutenholz', spiele: 9, siege: 2, unentschieden: 2, niederlagen: 5, tore: 10, gegentore: 19, tordifferenz: -9, punkte: 8 },
    { platz: 9, team: 'TSV Wiepenkathen', spiele: 9, siege: 2, unentschieden: 1, niederlagen: 6, tore: 9, gegentore: 20, tordifferenz: -11, punkte: 7 },
    // zweiter Screenshot überlappt: Platz 9 nochmal, diesmal ohne Tore
    { platz: 9, team: 'TSV  Wiepenkathen', spiele: 9, siege: 2, unentschieden: 1, niederlagen: 6, tore: null, gegentore: null, tordifferenz: null, punkte: 7 },
    { platz: 10, team: 'SV Ahlerstedt/Ottendorf II', spiele: 9, siege: 1, unentschieden: 1, niederlagen: 7, tore: 8, gegentore: 26, tordifferenz: -18, punkte: 4 },
    { platz: 12, team: 'TuS Hammah', spiele: 9, siege: 0, unentschieden: 2, niederlagen: 7, tore: 5, gegentore: 25, tordifferenz: -20, punkte: 2 },
  ],
}
// Platz 3 mit falscher Tordifferenz, Platz 4 mit falschen Punkten
BEISPIEL.rows[2].tordifferenz = 9
BEISPIEL.rows[3].punkte = 13

test('Modell-Konstante und Anfrage-Bau', () => {
  assert.equal(MODELL, 'claude-sonnet-5-5')
  const a = baueAnfrage([{ mediaType: 'image/png', data: PNG_1PX }, { mediaType: 'image/webp', data: PNG_1PX }])
  assert.equal(a.model, MODELL)
  assert.deepEqual(a.tool_choice, { type: 'auto' }) // 5er-Modelle: kein erzwungenes tool_choice
  assert.equal(a.tools[0].name, TOOL_NAME)
  const content = a.messages[0].content
  assert.equal(content.length, 3, '2 Bilder + 1 Text')
  assert.equal(content[0].type, 'image')
  assert.equal(content[0].source.media_type, 'image/png')
  assert.equal(content[1].source.media_type, 'image/webp')
  assert.equal(content[2].type, 'text')
  assert.match(content[2].text, /2 Screenshots/)
  const p = baueSystemPrompt()
  for (const stichwort of ['fussball.de', 'FuPa', 'kicker', '25:10', 'null', 'Heim', TOOL_NAME, 'Agathenburg']) {
    assert.ok(p.includes(stichwort), `Prompt erwähnt ${stichwort}`)
  }
})

test('Tool-Schema verlangt alle Spalten', () => {
  const s = TOOL_SCHEMA.input_schema
  assert.deepEqual([...s.required].sort(), ['konfidenz', 'liga', 'rows', 'spieltag', 'warnungen'])
  const zeile = s.properties.rows.items
  for (const f of ['platz', 'team', 'spiele', 'siege', 'unentschieden', 'niederlagen', 'tore', 'gegentore', 'tordifferenz', 'punkte']) {
    assert.ok(zeile.required.includes(f), f)
    assert.ok(zeile.properties[f], f)
  }
  assert.deepEqual(s.properties.konfidenz.enum, ['hoch', 'mittel', 'niedrig'])
  // muss als JSON serialisierbar sein (geht so an die API)
  assert.doesNotThrow(() => JSON.stringify(TOOL_SCHEMA))
})

test('Bilder-Prüfung', () => {
  assert.equal(pruefeBilder({}).ok, false)
  assert.equal(pruefeBilder({ bilder: [] }).ok, false)
  const vier = Array.from({ length: 4 }, () => ({ data: PNG_1PX, mediaType: 'image/png' }))
  assert.match(pruefeBilder({ bilder: vier }).fehler, /höchstens 3/)
  assert.match(pruefeBilder({ bilder: [{ data: PNG_1PX, mediaType: 'image/gif' }] }).fehler, /PNG, JPG oder WebP/)
  assert.match(pruefeBilder({ bilder: [{ data: 'kein base64 !', mediaType: 'image/png' }] }).fehler, /beschädigt/)
  const ok = pruefeBilder({ bilder: [{ data: `data:image/jpg;base64,${PNG_1PX}` }] })
  assert.equal(ok.ok, true)
  assert.equal(ok.bilder[0].mediaType, 'image/jpeg')
  assert.equal(ok.bilder[0].data, PNG_1PX)
  // > 5 MB
  const gross = 'A'.repeat(Math.ceil((5 * 1024 * 1024 + 10) / 3) * 4)
  assert.ok(base64Bytes(gross) > 5 * 1024 * 1024)
  assert.match(pruefeBilder({ bilder: [{ data: gross, mediaType: 'image/png' }] }).fehler, /zu groß/)
  assert.equal(base64Bytes('QUJD'), 3)
  assert.equal(base64Bytes('QUI='), 2)
})

test('Eigene Mannschaft erkennen', () => {
  for (const ja of [
    'SV Agathenburg/Dollern',
    'SV Agathenburg-Dollern',
    'SV Agathenb./Dollern',
    'sv agathenburg dollern',
    'SV Aga.-Dollern',
    'SG Agathenburg/Dollern',
    'Agathenburg/D.',
    'SVA',
    'SV Agathenburg/Dollern II',
  ]) assert.equal(istEigeneMannschaft(ja), true, ja)
  for (const nein of ['TuS Fischbek', 'VfL Horneburg', 'SV Ahlerstedt/Ottendorf', 'TSV Dollern-Hagen', 'Svalbard FC', '']) {
    assert.equal(istEigeneMannschaft(nein), false, nein)
  }
})

test('Zahlen säubern', () => {
  assert.equal(zahl(5), 5)
  assert.equal(zahl('12'), 12)
  assert.equal(zahl(-1), null)
  assert.equal(zahl('−3', { negativ: true }), -3)
  assert.equal(zahl(2.5), null)
  assert.equal(zahl('x'), null)
  assert.equal(zahl(null), null)
})

test('Zeilen-Plausibilität', () => {
  const gut = { team: 'X', spiele: 9, siege: 6, unentschieden: 2, niederlagen: 1, tore: 1, gegentore: 1, punkte: 20 }
  assert.deepEqual(pruefeZeile(gut), [])
  assert.match(pruefeZeile({ ...gut, punkte: 19 }).join(), /Punkte 19 passen nicht zu 3 × 6 Siege \+ 2 Unentschieden = 20/)
  assert.match(pruefeZeile({ ...gut, spiele: 10 }).join(), /= 9, aber 10 Spiele/)
  assert.match(pruefeZeile({ ...gut, tore: null }).join(), /Tore nicht lesbar/)
})

test('Beispiel-Antwort verarbeiten', () => {
  const e = verarbeite(structuredClone(BEISPIEL))
  assert.equal(e.liga, 'Kreisliga Stade')
  assert.equal(e.spieltag, 9)
  assert.equal(e.konfidenz, 'mittel')
  // Doppelte Zeile (Überlappung) zusammengeführt, vollständigere Variante behalten
  assert.equal(e.rows.length, 11)
  const wiepe = e.rows.find((r) => r.team.startsWith('TSV'))
  assert.ok(e.rows.filter((r) => r.platz === 9).length === 1)
  assert.ok(wiepe)
  assert.equal(e.rows.find((r) => r.platz === 9).tore, 9)
  // Self
  const self = e.rows.filter((r) => r.self)
  assert.equal(self.length, 1)
  assert.equal(self[0].team, 'SV Agathenburg/Dollern')
  // String-Zahl übernommen
  assert.equal(e.rows.find((r) => r.platz === 5).spiele, 9)
  // Niederlagen bei Platz 6 berechnet (9 − 3 − 3 = 3) + Hinweis
  assert.equal(e.rows.find((r) => r.platz === 6).niederlagen, 3)
  assert.ok(e.hinweise.some((h) => /SG Estetal: Niederlagen .* berechnet \(3\)/.test(h)))
  // Punkte-Abweichung bei Platz 4 → Warnung, NICHT verworfen
  const apensen = e.rows.find((r) => r.platz === 4)
  assert.equal(apensen.punkte, 13)
  assert.ok(apensen.warnungen.some((w) => /Punkte 13 passen nicht/.test(w)))
  // Tordifferenz-Widerspruch bei Platz 3
  assert.ok(e.rows.find((r) => r.platz === 3).warnungen.some((w) => /Tordifferenz \+9/.test(w)))
  // Lücke: Platz 11 fehlt
  assert.ok(e.hinweise.some((h) => /Platz 11 fehlt/.test(h)))
  // Modell-Warnung durchgereicht
  assert.ok(e.hinweise.some((h) => /verdeckt/.test(h)))
  // warnungen = alles, mit Zeilenbezug
  assert.ok(e.warnungen.some((w) => w.startsWith('Platz 4 · TSV Apensen: Punkte')))
  // keine internen Felder in der Antwort
  assert.equal('_tordiff' in e.rows[0], false)
  // saubere Zeilen ohne Warnung
  assert.deepEqual(e.rows.find((r) => r.platz === 1).warnungen, [])
})

test('Fehlende Plätze, falscher Start, keine eigene Mannschaft, niedrige Konfidenz', () => {
  const e = verarbeite({
    konfidenz: 'niedrig',
    warnungen: [],
    rows: [
      { platz: 5, team: '5. TuS A', spiele: 3, siege: 1, unentschieden: 0, niederlagen: 2, tore: 3, gegentore: 4, punkte: 3 },
      { platz: null, team: 'TuS B ▲', spiele: 3, siege: 0, unentschieden: 3, niederlagen: 0, tore: 2, gegentore: 2, punkte: 3 },
      { platz: 7, team: '', spiele: 3 },
    ],
  })
  assert.equal(e.rows.length, 2, 'leere Teamnamen fallen weg')
  assert.equal(e.rows[0].team, 'TuS A', 'Platzziffer vor dem Namen entfernt')
  assert.equal(e.rows[1].team, 'TuS B', 'Pfeil entfernt')
  assert.equal(e.rows[1].platz, 6, 'fehlender Platz aus Reihenfolge ergänzt')
  assert.ok(e.rows[1].warnungen.some((w) => /aus der Reihenfolge/.test(w)))
  assert.ok(e.hinweise.some((h) => /beginnt erst bei Platz 5/.test(h)))
  assert.ok(e.hinweise.some((h) => /nicht gefunden/.test(h)))
  assert.ok(e.hinweise.some((h) => /schwer zu lesen/.test(h)))
  assert.equal(e.liga, null)
  assert.equal(e.spieltag, null)
})

test('Mehrere Agathenburg-Teams: erste Mannschaft gewinnt', () => {
  const e = verarbeite({
    konfidenz: 'hoch',
    rows: [
      { platz: 1, team: 'SV Agathenburg/Dollern II', spiele: 1, siege: 1, unentschieden: 0, niederlagen: 0, tore: 1, gegentore: 0, punkte: 3 },
      { platz: 2, team: 'SV Agathenburg/Dollern', spiele: 1, siege: 0, unentschieden: 1, niederlagen: 0, tore: 0, gegentore: 0, punkte: 1 },
    ],
  })
  assert.equal(e.rows.find((r) => r.self).team, 'SV Agathenburg/Dollern')
  assert.ok(e.hinweise.some((h) => /Mehrere Agathenburg/.test(h)))
})

test('API-Antworten auswerten', () => {
  const roh = leseToolAntwort({
    stop_reason: 'tool_use',
    content: [{ type: 'text', text: 'ok' }, { type: 'tool_use', name: TOOL_NAME, input: BEISPIEL }],
  })
  assert.equal(roh.liga, 'Kreisliga Stade')
  assert.throws(() => leseToolAntwort({ content: [{ type: 'text', text: 'Hallo' }] }), /keine Tabelle zurückgegeben/)
  assert.throws(() => leseToolAntwort({ stop_reason: 'max_tokens', content: [] }), /zwei Screenshots/)
  assert.throws(() => leseToolAntwort({ stop_reason: 'refusal', content: [] }), /nicht ausgewertet/)
  assert.match(fehlerAusApi(401, { error: { type: 'authentication_error' } }).message, /API-Key/)
  assert.match(fehlerAusApi(429, {}).message, /zu viele Anfragen/i)
  assert.equal(fehlerAusApi(529, { error: { type: 'overloaded_error' } }).status, 503)
  assert.match(fehlerAusApi(400, { error: { message: 'Your credit balance is too low' } }).message, /Guthaben/)
  assert.match(fehlerAusApi(404, { error: { type: 'not_found_error' } }).message, /Modell/)
})
