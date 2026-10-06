// v22-T: Gleiche Anmeldung für /tippen und /album (gleiches Konto, storageKey
// 'sva-album-auth', Sitzungs-Anker /api/album-sitzung) — Test mit GEMOCKTER
// Sitzung, KEINE echte Datenbank, KEIN echtes Login, keine Mails.
//   1. In /tippen angemeldet (Sitzung in localStorage) → /album ohne Login drin
//   2. Umgekehrt: Sitzung kommt aus dem Album-Login (über den Sitzungs-Anker
//      wiederhergestellt, localStorage leer) → /tippen erkennt den Fan, und
//      danach ist auch /album ohne erneute Anmeldung drin
//   3. Vorführung: Umschalter „Album“ führt zu /album?vorfuehrung=1 (kein Login)
//   VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 5193 --strictPort
//   BASE=http://localhost:5193 node scripts/tippen-album-sitzung-test.mjs   (ENG=webkit für Safari)
import { chromium, webkit } from 'playwright'
import { lageFixture } from './tippen-fixtures.mjs'

const BASE = process.env.BASE || 'http://localhost:5193'
const ENGINE = process.env.ENG === 'webkit' ? webkit : chromium
const USER = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'lena@fan.example', app_metadata: { provider: 'email' }, user_metadata: { app: 'sva-album' }, created_at: new Date().toISOString() }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 3600 * 24
const JWT = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, email: USER.email, role: 'authenticated', aud: 'authenticated', exp })}.sig`
const SESSION_OBJ = { access_token: JWT, refresh_token: 'r-test', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: USER }
const SESSION = JSON.stringify(SESSION_OBJ)
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) })
const KATALOG = {
  saison: '2026/27', aktiv: true,
  regeln: { chancen: { bronze: 0.6, silber: 0.3, gold: 0.09, spezial: 0.01 }, kartenProPack: 3, fensterVorMin: 60, fensterNachMin: 120, bonusHeimsieg: false, belohnungen: [] },
  karten: [],
}
const MEIN = {
  email: USER.email, saison: '2026/27', profil: { vorname: 'Lena', initial: 'K', anzeigename: 'Lena K.', rangliste: true, erinnerung: false },
  checkins: 1, checkinsGesamt: 1, spiele: [], besitz: [], packs: [], gutscheine: [], ziele: [], lose: 0,
}

let fehler = 0
const log = (ok, msg) => {
  if (!ok) fehler++
  console.log(`${ok ? 'OK    ' : 'FEHLER'} ${msg}`)
}
const browser = await ENGINE.launch()

async function kontext({ mitSitzung, anker }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const spur = { refresh: 0, ankerGet: 0, ankerPost: 0, schreib: [] }
  // Sicherheitsnetz: nichts verlässt den Rechner
  await ctx.route(/mock\.supabase\.co\//, async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const u = new URL(req.url())
    if (u.pathname.includes('/rest/v1/rpc/')) {
      const n = u.pathname.split('/rpc/')[1]
      if (n === 'tipp_lage') return json(route, lageFixture('getippt'))
      if (n === 'album_katalog') return json(route, KATALOG)
      if (n === 'album_mein') return json(route, req.headers().authorization?.includes(JWT) ? MEIN : null)
      if (!/^(tipp_|album_|web_)/.test(n)) spur.schreib.push(n)
      return json(route, null)
    }
    if (u.pathname.endsWith('/auth/v1/user')) return json(route, USER)
    if (u.pathname.endsWith('/auth/v1/token')) {
      spur.refresh++
      return json(route, SESSION_OBJ)
    }
    if (u.pathname.endsWith('/auth/v1/logout')) return json(route, {})
    return json(route, req.method() === 'GET' ? [] : null)
  })
  // Sitzungs-Anker (Netlify-Funktion): GET liefert den Refresh-Token, POST merkt ihn
  await ctx.route('**/api/album-sitzung', (route) => {
    const m = route.request().method()
    if (m === 'GET') {
      spur.ankerGet++
      return json(route, { rt: anker ? 'r-test-anker-123456' : null })
    }
    if (m === 'POST') spur.ankerPost++
    return json(route, { ok: true })
  })
  await ctx.addInitScript(
    ([s, mit]) => {
      try {
        if (mit && !sessionStorage.getItem('x-gesetzt')) localStorage.setItem('sva-album-auth', s)
        sessionStorage.setItem('x-gesetzt', '1')
        localStorage.setItem('sva-tipp-einfuehrung', '1')
        localStorage.setItem('sva-tipp-einfuehrung-vorfuehrung', '1')
      } catch {
        /* */
      }
    },
    [SESSION, mitSitzung],
  )
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  return { ctx, page, spur, errs }
}

const albumDrin = async (page, name = 'album') => {
  await page.waitForTimeout(1500)
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/sitzung-${name}.png` })
  const login = await page.locator('form.al-form input[type="email"]:visible').count()
  // angemeldet = Konto-Knopf „angemeldet als Lena“ im Album-Kopf, kein E-Mail-Formular
  const ich = await page.locator('button.al-ich[aria-label*="Lena"]').count()
  return { drin: login === 0 && ich === 1, login }
}
const tippenDrin = async (page) => {
  await page.waitForSelector('.tp-spieltag', { timeout: 8000 })
  await page.waitForTimeout(600)
  return (await page.locator('a.tp-avatar').count()) === 1 && (await page.locator('.tp-top__login').count()) === 0
}

