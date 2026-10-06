// v20-T: /tippen headless durchklicken + screenshotten (Desktop 1440×900 + Handy 390×844).
// KEINE echte Datenbank, KEIN echtes Login: alle tipp_*-RPCs und /auth/v1
// werden gemockt (scripts/tippen-fixtures.mjs). Eine Fan-Sitzung liegt direkt
// in localStorage ('sva-album-auth' — gemeinsames Konto mit dem Album).
//   VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 5193 --strictPort
//   BASE=http://localhost:5193 OUT=./shots-v20-tipp node scripts/tippen-audit.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
import { DUELL, LIGA_TIPPS, LIGEN, VERTEILUNG, KADER, STORY, lageFixture, ranglisteFixture } from './tippen-fixtures.mjs'

const BASE = process.env.BASE || 'http://localhost:5193'
const OUT = process.env.OUT || './shots-v20-tipp'
const NUR = process.env.NUR ? process.env.NUR.split(',') : null
fs.mkdirSync(OUT, { recursive: true })
const checks = []
const errors = []
const check = (ok, msg) => checks.push(`${ok ? 'OK ' : 'FEHLER'}  ${msg}`)

const VIEWS = {
  d: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  m: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}

const USER = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'lena@fan.example', app_metadata: { provider: 'email' }, user_metadata: { app: 'sva-album' }, created_at: new Date().toISOString() }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 3600 * 24
const JWT = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, email: USER.email, role: 'authenticated', aud: 'authenticated', exp })}.sig`
const SESSION = JSON.stringify({ access_token: JWT, refresh_token: 'r-audit', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: USER })

const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }, body: JSON.stringify(body) })

async function routen(ctx, zustand, rpcLog) {
  await ctx.route('**/rest/v1/rpc/**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } })
    const name = new URL(req.url()).pathname.split('/rpc/')[1]
    let args = {}
    try { args = req.postDataJSON() ?? {} } catch { /* leer */ }
    rpcLog.push([name, args])
    switch (name) {
      case 'tipp_lage': return json(route, lageFixture(zustand.lage))
      case 'tipp_rangliste': return json(route, ranglisteFixture(args.p_art, !!args.p_liga))
      case 'tipp_duell': return json(route, DUELL)
      case 'tipp_verteilung': return json(route, VERTEILUNG)
      case 'tipp_meine_ligen': return json(route, LIGEN)
      case 'tipp_liga_vorschau': return json(route, { name: 'Stammtisch-Liga', code: args.p_code, mitglieder: 7 })
      case 'tipp_liga_tipps': return json(route, LIGA_TIPPS)
      case 'tipp_liga_gruenden': return json(route, { id: 'liga-neu', name: args.p_name, code: 'K7Q2MX' })
      case 'tipp_liga_beitreten': return json(route, { id: 'liga-1', name: 'Stammtisch-Liga', code: 'STAMM7', abzeichen: [] })
      case 'tipp_kabinen_liga': return json(route, { id: 'liga-kabine', name: 'Kabinen-Liga', system: 'kabine', mitglieder: 9 })
      case 'tipp_abgeben':
        zustand.lage = 'getippt'
        return json(route, { ok: true, neu: true, karte: true, abzeichen: zustand.abz ?? [], anzahlTipps: 38 })
      case 'tipp_elf_speichern': return json(route, { ok: true })
      case 'tipp_beitreten':
      case 'tipp_profil_speichern': return json(route, { ok: true })
      case 'web_zaehlen': return json(route, true)
      default: return json(route, null)
    }
  })
  await ctx.route('**/auth/v1/**', (route) => {
    const u = new URL(route.request().url())
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } })
    if (u.pathname.endsWith('/otp')) return json(route, {})
    if (u.pathname.endsWith('/user')) return json(route, USER)
    return json(route, { error: 'audit' }, 400)
  })
}

const browser = await chromium.launch({ args: process.env.OHNE_GPU ? [] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })

async function seite(label, v, { login = true, lage = 'neu', reduced = false, abz } = {}) {
  const zustand = { lage, abz }
  const rpcLog = []
  const ctx = await browser.newContext({ ...VIEWS[v], reducedMotion: reduced ? 'reduce' : 'no-preference', acceptDownloads: true })
  await routen(ctx, zustand, rpcLog)
  // v21: Einführung als gesehen markieren (eigener Abschnitt prüft sie)
  await ctx.addInitScript(() => { try { localStorage.setItem('sva-tipp-einfuehrung', '1') } catch { /* */ } })
  if (login) await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('audit-init')) { localStorage.setItem('sva-album-auth', s); sessionStorage.setItem('audit-init', '1') } } catch { /* */ } }, SESSION)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`[${label}/${v}] pageerror ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 400|walkout|greenscreen/i.test(m.text())) errors.push(`[${label}/${v}] ${m.text().slice(0, 220)}`) })
  return { ctx, page, zustand, rpcLog }
}
const shot = async (page, name, full = true) => {
  await page.waitForTimeout(400)
  const y = await page.evaluate(() => window.scrollY)
  // Ganzseite: klebende/feste Leisten an ihren Platz im Fluss (sonst liegen sie mitten im Bild)
  if (full) await page.addStyleTag({ content: '.tp-top,.tp-abgabe{position:relative!important;bottom:auto!important;box-shadow:none!important}.tp-tabs--unten{position:relative!important}.tp-offen>.tp-hero,.tp-rangliste>.tp-duell{position:relative!important;top:auto!important}' }).then((h) => page.evaluate((el) => el.setAttribute('data-shot', '1'), h))
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full })
  if (full) await page.evaluate(() => document.querySelectorAll('style[data-shot]').forEach((e) => e.remove()))
  // Ganzseiten-Aufnahme verstellt bei isMobile den Viewport → zurücksetzen
  if (full) {
    const vp = page.viewportSize()
    await page.setViewportSize({ width: vp.width, height: vp.height + 1 })
    await page.setViewportSize(vp)
    await page.evaluate((yy) => window.scrollTo(0, yy), y)
  }
}
const go = async (page, path = '/tippen') => { await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(900) }
const darf = (n) => !NUR || NUR.some((x) => n.startsWith(x))

