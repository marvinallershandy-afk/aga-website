// v21-A: /album + Startseiten-Kachel headless screenshotten (Handy 390 px + Desktop).
// KEINE echte DB, KEIN echtes Login: alle RPCs (album_*) und /auth/v1 werden
// gemockt; eine Fan-Sitzung liegt direkt in localStorage ('sva-album-auth').
// Katalog: JSON-Datei (z. B. öffentliche Antwort von album_katalog()) per
// KATALOG_JSON; PHASE=nachher wendet die v21-Bildzuordnung an (wie die
// Migration 20261013200000_sva_album_v21.sql).
//   VITE_SUPABASE_URL=https://audit.supabase.co VITE_SUPABASE_ANON_KEY=anon npx vite --port 5193 --strictPort
//   BASE=http://localhost:5193 OUT=./shots-v21-album/nachher PHASE=nachher KATALOG_JSON=… node scripts/album-v21-audit.mjs
import { chromium, devices } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5193'
const OUT = process.env.OUT || './shots-v21-album'
const PHASE = process.env.PHASE || 'nachher'
const NUR = process.env.NUR || '' // z. B. "karten,ziele"
fs.mkdirSync(OUT, { recursive: true })
const roh = JSON.parse(fs.readFileSync(process.env.KATALOG_JSON, 'utf8'))