// 1. /tippen → /album
{
  const { ctx, page, spur, errs } = await kontext({ mitSitzung: true, anker: false })
  await page.goto(`${BASE}/tippen`, { waitUntil: 'networkidle' })
  log(await tippenDrin(page), '1a /tippen: angemeldet (Avatar statt „Anmelden“)')
  const href = await page.locator('.tp-wechsel__b', { hasText: 'Album' }).getAttribute('href')
  log(href === '/album', `1b Umschalter „Album“ → ${href}`)
  await page.locator('.tp-wechsel__b', { hasText: 'Album' }).click()
  await page.waitForURL(/\/album/)
  const a = await albumDrin(page, '1-album')
  log(a.drin, `1c /album ohne erneute Anmeldung drin (Login-Formular: ${a.login})`)
  log(spur.schreib.length === 0, '1d keine schreibenden Aufrufe ' + spur.schreib.join(','))
  log(errs.length === 0, '1e keine Seitenfehler ' + errs.slice(0, 2).join(' | '))
  await ctx.close()
}

// 2. Umgekehrt: Album-Login (Anker) → /tippen → /album
{
  const { ctx, page, spur, errs } = await kontext({ mitSitzung: false, anker: true })
  await page.goto(`${BASE}/tippen`, { waitUntil: 'networkidle' })
  log(await tippenDrin(page), `2a /tippen: Sitzung aus dem Album-Anker wiederhergestellt (Anker GET ${spur.ankerGet}, Refresh ${spur.refresh})`)
  const gespeichert = await page.evaluate(() => !!localStorage.getItem('sva-album-auth'))
  log(gespeichert, '2b Sitzung liegt danach unter „sva-album-auth“ (gemeinsamer Schlüssel)')
  await page.goto(`${BASE}/album`, { waitUntil: 'networkidle' })
  const a = await albumDrin(page, '2-album')
  log(a.drin, '2c /album danach ohne Anmeldung drin')
  log(errs.length === 0, '2d keine Seitenfehler ' + errs.slice(0, 2).join(' | '))
  await ctx.close()
}

// 2e. Ohne Sitzung und ohne Anker: /tippen zeigt „Anmelden“ (Gegenprobe)
{
  const { ctx, page } = await kontext({ mitSitzung: false, anker: false })
  await page.goto(`${BASE}/tippen`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.tp-spieltag', { timeout: 8000 })
  await page.waitForTimeout(500)
  log((await page.locator('.tp-top__login').count()) === 1, '2e Gegenprobe: ohne Sitzung „Anmelden“ sichtbar')
  await ctx.close()
}

// 3. Vorführung → Album-Vorführung
{
  const { ctx, page } = await kontext({ mitSitzung: false, anker: false })
  await page.goto(`${BASE}/tippen?vorfuehrung=1`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.tp-spieltag', { timeout: 8000 })
  const href = await page.locator('.tp-wechsel__b', { hasText: 'Album' }).getAttribute('href')
  log(href === '/album?vorfuehrung=1', `3a Vorführung: Umschalter „Album“ → ${href}`)
  const alle = await page.$$eval('a[href^="/album"]', (l) => l.map((a) => a.getAttribute('href')))
  log(alle.every((h) => h === '/album?vorfuehrung=1'), `3b alle Album-Links der Vorführung behalten den Parameter (${alle.length})`)
  await ctx.close()
}

await browser.close()
console.log(fehler ? `\n${fehler} FEHLER` : '\nalles grün')
process.exit(fehler ? 1 : 0)
