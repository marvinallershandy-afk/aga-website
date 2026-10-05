// v18-A: Tests der ICS-Erzeugung (ohne Deno, ohne Netz).
//   node supabase/functions/kalender/ics.test.mjs
// (Node ≥ 23 lädt ics.ts direkt, die Typen werden nur entfernt.)
// Zusätzlich gegen einen echten ICS-Parser (ical.js) — NICHT als Projekt-
// Abhängigkeit, sondern aus einem Scratch-Ordner:
//   mkdir /tmp/ical && cd /tmp/ical && npm i ical.js
//   ICALJS=/tmp/ical/node_modules/ical.js/dist/ical.min.js node supabase/functions/kalender/ics.test.mjs
//   AUSGABE=beispiel.ics → schreibt die Beispieldatei
import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import { baueKalender, baueEinzeltermin, findeSpiel, escapeText, foldLine, utc, titel, ort, uidFuer, kalenderName } from './ics.ts'

const enc = new TextEncoder()
const DATEN = {
  verein: { adresse: 'Waldsportplatz Agathenburg, Zur Mehrzweckhalle, 21684 Agathenburg' },
  spiele: [
    { id: '0B6F2A44-1111-4AAA-8BBB-000000000001', gegner: 'TSV Apensen', heim: true, anstoss: '2026-10-11T13:00:00Z', ort: 'Sportplatz Agathenburg', wettbewerb: 'Kreisliga Stade', spieltag: 7, seq: 2, geaendert: '2026-10-05T09:12:00Z' },
    { id: '0b6f2a44-1111-4aaa-8bbb-000000000002', gegner: 'VfL Güldenstern Stade III', heim: false, anstoss: '2026-10-18T12:30:00Z', ort: 'Güldenstern-Arena, Am Exerzierplatz 1, 21680 Stade', wettbewerb: 'Kreisliga Stade', spieltag: 8, seq: 0, geaendert: '2026-09-01T08:00:00Z' },
    { id: '0b6f2a44-1111-4aaa-8bbb-000000000003', gegner: 'FC Mulsum; Kutenholz, II\\Ü32 — Gäste mit Ümläut', heim: true, anstoss: '2026-09-27T13:00:00Z', wettbewerb: 'Kreispokal', toreSva: 3, toreGegner: 1, seq: 1, geaendert: '2026-09-27T15:10:00Z' },
    { id: '0b6f2a44-1111-4aaa-8bbb-000000000004', gegner: 'Probe (TEST)', heim: true, anstoss: '2026-10-08T17:00:00Z' },
    { id: '0b6f2a44-1111-4aaa-8bbb-000000000005', gegner: 'Kaputt', heim: true, anstoss: 'kein-datum' },
  ],
}
const OPT = { alle: false, seite: 'https://aga-erste.de' }

test('escapeText: Komma, Semikolon, Backslash, Zeilenumbruch', () => {
  assert.equal(escapeText('a,b;c\\d\ne\r\nf'), 'a\\,b\\;c\\\\d\\ne\\nf')
  assert.equal(escapeText('Grün-Weiß'), 'Grün-Weiß', 'Umlaute bleiben UTF-8')
})

test('foldLine: ≤ 75 Oktette je Zeile, Umlaute nie zerteilt, Inhalt verlustfrei', () => {
  const lang = 'DESCRIPTION:' + 'Ä'.repeat(100) + 'x'.repeat(50) + '€'.repeat(30)
  const gefaltet = foldLine(lang)
  const zeilen = gefaltet.split('\r\n')
  assert.ok(zeilen.length > 3)
  for (const z of zeilen) assert.ok(enc.encode(z).length <= 75, `Zeile zu lang: ${enc.encode(z).length}`)
  for (const z of zeilen.slice(1)) assert.equal(z[0], ' ', 'Folgezeile beginnt mit Leerzeichen')
  assert.ok(!gefaltet.includes('�'))
  assert.equal(zeilen.map((z, i) => (i ? z.slice(1) : z)).join(''), lang, 'entfaltet = Original')
  assert.equal(foldLine('KURZ:x'), 'KURZ:x')
})

test('utc: Format YYYYMMDDTHHMMSSZ', () => {
  assert.equal(utc(new Date('2026-10-11T13:00:00Z')), '20261011T130000Z')
})