// Spiegel der Migration (Titel → neues Bild)
const V21 = {
  'Die Meister-Elf': '/album/karten/meister-elf.webp',
  'Meister-Shirt': '/album/karten/meister-shirt.webp',
  'Ab in die Kurve': '/album/karten/ab-in-die-kurve.webp',
  'Die Umarmung': '/album/karten/umarmung.webp',
  'Der Pokal': '/album/karten/pokal.webp',
  Siegerfoto: '/album/karten/siegerfoto.webp',
  'Einer fliegt': '/album/karten/einer-fliegt.webp',
  'Die Parade': '/album/karten/parade.webp',
  'Die Kurve': '/album/karten/kurve.webp',
  'Die Fahne': '/album/karten/fahne.webp',
  'Das Urknall-Banner': '/album/karten/urknall-banner.webp',
}
const KATALOG = structuredClone(roh)
if (PHASE === 'nachher') {
  for (const k of KATALOG.karten) {
    if (k.typ === 'fan' && k.titel === 'Dodos Raum') k.titel = 'Das Urknall-Banner'
    if (V21[k.titel] && (k.typ === 'fan' || k.typ === 'moment')) {
      k.bildUrl = V21[k.titel]
      k.bildFokus = '50% 50%'
      k.credit = 'picture by Nele'
    }
  }
}
const basis = KATALOG.karten.filter((k) => !k.limitiert && !k.variante)
const ZIELE = [
  ['zwillinge', 'set', 'Die Zwillinge', 'Elias und Noah Pejas im Album.', 2, 2, { karten: 1 }],
  ['warkehr', 'set', 'Die Warkehr-Brüder', 'Isaak und Aaron Warkehr im Album.', 1, 2, { karten: 1 }],
  ['vater_sohn', 'set', 'Vater & Sohn', 'Adolf (Trainerstab) und Tino Ebeling im Album.', 2, 2, { karten: 1 }],
  ...(PHASE === 'nachher' ? [['rote_familie', 'set', 'Die Rote Familie', 'Drei Mann, drei Platzverweise – sammle Brettschneider, Nauerz und Brünjes.', 2, 3, { karten: 1, minSeltenheit: 'silber' }]] : []),
  ['familie_sva', 'set', 'Familie SVA', 'Alle Familien-Paare komplett.', 4, 6, { karten: 3, minSeltenheit: 'gold' }],
  ['meister_2026', 'set', 'Meister 2026', 'Alle Momente der Meistersaison.', 4, 4, { karten: 1, minSeltenheit: 'spezial' }],
  ['die_kurve', 'set', 'Die Kurve', 'Alle Karten der Kurve.', 1, 3, { karten: 1 }],
  ['kapitel_tw', 'kapitel', 'Kapitel komplett: Torwart', null, 2, 2, { karten: 1 }],
  ['kapitel_abw', 'kapitel', 'Kapitel komplett: Abwehr', null, 6, 10, { karten: 1 }],
  ['meilenstein_10', 'meilenstein', '10 % gesammelt', null, 5, 5, { karten: 1, lose: 1 }],
  ['meilenstein_25', 'meilenstein', '25 % gesammelt', null, 11, 11, { karten: 1, lose: 1 }],
  ['meilenstein_50', 'meilenstein', 'Halbzeit: 50 %', null, 18, 21, { karten: 1, lose: 2 }],
  ['meilenstein_100', 'meilenstein', 'Album komplett: 100 %', null, 18, 42, { karten: 1, lose: 5 }],
  ['dauerkarte', 'serie_checkin', 'Dauerkarte', '3 Heimspiele in Folge eingecheckt.', 1, 3, { karten: 1, minSeltenheit: 'gold' }],
  ['tipp_serie', 'serie_tipp', 'Tipp-Serie', '4 Wochen in Folge getippt.', 3, 4, { karten: 1 }],
  ['erster_tausch', 'sozial_tausch', 'Erster Tausch', 'Eine Karte mit einem Freund getauscht.', 0, 1, { karten: 1 }],
  ['tipp_exakt', 'extern', 'Exakt getippt', 'Ergebnis exakt getippt.', 1, 1, { karten: 1, minSeltenheit: 'silber' }],
].map(([schluessel, typ, titel, beschreibung, f, b, belohnung], i) => ({
  id: `z-${i}`, schluessel, typ, titel, beschreibung: beschreibung ?? undefined, fortschritt: f, benoetigt: b, erreicht: f >= b,
  erreichtAt: f >= b ? new Date(Date.now() - i * 864e5).toISOString() : undefined, belohnung,
}))
const mein = () => ({
  email: 'marvin@fan.example', saison: KATALOG.saison,
  profil: { vorname: 'Marvin', initial: 'A', anzeigename: 'Marvin A.', rangliste: true, erinnerung: false },
  checkins: 4, checkinsGesamt: 4, spiele: [],
  besitz: basis.filter((k, i) => k.typ === 'fan' || k.typ === 'moment' || i % 3 === 0).map((k, i) => ({ karteId: k.id, anzahl: i % 5 === 0 ? 2 : 1 })),
  packs: [{ id: 'pk-1', art: 'tipp', anzahl: 1, at: new Date().toISOString(), titel: 'Tipp-Karte' }],
  gutscheine: [], freundCode: 'K7P3QX', freunde: ['Lena B.'], abzeichen: ['TW'], tausche: [], tauscheWoche: 0, kontoTage: 12,
  starterOffen: false, advent: null, ziele: ZIELE, naechstesZiel: ZIELE.find((z) => !z.erreicht && z.typ !== 'extern'),
  lose: 7, loseVerlauf: [],
  verlosungen: [{ id: 'v1', titel: 'Trikot der Saison', preis: 'Original-Heimtrikot mit Flock', bildUrl: '/album/karten/meister-shirt-640.webp', stichtag: new Date(Date.now() + 20 * 864e5).toISOString(), status: 'offen', teilnahme: true }],
})
const USER = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'marvin@fan.example', app_metadata: { provider: 'email' }, user_metadata: { app: 'sva-album' }, created_at: new Date().toISOString() }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 3600 * 24
const JWT = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, email: USER.email, role: 'authenticated', aud: 'authenticated', exp, user_metadata: { app: 'sva-album' } })}.sig`
const SESSION = JSON.stringify({ access_token: JWT, refresh_token: 'r-audit', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: USER })

const fehler = []
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) })
async function routes(ctx) {
  await ctx.route('**/rest/v1/rpc/**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } })
    const fn = new URL(req.url()).pathname.split('/rpc/')[1]
    if (fn === 'album_katalog') return json(route, KATALOG)
    if (fn === 'album_mein') return json(route, mein())
    if (fn === 'album_rangliste') return json(route, [{ platz: 1, name: 'Lena B.', checkins: 6, karten: 31 }, { platz: 2, name: 'Marvin A.', checkins: 4, karten: 22, ich: true }])
    return json(route, { code: 'P0001', message: 'unbekannt ' + fn }, 400)
  })
  await ctx.route('**/auth/v1/**', async (route) => {
    const u = new URL(route.request().url())
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } })
    if (u.pathname.endsWith('/user')) return json(route, USER)
    return json(route, { error: 'audit' }, 400)
  })
}
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
async function seite(label, { desktop = false, login = true } = {}) {
  const ctx = await browser.newContext(desktop ? { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 } : { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await routes(ctx)
  if (login) await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('audit-init')) { localStorage.setItem('sva-album-auth', s); sessionStorage.setItem('audit-init', '1') } } catch { /* */ } }, SESSION)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => fehler.push(`[${label}] pageerror ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 40\d/.test(m.text())) fehler.push(`[${label}] ${m.text().slice(0, 200)}`) })
  return { ctx, page }
}
const warte = (page, ms) => page.waitForTimeout(ms)
const bilderFertig = (page) => page.evaluate(async () => { await Promise.all([...document.images].filter((i) => i.loading !== 'lazy' || i.getBoundingClientRect().top < innerHeight * 2).map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000) })))) })
const slug = (s) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const soll = (teil) => !NUR || NUR.split(',').includes(teil)