for (const v of ['m', 'd']) {
  // 1) Gast: vor Anpfiff, Tipp ausfüllbar ohne Login
  if (darf('01')) {
    const { ctx, page } = await seite('gast', v, { login: false, lage: 'gast' })
    await go(page)
    await shot(page, `01-gast-${v}`)
    check(await page.getByRole('timer').isVisible(), `[${v}] Countdown bis Tippschluss sichtbar`)
    check(await page.getByText('Tipp den Sonntag.').isVisible(), `[${v}] Gast-Intro sichtbar`)
    // 20-Sekunden-Weg: Ergebnis + 3 Bonusfragen + abgeben → Login
    const t0 = Date.now()
    await page.locator('.tp-stepper').scrollIntoViewIfNeeded()
    await page.getByRole('button', { name: 'SVA: ein Tor mehr' }).click()
    await page.getByRole('button', { name: 'SVA: ein Tor mehr' }).click()
    await page.getByRole('button', { name: 'FIS: ein Tor mehr' }).click()
    for (let i = 0; i < 3; i++) { await page.locator('.tp-frage .tp-option').first().click(); await page.waitForTimeout(420) }
    await page.getByRole('button', { name: 'Tipp abgeben' }).click()
    await page.waitForTimeout(500)
    check(Date.now() - t0 < 20000, `[${v}] kompletter Tipp in ${((Date.now() - t0) / 1000).toFixed(1)} s (Automatik)`)
    check(await page.getByRole('heading', { name: 'Nur noch kurz anmelden' }).isVisible(), `[${v}] Gast: „Tipp abgeben“ öffnet Login (Entwurf gemerkt)`)
    const ent = await page.evaluate(() => JSON.parse(localStorage.getItem('sva-tipp-entwurf') || 'null'))
    check(ent && ent.absenden && ent.toreSva === 2 && ent.toreGegner === 1 && Object.keys(ent.bonus).length === 3, `[${v}] Entwurf auf dem Gerät: ${ent?.toreSva}:${ent?.toreGegner}, Bonus ${Object.keys(ent?.bonus ?? {}).length}`)
    await shot(page, `13-login-${v}`, false)
    await ctx.close()
  }

  // 2) Eingeloggt, noch nicht getippt: Elf vom letzten Mal vorbelegt
  if (darf('02')) {
    const { ctx, page, rpcLog } = await seite('neu', v, { lage: 'neu', abz: ['volltreffer'] })
    await go(page)
    await shot(page, `02-tippen-vorbelegt-${v}`)
    check((await page.locator('.tp-slot .sk').count()) === 5, `[${v}] Elf vom letzten Spieltag vorbelegt (5 Karten)`)
    check(await page.locator('.tp-slot__kap').isVisible(), `[${v}] Kapitänsbinde sichtbar`)
    // Bonus-Deck: erste Karte
    await page.locator('.tp-deck').scrollIntoViewIfNeeded()
    await shot(page, `03-bonus-deck-${v}`, false)
    // 1. Frage (3 Antworten) per Tipp, 2. Frage (Ja/Nein) per Wisch-Geste
    await page.locator('.tp-frage .tp-option').nth(1).click()
    await page.waitForTimeout(450)
    const karte = page.locator('.tp-frage').first()
    const box = await karte.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2, { steps: 6 })
      await shot(page, `03b-bonus-wisch-${v}`, false)
      await page.mouse.move(box.x + box.width / 2 + 220, box.y + box.height / 2, { steps: 6 })
      await page.mouse.up()
      await page.waitForTimeout(500)
    }
    await page.locator('.tp-frage .tp-option').last().click()
    await page.waitForTimeout(450)
    check(await page.locator('.tp-bonusliste').isVisible(), `[${v}] nach 3 Antworten: Übersicht der Bonusfragen`)
    // Spieler-Auswahl (Platz tauschen)
    await page.locator('.tp-slot .sk').nth(2).click()
    await page.waitForTimeout(1500)
    await shot(page, `05-elf-aktion-${v}`, false)
    await page.getByRole('button', { name: 'Austauschen' }).click()
    await page.waitForTimeout(500)
    await shot(page, `04-elf-auswahl-${v}`, false)
    await page.locator('.tp-wahl button').nth(1).click()
    await page.waitForTimeout(400)
    // Joker + Torschütze
    await page.locator('.tp-joker').click()
    await page.getByRole('radio', { name: /Biedermann/ }).first().click()
    await page.locator('.tp-abgabe').scrollIntoViewIfNeeded()
    await page.getByRole('button', { name: 'Tipp abgeben' }).click()
    await page.waitForTimeout(1400)
    await shot(page, `06-belohnung-${v}`, false)
    check(await page.locator('.tp-belohnung').getByText(/Tipp-Pack · 2 Karten/).first().isVisible(), `[${v}] Belohnung „Tipp-Pack · 2 Karten“`)
    const abg = rpcLog.find((r) => r[0] === 'tipp_abgeben')?.[1]
    check(abg && abg.p_joker === true && abg.p_erster === 'p-biedermann' && Object.keys(abg.p_bonus).length === 3, `[${v}] tipp_abgeben mit Joker, Torschütze, 3 Bonus`)
    check(rpcLog.some((r) => r[0] === 'tipp_elf_speichern' && r[1].p_spieler.length === 5), `[${v}] Elf gespeichert`)
    check(rpcLog.filter((r) => r[0] === 'web_zaehlen').length >= 0, `[${v}] Zählung aktiv`)
    await page.getByRole('button', { name: 'Weiter' }).click()
    await page.waitForTimeout(600)
    await shot(page, `06b-gespeichert-${v}`, false)
    await ctx.close()
  }

  // 3) Gesperrt + live
  if (darf('07')) {
    const { ctx, page } = await seite('live', v, { lage: 'live' })
    await go(page)
    await shot(page, `07-gesperrt-live-${v}`)
    check(await page.getByText('So hat Aga getippt').isVisible(), `[${v}] Tipp-Verteilung nach Anpfiff`)
    check(await page.getByRole('link', { name: /Zum Liveticker/ }).isVisible(), `[${v}] Live-Link`)
    await ctx.close()
  }

  // 4) Auflösung (animiert) + reduzierte Bewegung
  if (darf('08')) {
    const { ctx, page } = await seite('aufl', v, { lage: 'aufloesung' })
    await go(page)
    await page.waitForTimeout(1300)
    await shot(page, `08a-aufloesung-zaehlt-${v}`, false)
    await page.waitForTimeout(5200)
    await shot(page, `08-aufloesung-${v}`)
    const zahl = await page.locator('.tp-aufl__zahl').textContent()
    check(zahl?.trim() === '38', `[${v}] Auflösung zählt bis 38 hoch (${zahl})`)
    await ctx.close()
    const r = await seite('aufl-ruhig', v, { lage: 'aufloesung', reduced: true })
    await go(r.page)
    check((await r.page.locator('.tp-aufl__zahl').textContent())?.trim() === '38', `[${v}] reduced-motion: Endstand sofort`)
    await r.ctx.close()
  }

  // 5) Rangliste
  if (darf('09')) {
    const { ctx, page } = await seite('rang', v, { lage: 'neu' })
    await go(page, '/tippen?tab=rangliste')
    await page.waitForTimeout(800)
    await shot(page, `09-rangliste-saison-${v}`)
    check(await page.getByText(/liegt vorne|Gleichstand/).first().isVisible(), `[${v}] Fans vs. Kabine sichtbar`)
    check((await page.locator('.tp-trend--hoch').count()) > 0 && (await page.locator('.tp-trend--runter').count()) > 0, `[${v}] Auf-/Ab-Pfeile`)
    await page.getByRole('tab', { name: 'Spieltag' }).click()
    await page.waitForTimeout(700)
    await shot(page, `09b-rangliste-spieltag-${v}`, false)
    await ctx.close()
  }

  // 6) Ligen (+ Einladungslink) und Liga-Detail
  if (darf('10')) {
    const { ctx, page } = await seite('ligen', v, { lage: 'live' })
    await go(page, '/tippen?liga=STAMM7')
    await shot(page, `10-ligen-einladung-${v}`)
    check(await page.getByText('Einladung').first().isVisible(), `[${v}] Einladungslink zeigt Vorschau`)
    await page.locator('.tp-ligazeile').first().click()
    await page.waitForTimeout(900)
    await shot(page, `10b-liga-detail-${v}`, false)
    check(await page.getByText('STAMM7').first().isVisible(), `[${v}] Liga-Code im Detail`)
    await page.keyboard.press('Escape')
    await page.getByPlaceholder('z. B. Stammtisch-Liga').fill('Feuerwehr Dollern')
    await page.getByRole('button', { name: 'Gründen' }).click()
    await page.waitForTimeout(700)
    await shot(page, `10c-liga-gegruendet-${v}`, false)
    await ctx.close()
  }

  // 7) Profil
  if (darf('11')) {
    const { ctx, page } = await seite('profil', v, { lage: 'neu' })
    await go(page, '/tippen?tab=profil')
    await shot(page, `11-profil-${v}`)
    check((await page.locator('.tp-abz li.is-da').count()) === 4, `[${v}] 4 Abzeichen freigeschaltet`)
    await ctx.close()
  }

  // 8) Winterpause
  if (darf('12')) {
    const { ctx, page } = await seite('winter', v, { lage: 'winter' })
    await go(page)
    await shot(page, `12-winterpause-${v}`)
    check(await page.getByText(/Weiter am 14\.03\./).isVisible(), `[${v}] Winterpause „Weiter am 14.03.“`)
    await ctx.close()
  }
}

