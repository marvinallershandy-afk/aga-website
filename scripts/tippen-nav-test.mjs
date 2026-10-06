// v21-T: Regressionstest untere/obere Navigation von /tippen.
// Handy 390×844 (isMobile) + Desktop, gemockter eingeloggter Fan (wie tippen-audit.mjs).
// Jeder Tab wird mehrfach hin und her geklickt; nach jedem Klick muss der Tab-Inhalt
// sichtbar sein und aria-current stimmen. Zusätzlich: Vorführung (?vorfuehrung=1).
//   VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 5193 --strictPort
//   BASE=http://localhost:5193 node scripts/tippen-nav-test.mjs
import { chromium, webkit } from 'playwright'
import { DUELL, LIGA_TIPPS, LIGEN, VERTEILUNG, lageFixture, ranglisteFixture } from './tippen-fixtures.mjs'

const BASE = process.env.BASE || 'http://localhost:5193'
const USER = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'lena@fan.example', app_metadata: { provider: 'email' }, user_metadata: { app: 'sva-album' }, created_at: new Date().toISOString() }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 3600 * 24
const JWT = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, email: USER.email, role: 'authenticated', aud: 'authenticated', exp })}.sig`
const SESSION = JSON.stringify({ access_token: JWT, refresh_token: 'r-audit', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: USER })
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) })

const MERKMAL = {
  spieltag: '.tp-spieltag',
  rangliste: '.tp-rangliste',
  ligen: '.tp-ligen',
  profil: '.tp-profil',
}
const LABEL = { spieltag: 'Spieltag', rangliste: 'Rangliste', ligen: 'Ligen', profil: 'Profil' }

let fehler = 0
const log = (ok, msg) => {
  if (!ok) fehler++
  console.log(`${ok ? 'OK    ' : 'FEHLER'} ${msg}`)
}

const ENGINE = process.env.ENG === 'webkit' ? webkit : chromium
const browser = await ENGINE.launch()
const VIEWS = {
  m: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  d: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
}

async function lauf(v, lage, pfad = '/tippen') {
  const ctx = await browser.newContext({ ...VIEWS[v], reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' })
  const errs = []
  // Sicherheitsnetz: nie in eine echte Datenbank schreiben (auch wenn BASE die Live-Seite ist)
  await ctx.route(/supabase\.co\//, (route) => (route.request().method() === 'GET' ? route.continue() : json(route, null)))
  await ctx.route('**/rest/v1/rpc/**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const name = new URL(req.url()).pathname.split('/rpc/')[1]
    let args = {}
    try { args = req.postDataJSON() ?? {} } catch { /* leer */ }
    switch (name) {
      case 'tipp_lage': return json(route, lageFixture(lage))
      case 'tipp_rangliste': return json(route, ranglisteFixture(args.p_art, !!args.p_liga))
      case 'tipp_duell': return json(route, DUELL)
      case 'tipp_verteilung': return json(route, VERTEILUNG)
      case 'tipp_meine_ligen': return json(route, LIGEN)
      case 'tipp_liga_tipps': return json(route, LIGA_TIPPS)
      case 'tipp_liga_vorschau': return json(route, { name: 'Stammtisch-Liga', code: args.p_code, mitglieder: 7 })
      default: return json(route, null)
    }
  })
  await ctx.route('**/auth/v1/**', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    if (new URL(route.request().url()).pathname.endsWith('/user')) return json(route, USER)
    return json(route, { error: 'test' }, 400)
  })
  await ctx.addInitScript((s) => { try { localStorage.setItem('sva-album-auth', s); localStorage.setItem('sva-tipp-einfuehrung', '1'); localStorage.setItem('sva-tipp-einfuehrung-vorfuehrung', '1') } catch { /* */ } }, SESSION)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errs.push(e.message))
  await page.goto(`${BASE}${pfad}`, { waitUntil: 'networkidle' })
  await page.waitForSelector(MERKMAL.spieltag, { timeout: 8000 })
  const nav = v === 'm' ? '.tp-tabs--unten' : '.tp-tabs--oben'
  const folge = ['ligen', 'profil', 'spieltag', 'rangliste', 'ligen', 'spieltag', 'profil', 'rangliste', 'profil', 'ligen', 'spieltag', 'ligen', 'profil', 'spieltag']
  for (const [i, t] of folge.entries()) {
    // Tabs verlassen, während noch Daten laden → schneller Doppelwechsel prüfen
    const schnell = i % 4 === 3
    // wie am Handy: erst im Inhalt scrollen, dann tippen (Touch) bzw. klicken
    await page.evaluate((y) => window.scrollBy(0, y), 900 + i * 200)
    await page.waitForTimeout(80)
    const knopf = page.locator(`${nav} a`, { hasText: LABEL[t] })
    const aktion = v === 'm' ? knopf.tap({ timeout: 3000 }) : knopf.click({ timeout: 3000 })
    await aktion.catch((e) => log(false, `[${v}/${lage}] Klick ${t}: ${e.message.split('\n')[0]}`))
    if (!schnell) await page.waitForTimeout(120)
    let ok = true
    try {
      await page.waitForSelector(MERKMAL[t], { state: 'visible', timeout: 2500 })
    } catch {
      ok = false
    }
    const cur = await page.locator(`${nav} a[aria-current="page"]`).textContent().catch(() => '')
    // v21: besuchte Bereiche bleiben erhalten (ausgeblendet) → nur der aktive ist sichtbar
    const andere = await Promise.all(Object.entries(MERKMAL).filter(([k]) => k !== t).map(([, s]) => page.locator(`${s}:visible`).count()))
    log(ok && cur?.includes(LABEL[t]) && andere.every((n) => n === 0), `[${v}/${lage}] #${i + 1} → ${LABEL[t]} (${ok ? 'sichtbar' : 'NICHT sichtbar'}, aktiv: ${cur?.trim()})`)
  }
  // Browser-Zurück: die letzten Wechsel rückwärts (… ligen → profil → spieltag)
  const aktiv = async () => (await page.locator(`${nav} a[aria-current="page"]`).textContent().catch(() => ''))?.trim()
  await page.goBack()
  await page.waitForTimeout(250)
  const z1 = await aktiv()
  await page.goBack()
  await page.waitForTimeout(250)
  const z2 = await aktiv()
  log(z1 === LABEL.profil && z2 === LABEL.ligen && (await page.locator(`${MERKMAL.ligen}:visible`).count()) === 1, `[${v}/${lage}] Browser-Zurück: Profil → Ligen (${z1} → ${z2})`)
  // Zustand bleibt: Rangliste „Monat“ wählen, weg und zurück → Monat noch aktiv
  await page.locator(`${nav} a`, { hasText: 'Rangliste' }).click()
  await page.getByRole('tab', { name: 'Monat' }).click().catch(() => {})
  await page.locator(`${nav} a`, { hasText: 'Ligen' }).click()
  await page.locator(`${nav} a`, { hasText: 'Rangliste' }).click()
  await page.waitForTimeout(200)
  log((await page.getByRole('tab', { name: 'Monat' }).getAttribute('aria-selected').catch(() => null)) === 'true', `[${v}/${lage}] Zustand bleibt erhalten (Wertung „Monat“ nach Tab-Wechsel)`)
  // Wischen am Handy (Touch über CDP): von Rangliste nach links → Ligen
  if (v === 'm' && ENGINE === chromium) {
    const cdp = await ctx.newCDPSession(page)
    const wisch = async (x0, x1) => {
      const y = 330
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] })
      for (let k = 1; k <= 8; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * k) / 8, y }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await page.waitForTimeout(450)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await wisch(330, 90)
    const w1 = await aktiv()
    await wisch(90, 330)
    const w2 = await aktiv()
    log(w1 === LABEL.ligen && w2 === LABEL.rangliste, `[${v}/${lage}] Wischen: Rangliste → Ligen → Rangliste (${w1}, ${w2})`)
  }
  log(errs.length === 0, `[${v}/${lage}] keine Seitenfehler ${errs.slice(0, 2).join(' | ')}`)
  await ctx.close()
}