test('Heim-Kalender: Kopf, nur Heimspiele, ohne Testspiel und kaputte Termine', () => {
  const ics = baueKalender(DATEN, OPT)
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'))
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'))
  assert.ok(!/[^\r]\n/.test(ics), 'nur CRLF')
  for (const z of ics.split('\r\n')) assert.ok(enc.encode(z).length <= 75, 'alle Zeilen ≤ 75 Oktette')
  assert.match(ics, /X-WR-CALNAME:SV Agathenburg-Dollern – Heimspiele\r\n/)
  assert.match(ics, /REFRESH-INTERVAL;VALUE=DURATION:PT6H\r\n/)
  assert.match(ics, /X-PUBLISHED-TTL:PT6H\r\n/)
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2, 'zwei Heimspiele (Test + kaputtes Datum fehlen)')
  assert.ok(!ics.includes('Güldenstern'), 'Auswärtsspiel nicht im Heim-Kalender')
  assert.ok(!ics.includes('TEST'), 'Testspiel ausgeblendet')
})

test('Termin: UTC-Zeiten, 2 h Dauer, Ort = Vereinsadresse, Live-Link, SEQUENCE', () => {
  const ics = baueKalender(DATEN, OPT)
  const ev = ics.split('BEGIN:VEVENT')[1].replace(/\r\n /g, '')
  assert.match(ev, /DTSTART:20261011T130000Z/)
  assert.match(ev, /DTEND:20261011T150000Z/)
  assert.match(ev, /SEQUENCE:2\r\n/)
  assert.match(ev, /LAST-MODIFIED:20261005T091200Z/)
  assert.match(ev, /SUMMARY:SV Agathenburg-Dollern – TSV Apensen\r\n/)
  assert.match(ev, /LOCATION:Waldsportplatz Agathenburg\\, Zur Mehrzweckhalle\\, 21684 Agathenburg/)
  assert.match(ev, /DESCRIPTION:Kreisliga Stade · 7\. Spieltag\\nHeimspiel gegen TSV Apensen\\nLive-Ticker\\, Aufstellung & Anfahrt: https:\/\/aga-erste\.de\/live/)
  assert.match(ev, /UID:spiel-0b6f2a44-1111-4aaa-8bbb-000000000001@aga-erste\.de/)
})

test('Escaping im Gegnernamen + Endergebnis im Titel', () => {
  const ics = baueKalender(DATEN, OPT).replace(/\r\n /g, '')
  assert.ok(ics.includes('SUMMARY:SV Agathenburg-Dollern – FC Mulsum\\; Kutenholz\\, II\\\\Ü32 — Gäste mit Ümläut 3:1'))
})

test('alle=1: Auswärtsspiel mit eigenem Ort, Gegner zuerst', () => {
  const ics = baueKalender(DATEN, { ...OPT, alle: true }).replace(/\r\n /g, '')
  assert.match(ics, /X-WR-CALNAME:SV Agathenburg-Dollern – alle Spiele/)
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 3)
  assert.ok(ics.includes('SUMMARY:VfL Güldenstern Stade III – SV Agathenburg-Dollern'))
  assert.ok(ics.includes('LOCATION:Güldenstern-Arena\\, Am Exerzierplatz 1\\, 21680 Stade'))
  assert.ok(ics.includes('Auswärtsspiel gegen VfL Güldenstern Stade III'))
})

test('UID stabil: gleiche Spiel-ID → gleiche UID, unabhängig von Domain, Groß/klein, Änderungen', () => {
  const a = baueKalender(DATEN, OPT)
  const b = baueKalender(
    { ...DATEN, spiele: DATEN.spiele.map((s) => (s.spieltag === 7 ? { ...s, anstoss: '2026-10-11T14:00:00Z', seq: 3 } : s)) },
    { ...OPT, seite: 'https://sva-agathenburg-dollern.netlify.app' },
  )
  const uids = (x) => [...x.matchAll(/UID:(.*)\r\n/g)].map((m) => m[1])
  assert.deepEqual(uids(a), uids(b))
  assert.equal(uidFuer('ABC'), uidFuer('abc'))
  assert.match(b, /SEQUENCE:3/)
  assert.equal(baueKalender(DATEN, OPT), a, 'deterministisch: gleiche Daten → identische Datei')
})

test('Hilfen: Titel/Ort/Name', () => {
  assert.equal(titel({ gegner: 'X', heim: false, toreSva: 2, toreGegner: 0 }), 'X – SV Agathenburg-Dollern 0:2')
  assert.equal(ort({ heim: true, ort: 'Kunstrasen B73, Am Paschberg 1, 21684 Agathenburg' }, DATEN), 'Kunstrasen B73, Am Paschberg 1, 21684 Agathenburg')
  assert.equal(ort({ heim: true }, { spiele: [] }), 'Waldsportplatz Agathenburg, Zur Mehrzweckhalle, 21684 Agathenburg')
  assert.equal(kalenderName(true), 'SV Agathenburg-Dollern – alle Spiele')
})