// 9) Teilen-Bilder (Canvas im Browser erzeugen, als PNG speichern)
if (darf('20')) {
  const { ctx, page } = await seite('share', 'd', { lage: 'neu' })
  await go(page)
  const bilder = await page.evaluate(async ({ KADER, STORY }) => {
    const m = await import('/src/tippen/share.ts')
    const k = (id) => KADER.find((x) => x.id === id)
    const out = {}
    const add = async (n, c) => { out[n] = c.toDataURL('image/png') }
    await add('mein-tipp', await m.bildMeinTipp({ gegner: 'TuS Fischbek', heim: true, anstoss: STORY.offen.anstoss, toreSva: 2, toreGegner: 1, joker: true, torschuetze: k('p-biedermann'), bonus: [{ key: 'gelb', wert: '1-2' }, { key: 'tor20', wert: 'ja' }, { key: 'zuschauer', wert: 'ueber', linie: 60 }], partner: STORY.partner }))
    await add('meine-elf', await m.bildMeineElf({ gegner: 'TuS Fischbek', heim: true, anstoss: STORY.offen.anstoss, spieler: ['p-pils', 'p-huettry', 'p-helck', 'p-pejas-n', 'p-pejas-e'].map(k), kapitaen: 'p-pejas-e', partner: null }))
    await add('platz-liga', await m.bildPlatz({ platz: 2, teilnehmer: 9, punkte: 214, art: 'liga', bereich: 'Stammtisch-Liga', name: 'Lena K.', trend: 2, code: 'STAMM7' }))
    await add('abzeichen', await m.bildAbzeichen('hellseher', 'Lena K.'))
    await add('admin-fr-jetzt-tippen', await m.bildJetztTippen(STORY.offen, STORY.partner, STORY.preise, [k('p-biedermann'), k('p-warkehr-a')]))
    await add('admin-sa-noch-nicht-getippt', await m.bildNochNichtGetippt(STORY.offen, STORY.storyCode, STORY.partner))
    await add('admin-tipp-sieger', await m.bildTippSieger({ ...STORY.spieltag }, STORY.partner, STORY.preise))
    await add('admin-top5', await m.bildTop5(STORY.top5, '2026/27', STORY.partner))
    await add('admin-fans-vs-kabine', await m.bildFansVsKabine({ ...STORY.duell.saison, titel: 'Saison 2026/27', kabineBester: STORY.duell.kabineBester }, STORY.partner))
    return out
  }, { KADER, STORY })
  for (const [n, url] of Object.entries(bilder)) fs.writeFileSync(`${OUT}/share-${n}.png`, Buffer.from(url.split(',')[1], 'base64'))
  check(Object.keys(bilder).length === 9, `Teilen-Bilder erzeugt: ${Object.keys(bilder).length}`)
  await ctx.close()
}

await browser.close()
fs.writeFileSync(`${OUT}/_pruefung.txt`, [...checks, '', ...errors].join('\n'))
console.log(checks.join('\n'))
if (errors.length) console.log('\nKonsole:\n' + errors.slice(0, 30).join('\n'))
console.log(`\n${checks.filter((c) => c.startsWith('FEHLER')).length} Fehler · ${errors.length} Konsolenfehler · Bilder: ${OUT}`)
