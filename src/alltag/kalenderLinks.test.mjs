// v18-A: Unit-Test der Kalender-Links (Google/Outlook/Apple, Abo).
//   node src/alltag/kalenderLinks.test.mjs
// Kernfrage: Anstoß 15:00 Europe/Berlin muss im Kalender 15:00 ergeben —
// im Sommer (MESZ, UTC+2) wie im Winter (MEZ, UTC+1).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  googleTerminUrl,
  outlookTerminUrl,
  appleTerminUrl,
  aboUrls,
  erkenneGeraet,
  reihenfolge,
} from './kalenderLinks.ts'

const ADR = 'Waldsportplatz Agathenburg, Zur Mehrzweckhalle, 21684 Agathenburg'
const SEITE = 'https://aga-erste.de'
// So kommt der Anstoß aus der DB (timestamptz) bzw. aus dem Build-Overlay
const SOMMER = { gegner: 'TSV Apensen', heim: true, anstoss: '2026-10-11T15:00:00+02:00', wettbewerb: 'Kreisliga Stade' }
const WINTER = { gegner: 'FC Mulsum/Kutenholz; II, „Ü“', heim: false, anstoss: '2026-11-15T14:00:00Z', ort: 'Sportplatz Mulsum, Dorfstr. 1, 21717 Mulsum' }

/** Zeit in Europe/Berlin, wie ein Kalender sie anzeigt */
const berlin = (utcKompakt) => {
  const d = new Date(utcKompakt.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'))
  return d.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
}

test('Google: URL-Format + 15:00 Berlin (Sommerzeit) = 13:00Z, Dauer 2 h', () => {
  const u = new URL(googleTerminUrl(SOMMER, SEITE, ADR))
  assert.equal(u.origin + u.pathname, 'https://calendar.google.com/calendar/render')
  assert.equal(u.searchParams.get('action'), 'TEMPLATE')
  assert.equal(u.searchParams.get('dates'), '20261011T130000Z/20261011T150000Z')
  const [a, b] = u.searchParams.get('dates').split('/')
  assert.equal(berlin(a), '11.10., 15:00')
  assert.equal(berlin(b), '11.10., 17:00')
  assert.equal(u.searchParams.get('text'), 'SV Agathenburg-Dollern – TSV Apensen')
  assert.equal(u.searchParams.get('location'), ADR, 'Heimspiel ohne Ort → Vereinsadresse')
  assert.ok(u.searchParams.get('details').includes('https://aga-erste.de/live'))
  assert.equal(u.searchParams.get('ctz'), 'Europe/Berlin')
})

test('Google: Winterzeit — 15:00 Berlin (MEZ) = 14:00Z', () => {
  const u = new URL(googleTerminUrl(WINTER, SEITE, ADR))
  assert.equal(u.searchParams.get('dates'), '20261115T140000Z/20261115T160000Z')
  assert.equal(berlin('20261115T140000Z'), '15.11., 15:00')
  assert.equal(u.searchParams.get('text'), 'FC Mulsum/Kutenholz; II, „Ü“ – SV Agathenburg-Dollern', 'Sonderzeichen sauber kodiert')
  assert.equal(u.searchParams.get('location'), WINTER.ort)
})

test('Outlook: URL-Format + ISO-UTC-Zeiten', () => {
  const u = new URL(outlookTerminUrl(SOMMER, SEITE, ADR))
  assert.equal(u.origin + u.pathname, 'https://outlook.live.com/calendar/0/deeplink/compose')
  assert.equal(u.searchParams.get('rru'), 'addevent')
  assert.equal(u.searchParams.get('path'), '/calendar/action/compose')
  assert.equal(u.searchParams.get('startdt'), '2026-10-11T13:00:00Z')
  assert.equal(u.searchParams.get('enddt'), '2026-10-11T15:00:00Z')
  assert.equal(new Date(u.searchParams.get('startdt')).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }), '15:00')
  assert.equal(u.searchParams.get('subject'), 'SV Agathenburg-Dollern – TSV Apensen')
  assert.equal(u.searchParams.get('location'), ADR)
  const w = new URL(outlookTerminUrl(WINTER, SEITE, ADR))
  assert.equal(w.searchParams.get('startdt'), '2026-11-15T14:00:00Z')
})

test('Apple: echte ICS-URL — per Spiel-ID oder Anstoß (UTC)', () => {
  assert.equal(appleTerminUrl({ ...SOMMER, id: 'abc-1' }, 'https://aga-erste.de/'), 'https://aga-erste.de/kalender.ics?spiel=abc-1')
  assert.equal(appleTerminUrl(SOMMER, 'https://aga-erste.de'), 'https://aga-erste.de/kalender.ics?anstoss=2026-10-11T13%3A00%3A00Z')
})

test('ungültiger Anstoß → kein Link', () => {
  const kaputt = { ...SOMMER, anstoss: 'demnächst' }
  assert.equal(googleTerminUrl(kaputt, SEITE, ADR), null)
  assert.equal(outlookTerminUrl(kaputt, SEITE, ADR), null)
  assert.equal(appleTerminUrl(kaputt, SEITE), null)
})

test('Abo: webcal, Google-cid, Outlook „aus dem Internet“', () => {
  const a = aboUrls('https://aga-erste.de', false)
  assert.equal(a.https, 'https://aga-erste.de/kalender.ics')
  assert.equal(a.webcal, 'webcal://aga-erste.de/kalender.ics')
  assert.equal(a.google, 'https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2Faga-erste.de%2Fkalender.ics')
  assert.equal(new URL(a.google).searchParams.get('cid'), 'webcal://aga-erste.de/kalender.ics')
  const o = new URL(a.outlook)
  assert.equal(o.origin + o.pathname, 'https://outlook.live.com/calendar/0/addfromweb')
  assert.equal(o.searchParams.get('url'), 'https://aga-erste.de/kalender.ics')
  assert.equal(o.searchParams.get('name'), 'SV Agathenburg-Dollern – Heimspiele')
  assert.equal(aboUrls('https://aga-erste.de', true).https, 'https://aga-erste.de/kalender-alle.ics')
})

test('Geräte-Erkennung → Reihenfolge', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
  const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36'
  const win = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36'
  const ig = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) Instagram 345.0.0 Android'
  assert.equal(erkenneGeraet(iphone), 'apple')
  assert.equal(erkenneGeraet(ipad), 'apple')
  assert.equal(erkenneGeraet(android), 'android')
  assert.equal(erkenneGeraet(ig), 'android')
  assert.equal(erkenneGeraet(win), 'windows')
  assert.equal(erkenneGeraet('Mozilla/5.0 (X11; Linux x86_64)'), 'sonst')
  assert.deepEqual(reihenfolge('apple'), ['apple', 'google', 'outlook'])
  assert.deepEqual(reihenfolge('android'), ['google', 'apple', 'outlook'])
  assert.deepEqual(reihenfolge('windows'), ['outlook', 'google', 'apple'])
})