async function heftAuf(page) {
  await page.goto(`${BASE}/album`, { waitUntil: 'networkidle' })
  await warte(page, 600)
  await page.locator('.al-cover').click()
  await warte(page, 1100)
}
async function reiter(page, re) {
  await page.locator('.hf-reiter__b').filter({ hasText: re }).first().click()
  await warte(page, 1100)
  await bilderFertig(page)
}

// 1) Fan- und Moment-Karten groß (Detail) + Kapitelseiten
if (soll('karten')) {
  const { ctx, page } = await seite('karten')
  await heftAuf(page)
  for (const [re, name] of [[/^Momente/, 'momente'], [/^Kurve/, 'kurve']]) {
    await reiter(page, re)
    await page.screenshot({ path: `${OUT}/kapitel-${name}-handy.png`, fullPage: true })
    const knoepfe = page.locator('.hf-platz__btn')
    const n = await knoepfe.count()
    for (let i = 0; i < n; i++) {
      const label = (await knoepfe.nth(i).getAttribute('aria-label')) ?? `karte-${i}`
      await knoepfe.nth(i).click()
      await page.waitForSelector('.al-detail__karte')
      await warte(page, 900)
      await bilderFertig(page)
      await page.locator('.al-detail__karte').screenshot({ path: `${OUT}/karte-${slug(label.replace(/^Nr\. \d+: /, '').replace(/,.*/, ''))}.png` })
      await page.locator('.al-x').click()
      await warte(page, 300)
    }
  }
  await ctx.close()
}

