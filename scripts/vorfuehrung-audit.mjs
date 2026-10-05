// v18-T „Vorführ-Spiel“: headless durchklicken + screenshotten (desktop + 390 px).
// KEINE echte Datenbank: alle Supabase-Requests werden gemockt (In-Memory,
// zustandsbehaftet für sva_demo_starten/beenden/loeschen), Admin über den
// DEV-?preview-Bypass.
//   VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 5191 --strictPort
//   BASE=http://localhost:5191 OUT=./shots-demo node scripts/vorfuehrung-audit.mjs
// Prüft u. a.: /live ohne Parameter ruft NIE web_live_demo, /live?vorfuehrung=1
// nie web_live; Hinweis „Vorführung – kein echtes Spiel“; Zählung aus.
import { chromium } from 'playwright'
import fs from 'node:fs'
import { liveFixture, PLAYERS } from './live-fixtures.mjs'

const BASE = process.env.BASE || 'http://localhost:5191'
const OUT = process.env.OUT || './shots-demo'
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
const checks = []
const errors = []
const check = (ok, msg) => checks.push(`${ok ? 'OK ' : 'FEHLER'}  ${msg}`)

const VIEWS = [
  ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
  ['mobil', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
]
const iso = (minAgo) => new Date(Date.now() - minAgo * 60000).toISOString()

// ── Datenbank im Speicher ───────────────────────────────────────────────────
const ECHT = [
  { id: 'sp1', gegner: 'TSV Apensen', heim: false, anstoss: iso(6 * 1440), tore_sva: 2, tore_gegner: 2, status: 'beendet', demo: false },
  { id: 'sp2', gegner: 'TuS Fischbek', heim: true, anstoss: iso(-2 * 1440), tore_sva: null, tore_gegner: null, status: 'geplant', demo: false },
].map((s) => ({ ort: null, wettbewerb: 'Kreisliga Stade', spieltag_nr: 9, notizen: null, live_tore_sva: 0, live_tore_gegner: 0, anpfiff_at: null, wiederanpfiff_at: null, motm_roster_id: null, live_updated_at: null, created_at: iso(9000), updated_at: iso(9000), ...s }))
const ROSTER = PLAYERS.map((p, i) => ({ id: `r-${p.id}`, slug: p.id, name: p.name, nummer: p.number, position: p.position, foto_url: p.photoUrl, freisteller_url: p.cutoutUrl, aktiv: true, rolle: 'spieler', sortierung: i, steckbrief: {}, created_at: iso(9000), updated_at: iso(9000) }))
const db = { sm_spiele: [...ECHT], sva_ticker: [], sm_roster: ROSTER }
const rpcLog = []

function demoStarten({ p_gegner, p_beispiele, p_anpfiff }) {
  const beisp = p_beispiele && p_anpfiff
  const start = p_anpfiff ? (beisp ? iso(24) : iso(0)) : iso(-15)
  let d = db.sm_spiele.find((s) => s.demo)
  if (!d) {
    d = { ...ECHT[1], id: 'demo-1', demo: true, created_at: iso(0) }
    db.sm_spiele.push(d)
  }
  Object.assign(d, { gegner: p_gegner, heim: true, anstoss: start, tore_sva: null, tore_gegner: null, status: p_anpfiff ? 'live' : 'geplant', anpfiff_at: p_anpfiff ? start : null, wiederanpfiff_at: null, live_tore_sva: beisp ? 1 : 0, live_tore_gegner: 0, wettbewerb: null, spieltag_nr: null })
  db.sva_ticker = db.sva_ticker.filter((t) => t.spiel_id !== d.id)
  const ev = (typ, minute, minAgo, extra = {}) => db.sva_ticker.push({ id: `t${db.sva_ticker.length}-${typ}`, spiel_id: d.id, typ, minute, nachspielzeit: null, roster_id: null, roster_id_2: null, text: null, zeitpunkt: iso(minAgo), created_at: iso(minAgo), ...extra })
  if (p_anpfiff) ev('anpfiff', 1, beisp ? 24 : 0)
  if (beisp) {
    ev('kommentar', 6, 19, { text: 'Erste Chance für den SVA — der Ball streicht knapp am Pfosten vorbei.' })
    ev('tor', 13, 12, { roster_id: 'r-p-warkehr-a', roster_id_2: 'r-p-paruzel', text: 'Flach ins lange Eck' })
    ev('gelb', 19, 6, { roster_id: 'r-p-huettry', text: 'Taktisches Foul im Mittelfeld' })
    ev('kommentar', 23, 2, { text: 'Der SVA bleibt am Drücker.' })
  }
  return { id: d.id, gegner: d.gegner, status: d.status }
}

/** web_live_demo()-Antwort aus dem Speicher (gleiche Form wie die RPC). */
function webLiveDemo() {
  const base = liveFixture('keins')
  const d = db.sm_spiele.find((s) => s.demo)
  if (!d) return { ...base, match: null }
  const slug = (rid) => ROSTER.find((r) => r.id === rid)?.slug
  const events = db.sva_ticker.filter((t) => t.spiel_id === d.id).sort((a, b) => +new Date(b.zeitpunkt) - +new Date(a.zeitpunkt))
    .map((t) => JSON.parse(JSON.stringify({ id: t.id, type: t.typ, minute: t.minute, player: slug(t.roster_id), player2: slug(t.roster_id_2), text: t.text ?? undefined, at: t.zeitpunkt })))
  const minute = d.anpfiff_at ? Math.floor((Date.now() - new Date(d.anpfiff_at)) / 60000) + 1 : undefined
  return {
    ...base,
    staff: liveFixture('live').staff,
    lineup: { ...liveFixture('live').lineup, forMatch: false },
    match: { id: d.id, opponent: d.gegner, home: true, kickoff: d.anstoss, status: d.status, half: d.status === 'live' ? 1 : undefined, minute, anpfiffAt: d.anpfiff_at ?? undefined, goalsFor: d.live_tore_sva, goalsAgainst: d.live_tore_gegner, demo: true },
    events,
  }
}

const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) })