// Deep-Link #rangliste (und altes ?tab=ligen)
async function deepLink(v, pfad, t) {
  const ctx = await browser.newContext(VIEWS[v])
  await ctx.route(/supabase\.co\//, (route) => json(route, null))
  await ctx.addInitScript(() => { try { localStorage.setItem('sva-tipp-einfuehrung', '1') } catch { /* */ } })
  await ctx.route('**/rest/v1/rpc/**', (route) => {
    const name = new URL(route.request().url()).pathname.split('/rpc/')[1]
    let args = {}
    try { args = route.request().postDataJSON() ?? {} } catch { /* leer */ }
    if (name === 'tipp_lage') return json(route, lageFixture('gast'))
    if (name === 'tipp_rangliste') return json(route, ranglisteFixture(args.p_art, false))
    if (name === 'tipp_duell') return json(route, DUELL)
    return json(route, null)
  })
  const page = await ctx.newPage()
  await page.goto(`${BASE}${pfad}`, { waitUntil: 'networkidle' })
  const ok = await page.waitForSelector(MERKMAL[t], { state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)
  log(ok, `[${v}] Deep-Link ${pfad} öffnet ${LABEL[t]}`)
  await ctx.close()
}

for (const v of ['m', 'd']) {
  for (const lage of ['neu', 'nachspiel', 'live', 'aufloesung', 'gast']) await lauf(v, lage)
}
await deepLink('m', '/tippen#rangliste', 'rangliste')
await deepLink('m', '/tippen?tab=ligen', 'ligen')
await deepLink('d', '/tippen#profil', 'profil')
if (!process.env.OHNE_VORFUEHRUNG) {
  await lauf('m', 'neu', '/tippen?vorfuehrung=1')
  await lauf('d', 'neu', '/tippen?vorfuehrung=1')
}
await browser.close()
console.log(`\n${fehler} Fehler`)
process.exit(fehler ? 1 : 0)