// 2) Album-Header + Start-Seite + Sammel-Seite (Ziele, Lose) — Handy + Desktop
for (const desktop of [false, true]) {
  if (!soll('album')) break
  const tag = desktop ? 'desktop' : 'handy'
  const { ctx, page } = await seite('album-' + tag, { desktop })
  await page.goto(`${BASE}/album`, { waitUntil: 'networkidle' })
  await warte(page, 900)
  await page.screenshot({ path: `${OUT}/cover-${tag}.png` })
  await page.locator('.al-cover').click()
  await warte(page, 1300)
  await bilderFertig(page)
  await page.screenshot({ path: `${OUT}/header-start-${tag}.png` })
  await page.locator('.al-top').screenshot({ path: `${OUT}/header-${tag}.png` })
  await reiter(page, /^Sammeln/)
  await warte(page, 1400)
  // fullPage scheitert im Handy-Profil bei langen Seiten → Fenster strecken
  const vp = page.viewportSize()
  const hoehe = await page.evaluate(() => Math.min(3600, document.documentElement.scrollHeight))
  await page.setViewportSize({ width: vp.width, height: hoehe })
  await warte(page, 1600)
  await page.screenshot({ path: `${OUT}/sammeln-${tag}.png` })
  await page.setViewportSize(vp)
  const z = page.locator('.sa-ziele, .zm').first()
  if (await z.count()) await z.screenshot({ path: `${OUT}/ziele-${tag}.png` })
  const lose = page.locator('.sa-lose, .ls').first()
  if (await lose.count()) await lose.locator('xpath=..').screenshot({ path: `${OUT}/lose-${tag}.png` })
  await reiter(page, /^Mittelfeld|^Mitte/)
  await page.screenshot({ path: `${OUT}/kapitel-mitte-${tag}.png` })
  if (desktop) {
    const p = page.locator('.hf-platz__btn').first()
    const b = await p.boundingBox()
    if (b) {
      await page.mouse.move(b.x + b.width * 0.8, b.y + b.height * 0.3)
      await warte(page, 500)
      await page.screenshot({ path: `${OUT}/kapitel-hover-desktop.png`, clip: { x: Math.max(0, b.x - 40), y: Math.max(0, b.y - 40), width: b.width * 3 + 80, height: b.height + 80 } })
    }
  }
  await ctx.close()
}

// 3) Startseite (Karte) mit Album-Kachel — eingeloggt
for (const desktop of [false, true]) {
  if (!soll('start')) break
  const tag = desktop ? 'desktop' : 'handy'
  const { ctx, page } = await seite('start-' + tag, { desktop })
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.alb-t--karte', { timeout: 30000 }).catch(() => {})
  await warte(page, 9000)
  await page.screenshot({ path: `${OUT}/startseite-${tag}.png` })
  const k = page.locator('.alb-t--karte')
  if (await k.count()) await k.screenshot({ path: `${OUT}/startseite-kachel-${tag}.png` }).catch(() => {})
  await ctx.close()
}

// 4) Handy-Profil: Bildrate beim Scrollen über Kapitel + Sammel-Seite (CPU 4× gedrosselt)
if (soll('perf')) {
  const { ctx, page } = await seite('perf')
  const cdp = await ctx.newCDPSession(page)
  await heftAuf(page)
  const messe = async (name) => {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    const r = await page.evaluate(async () => {
      const zeiten = []
      let t0 = performance.now()
      let lauf = true
      const tick = (t) => { zeiten.push(t - t0); t0 = t; if (lauf) requestAnimationFrame(tick) }
      requestAnimationFrame(tick)
      const ende = performance.now() + 3000
      while (performance.now() < ende) { window.scrollBy(0, 9); await new Promise((r) => setTimeout(r, 16)) }
      lauf = false
      const f = zeiten.slice(2)
      const mittel = f.reduce((a, b) => a + b, 0) / f.length
      return { fps: Math.round(1000 / mittel), lang: f.filter((x) => x > 34).length, frames: f.length }
    })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    console.log(`FPS ${name}: ${r.fps} (Frames ${r.frames}, > 34 ms: ${r.lang})`)
    fs.appendFileSync(`${OUT}/fps.txt`, `${name}: ${r.fps} fps, ${r.lang} lange Frames von ${r.frames}\n`)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await messe('Start-Seite')
  await reiter(page, /^Sammeln/)
  await page.evaluate(() => window.scrollTo(0, 0))
  await messe('Sammeln (Medaillen, Lose)')
  await reiter(page, /^Mitte/)
  await page.evaluate(() => window.scrollTo(0, 0))
  await messe('Kapitel Mittelfeld')
  await ctx.close()
}

await browser.close()
fs.writeFileSync(`${OUT}/fehler.txt`, fehler.join('\n') || 'keine')
console.log('Screens:', OUT, '· Fehler:', fehler.length)
for (const f of fehler.slice(0, 20)) console.log(' ', f)