async function routen(ctx, zaehler) {
  await ctx.route('**/rest/v1/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const pfad = url.pathname.split('/rest/v1/')[1]
    if (pfad.startsWith('rpc/')) {
      const name = pfad.slice(4)
      zaehler[name] = (zaehler[name] ?? 0) + 1
      let args = {}
      try { args = req.postDataJSON() ?? {} } catch { /* leer */ }
      if (name === 'web_live') return json(route, liveFixture('keins'))
      if (name === 'web_live_demo') return json(route, webLiveDemo())
      if (name === 'sva_meine_rolle') return json(route, 'admin')
      if (name === 'sva_demo_starten') { rpcLog.push([name, args]); return json(route, demoStarten(args)) }
      if (name === 'sva_demo_beenden') {
        rpcLog.push([name, args])
        const d = db.sm_spiele.find((s) => s.demo)
        Object.assign(d, { status: 'beendet', tore_sva: d.live_tore_sva, tore_gegner: d.live_tore_gegner })
        db.sva_ticker.push({ id: 't-ab', spiel_id: d.id, typ: 'abpfiff', minute: 26, zeitpunkt: iso(0), created_at: iso(0) })
        return json(route, { id: d.id, status: 'beendet' })
      }
      if (name === 'sva_demo_loeschen') {
        rpcLog.push([name, args])
        db.sm_spiele = db.sm_spiele.filter((s) => !s.demo)
        return json(route, { geloescht: 1 })
      }
      return json(route, null)
    }
    if (req.method() === 'GET') {
      let rows = db[pfad] ?? []
      const sid = url.searchParams.get('spiel_id')
      if (sid?.startsWith('eq.')) rows = rows.filter((r) => r.spiel_id === sid.slice(3))
      const objekt = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
      return json(route, objekt ? rows[0] ?? null : rows)
    }
    return json(route, { message: 'audit: write blocked' }, 403)
  })
  await ctx.route('**/auth/v1/**', (r) => json(r, {}, 403))
  await ctx.route('**/storage/v1/**', (r) => json(r, {}, 403))
  await ctx.route('**/functions/v1/**', (r) => json(r, { configured: false }))
  await ctx.route('https://www.fussball.de/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }))
}

