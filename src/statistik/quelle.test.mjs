// v18-A: Test der Zähl-Hilfen + Abgleich der festen Listen mit der Migration.
//   node src/statistik/quelle.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import { ORTE, SEITEN, QUELLEN, MEDIEN, istBotUa, pfadAusAdresse, quelleErmitteln } from './quelle.ts'

// v20-T: die Pfadliste wurde in der Tipp-Liga-Migration erweitert → beide lesen
const SQL = fs.readFileSync(new URL('../../supabase/migrations/20261009100000_sva_statistik.sql', import.meta.url), 'utf8')
  + fs.readFileSync(new URL('../../supabase/migrations/20261012100000_sva_tippliga.sql', import.meta.url), 'utf8')
const HOST = 'aga-erste.de'
const UA_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
const UA_IG = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 345.0.0.0'

test('Pfade: nur feste Kennungen, nie Query/volle URL', () => {
  assert.equal(pfadAusAdresse('/', ''), '/')
  assert.equal(pfadAusAdresse('/', '#training'), '/#training')
  assert.equal(pfadAusAdresse('/training', ''), '/#training', 'Pfad-Alias vor dem Routing')
  assert.equal(pfadAusAdresse('/', '#tour'), '/#rundgang')
  assert.equal(pfadAusAdresse('/live.html', ''), '/live')
  assert.equal(pfadAusAdresse('/partner/', ''), '/partner')
  assert.equal(pfadAusAdresse('/irgendwas', '#x?y'), '/')
  assert.equal(pfadAusAdresse('/tippen', ''), '/tippen')
  assert.equal(pfadAusAdresse('/tippen.html', ''), '/tippen')
})

test('Quelle aus utm_*', () => {
  assert.equal(quelleErmitteln('?utm_source=instagram&utm_medium=bio', '', HOST, UA_SAFARI), 'instagram:bio')
  assert.equal(quelleErmitteln('?utm_source=instagram&utm_medium=story', 'https://l.instagram.com/', HOST, UA_IG), 'instagram:story')
  assert.equal(quelleErmitteln('?utm_source=IG', '', HOST, UA_SAFARI), 'instagram')
  assert.equal(quelleErmitteln('?utm_source=qr&utm_medium=platz', '', HOST, UA_SAFARI), 'qr:platz')
  assert.equal(quelleErmitteln('?utm_source=whatsapp', '', HOST, UA_SAFARI), 'whatsapp')
  assert.equal(quelleErmitteln('?utm_source=newsletter&utm_medium=<x>', '', HOST, UA_SAFARI), 'sonstige')
})

test('Quelle aus Referrer / In-App-Browser', () => {
  assert.equal(quelleErmitteln('', 'https://l.instagram.com/?u=x', HOST, UA_SAFARI), 'instagram')
  assert.equal(quelleErmitteln('', 'android-app://com.instagram.android/', HOST, UA_SAFARI), 'instagram')
  assert.equal(quelleErmitteln('', 'https://www.google.de/', HOST, UA_SAFARI), 'google')
  assert.equal(quelleErmitteln('', 'https://m.facebook.com/', HOST, UA_SAFARI), 'facebook')
  assert.equal(quelleErmitteln('', 'https://aga-erste.de/live', HOST, UA_SAFARI), 'intern')
  assert.equal(quelleErmitteln('', 'https://fussball.de/x', HOST, UA_SAFARI), 'sonstige')
  assert.equal(quelleErmitteln('', '', HOST, UA_IG), 'instagram', 'Instagram-In-App ohne Referrer')
  assert.equal(quelleErmitteln('', '', HOST, UA_SAFARI), 'direkt')
})

test('Bots', () => {
  assert.ok(istBotUa('Mozilla/5.0 (compatible; Googlebot/2.1)'))
  assert.ok(istBotUa('Mozilla/5.0 HeadlessChrome/128'))
  assert.ok(!istBotUa(UA_SAFARI))
})

test('Listen stimmen mit der Migration überein', () => {
  for (const s of SEITEN) assert.ok(SQL.includes(`'/${s}'`), `Seite /${s} fehlt in der SQL-Liste`)
  for (const o of ORTE) assert.ok(SQL.includes(`'/#${o}'`), `Ort /#${o} fehlt in der SQL-Liste`)
  for (const q of QUELLEN) assert.ok(SQL.includes(`'${q}'`), `Quelle ${q} fehlt`)
  for (const m of MEDIEN) assert.ok(SQL.includes(`'${m}'`), `Medium ${m} fehlt`)
  const ts = fs.readFileSync(new URL('./zaehlen.ts', import.meta.url), 'utf8')
  const block = ts.slice(ts.indexOf('export type Ereignis'), ts.indexOf('\n\n', ts.indexOf('export type Ereignis')))
  const ereignisse = [...block.matchAll(/\| '([a-z-]+)'/g)].map((m) => m[1])
  assert.ok(ereignisse.length >= 8)
  for (const e of ereignisse) assert.ok(SQL.includes(`'#ereignis:${e}'`), `Ereignis ${e} fehlt in der SQL-Liste`)
})