test('leerer Spielplan: gültiger Kalender ohne Termine', () => {
  const ics = baueKalender({ spiele: [] }, OPT)
  assert.ok(ics.includes('BEGIN:VCALENDAR') && !ics.includes('BEGIN:VEVENT'))
})

test('Einzeltermin: per ID oder exaktem Anstoß, nur echte Spiele, ohne Abo-Kopf', () => {
  const a = findeSpiel(DATEN, { spiel: '0B6F2A44-1111-4AAA-8BBB-000000000002' })
  assert.equal(a?.gegner, 'VfL Güldenstern Stade III', 'ID (Groß/klein egal), auch Auswärtsspiel')
  const b = findeSpiel(DATEN, { anstoss: '2026-10-11T15:00:00+02:00' })
  assert.equal(b?.gegner, 'TSV Apensen', 'Anstoß mit Zeitzonen-Offset = gleicher Zeitpunkt')
  assert.equal(findeSpiel(DATEN, { anstoss: '2026-10-11T15:01:00+02:00' }), null, 'kein Treffer bei anderer Zeit')
  assert.equal(findeSpiel(DATEN, { spiel: "x' or 1=1" }), null, 'Unsinn-ID → nichts')
  assert.equal(findeSpiel(DATEN, {}), null)
  const ics = baueEinzeltermin(b, DATEN, 'https://aga-erste.de')
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1)
  assert.ok(!ics.includes('X-WR-CALNAME') && !ics.includes('REFRESH-INTERVAL'), 'kein Abo-Kopf (sonst legt iOS einen neuen Kalender an)')
  assert.match(ics, /DTSTART:20261011T130000Z\r\n/, '15:00 Europe/Berlin (Sommerzeit) = 13:00 UTC')
  assert.equal(baueEinzeltermin(DATEN.spiele[3], DATEN, 'https://aga-erste.de'), null, 'Testspiel → kein Termin')
})

// ── Validierung mit ical.js (optional, Scratch-Installation) ────────────────
test('ical.js parst den Kalender (Heim + alle) fehlerfrei', { skip: !process.env.ICALJS && 'ICALJS nicht gesetzt' }, async () => {
  const mod = await import(process.env.ICALJS)
  const ICAL = mod.default ?? mod
  for (const alle of [false, true]) {
    const ics = baueKalender(DATEN, { ...OPT, alle })
    const comp = new ICAL.Component(ICAL.parse(ics))
    assert.equal(comp.getFirstPropertyValue('x-wr-calname'), alle ? 'SV Agathenburg-Dollern – alle Spiele' : 'SV Agathenburg-Dollern – Heimspiele')
    const evs = comp.getAllSubcomponents('vevent').map((v) => new ICAL.Event(v))
    assert.equal(evs.length, alle ? 3 : 2)
    for (const e of evs) {
      assert.equal(e.endDate.toUnixTime() - e.startDate.toUnixTime(), 7200, '2 h')
      assert.ok(e.uid.endsWith('@aga-erste.de'))
      assert.ok(e.description.includes('/live'))
    }
    const pokal = evs.find((e) => e.summary.includes('Mulsum'))
    if (pokal) {
      assert.equal(pokal.summary, 'SV Agathenburg-Dollern – FC Mulsum; Kutenholz, II\\Ü32 — Gäste mit Ümläut 3:1', 'Escaping rund: ; , \\ Umlaute')
      assert.equal(pokal.location, 'Waldsportplatz Agathenburg, Zur Mehrzweckhalle, 21684 Agathenburg')
    }
    const ap = evs.find((e) => e.summary.includes('Apensen'))
    assert.equal(ap.startDate.toJSDate().toISOString(), '2026-10-11T13:00:00.000Z')
    assert.equal(ap.sequence, 2)
    assert.equal(ap.description.split('\n').length, 3, 'Zeilenumbrüche in DESCRIPTION')
  }
  const einzel = new ICAL.Component(ICAL.parse(baueEinzeltermin(DATEN.spiele[1], DATEN, 'https://aga-erste.de')))
  const ev = new ICAL.Event(einzel.getFirstSubcomponent('vevent'))
  assert.equal(ev.summary, 'VfL Güldenstern Stade III – SV Agathenburg-Dollern')
  assert.equal(ev.location, 'Güldenstern-Arena, Am Exerzierplatz 1, 21680 Stade')
})

if (process.env.AUSGABE) {
  const quelle = process.env.DATEN ? JSON.parse(fs.readFileSync(process.env.DATEN, 'utf8')) : DATEN
  fs.writeFileSync(process.env.AUSGABE, baueKalender(quelle, { alle: process.env.ALLE === '1', seite: 'https://aga-erste.de' }))
}