const browser = await chromium.launch()
async function seite(vname, vopts, zaehler) {
  // Zählung prüfen können: kein „Bot“ (webdriver/Headless-UA) — nur im Test
  const ua = vopts.isMobile
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
  const ctx = await browser.newContext({ ...vopts, userAgent: ua })
  await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }))
  await routen(ctx, zaehler)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`[${vname}] pageerror ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 40[34]/.test(m.text())) errors.push(`[${vname}] console ${m.text().slice(0, 200)}`) })
  return { ctx, page }
}

// ── 1. Admin: Übersicht → Vorführ-Spiel (desktop zuerst = startet die Vorführung) ──
for (const [vname, vopts] of VIEWS) {
  const z = {}
  const { ctx, page } = await seite(vname, vopts, z)
  await page.goto(`${BASE}/admin/?preview`, { waitUntil: 'networkidle' })
  const karte = page.getByTestId('vorfuehrung')
  await karte.waitFor({ timeout: 15000 })
  if (vname === 'desktop') {
    db.sm_spiele = db.sm_spiele.filter((s) => !s.demo)
    await page.reload({ waitUntil: 'networkidle' })
    await karte.scrollIntoViewIfNeeded()
    await karte.screenshot({ path: `${OUT}/admin-1-ohne-vorfuehrung-${vname}.png` })
    check((await page.getByTestId('vorfuehrung-status').innerText()).includes('Gerade kein Vorführ-Spiel'), 'Admin: ohne Vorführ-Spiel → „Gerade kein Vorführ-Spiel“')
    check((await page.getByTestId('vf-link').innerText()).endsWith('/live?vorfuehrung=1'), 'Admin: Vorführ-Link /live?vorfuehrung=1')
    await page.getByTestId('vf-starten').click()
    await page.getByTestId('vorfuehrung-status').getByText('LIVE 1:0').waitFor({ timeout: 10000 })
    const [, args] = rpcLog.find(([n]) => n === 'sva_demo_starten') ?? []
    check(args?.p_gegner === 'FC Vorführung' && args.p_beispiele === true && args.p_anpfiff === true, `Admin: „Vorführ-Spiel starten“ → sva_demo_starten(${JSON.stringify(args)})`)
    // Echte Seiten sehen es nicht: Spiele-Liste ohne Vorführ-Spiel
    await page.goto(`${BASE}/admin/spiele?preview`, { waitUntil: 'networkidle' })
    check(!(await page.locator('body').innerText()).includes('FC Vorführung'), 'Admin → Spiele: Vorführ-Spiel NICHT in der Liste')
    await page.screenshot({ path: `${OUT}/admin-2-spiele-ohne-vorfuehrung-${vname}.png` })
    await page.goto(`${BASE}/admin/?preview`, { waitUntil: 'networkidle' })
  }
  await karte.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  // mobil: ganze Seite (die feste Kopfzeile würde sonst über dem Ausschnitt liegen)
  if (vname === 'mobil') await page.screenshot({ path: `${OUT}/admin-3-vorfuehrung-laeuft-${vname}.png`, fullPage: true })
  else await karte.screenshot({ path: `${OUT}/admin-3-vorfuehrung-laeuft-${vname}.png` })
  check((await page.getByTestId('vorfuehrung-status').innerText()).includes('FC Vorführung'), `Admin (${vname}): Karte zeigt laufende Vorführung`)

  // Ticker-Pult
  await page.goto(`${BASE}/admin/live?spiel=demo-1&preview`, { waitUntil: 'networkidle' })
  await page.getByTestId('live-vorfuehrung').waitFor({ timeout: 10000 })
  check((await page.locator('select').first().inputValue()) === 'demo-1', `Ticker-Pult (${vname}): ?spiel= wählt das Vorführ-Spiel`)
  check((await page.locator('select option:checked').innerText()).startsWith('VORFÜHRUNG'), `Ticker-Pult (${vname}): Auswahl als „VORFÜHRUNG“ markiert`)
  await page.screenshot({ path: `${OUT}/admin-4-ticker-pult-${vname}.png`, fullPage: vname === 'mobil' })
  await page.goto(`${BASE}/admin/live?preview`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check((await page.locator('select').first().inputValue()) !== 'demo-1', `Ticker-Pult (${vname}): ohne ?spiel= wird NICHT automatisch das Vorführ-Spiel gewählt`)
  await ctx.close()
}

// ── 2. /live mit und ohne Parameter ─────────────────────────────────────────
for (const [vname, vopts] of VIEWS) {
  for (const mitParam of [false, true]) {
    const z = {}
    const { ctx, page } = await seite(vname, vopts, z)
    await page.goto(`${BASE}/live${mitParam ? '?vorfuehrung=1' : ''}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.lv-hero', { timeout: 15000 })
    await page.waitForTimeout(2500) // Zählung läuft im Leerlauf
    const text = (await page.locator('body').innerText()).toLowerCase() // CSS-Versalien
    const zaehlung = await page.evaluate(() => window.__svaZaehlung ?? [])
    if (mitParam) {
      check(!z.web_live && z.web_live_demo > 0, `/live?vorfuehrung=1 (${vname}): nur web_live_demo (${JSON.stringify(z)})`)
      check(text.includes('vorführung') && text.includes('kein echtes spiel') && text.includes('fc vorführung'), `/live?vorfuehrung=1 (${vname}): Hinweis + Vorführ-Spiel sichtbar`)
      check(text.includes('live 25') && text.includes('warkehr'), `/live?vorfuehrung=1 (${vname}): live mit Ticker (Tor Warkehr)`)
      check(zaehlung.length === 0, `/live?vorfuehrung=1 (${vname}): nicht gezählt (${JSON.stringify(zaehlung)})`)
    } else {
      check(z.web_live > 0 && !z.web_live_demo, `/live (${vname}): nur web_live (${JSON.stringify(z)})`)
      check(!text.includes('vorführung'), `/live (${vname}): nichts von der Vorführung zu sehen`)
      check(zaehlung.some((x) => x.pfad === '/live'), `/live (${vname}): normal gezählt`)
    }
    await page.screenshot({ path: `${OUT}/live-${mitParam ? 'mit' : 'ohne'}-vorfuehrung-${vname}.png`, fullPage: true })
    await ctx.close()
  }
}

// ── 3. Karte /?vorfuehrung=1 ────────────────────────────────────────────────
for (const [vname, vopts] of VIEWS) {
  for (const mitParam of [false, true]) {
    const z = {}
    const { ctx, page } = await seite(vname, vopts, z)
    await page.goto(`${BASE}/${mitParam ? '?vorfuehrung=1' : ''}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(6000)
    const leiste = page.locator('.mday--demo')
    if (mitParam) {
      check((await leiste.count()) === 1 && (await leiste.innerText()).includes('LIVE 1:0'), `Karte /?vorfuehrung=1 (${vname}): Vorführ-Leiste „LIVE 1:0“`)
      check((await leiste.getAttribute('href')) === '/live?vorfuehrung=1', `Karte (${vname}): Leiste verlinkt auf /live?vorfuehrung=1`)
    } else {
      check((await leiste.count()) === 0 && !z.web_live_demo, `Karte / (${vname}): keine Vorführ-Leiste, kein web_live_demo (${JSON.stringify(z)})`)
    }
    await page.screenshot({ path: `${OUT}/karte-${mitParam ? 'mit' : 'ohne'}-vorfuehrung-${vname}.png` })
    await ctx.close()
  }
}

// ── 4. Beenden + Löschen (Admin) ────────────────────────────────────────────
{
  const { ctx, page } = await seite('desktop', VIEWS[0][1], {})
  await page.goto(`${BASE}/admin/?preview`, { waitUntil: 'networkidle' })
  await page.getByTestId('vf-beenden').click()
  await page.getByTestId('vorfuehrung-status').getByText('Endstand').waitFor({ timeout: 10000 })
  check(true, 'Admin: „Beenden“ → Endstand')
  await page.getByTestId('vf-loeschen').click()
  await page.getByRole('button', { name: 'Löschen' }).last().click()
  await page.getByTestId('vorfuehrung-status').getByText('Gerade kein Vorführ-Spiel').waitFor({ timeout: 10000 })
  check(rpcLog.some(([n]) => n === 'sva_demo_loeschen'), 'Admin: „Löschen“ (mit Rückfrage) → sva_demo_loeschen')
  await ctx.close()
}

await browser.close()
console.log(checks.join('\n'))
if (errors.length) console.log('\nKonsole/Seitenfehler:\n' + [...new Set(errors)].join('\n'))
const bad = checks.filter((c) => c.startsWith('FEHLER')).length
console.log(`\n${checks.length - bad} OK, ${bad} FEHLER · Screens: ${OUT}`)
process.exit(bad ? 1 : 0)
