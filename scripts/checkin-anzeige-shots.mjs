// v26: Check-in-Anzeige (iPad-Schaustück) headless screenshotten — KEIN Login,
// KEINE echte DB: DEV-?preview-Bypass + gemockte REST/RPC + /api/live (volle
// web_live-Form). Chromium (ANGLE/Metal) + WebKit, quer 1180×820 und hoch 820×1180.
//
// Zwei Durchläufe:
//   (1) ECHT live  → Scorebug „live 2:1" + jede Szene (Showcase/Team/Heute/Shiny),
//                    selektorbasiert (robust), + Frame-Zeitmessung (Chromium quer).
//   (2) VORFÜHRUNG → vor Anpfiff (Anstoßzeit), TOR!-Einblendung, Torschütze-Szene,
//                    Abpfiff-Moment (Drehbuch checkinVorfuehrung.ts).
//
//   npx vite --port 5193 --strictPort   (vorher, im Hintergrund)
//   BASE=http://localhost:5193 OUT=./audit-v25/fix/ipad-v3 node scripts/checkin-anzeige-shots.mjs
import { chromium, webkit } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5193'
const OUT = process.env.OUT || './audit-v25/fix/ipad-v3'
fs.mkdirSync(OUT, { recursive: true })
const T = (d) => new Date(Date.now() + d * 864e5).toISOString()
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ISO = (ms) => new Date(Date.now() + ms).toISOString()

// Echte Spieler mit vorhandenen HD-Freistellern (public/players/cutout/hd)
const KADER = [
  ['Tobias Helck', 'tobias-helck', 'MITTELFELD', 6, true],
  ['Julio Paruzel', 'julio-paruzel', 'STURM', 9, false],
  ['Aaron Warkehr', 'aaron-warkehr', 'MITTELFELD', 10, false],
  ['Elias Pejas', 'elias-pejas', 'ABWEHR', 4, false],
  ['Malte Pils', 'malte-pils', 'TOR', 1, false],
  ['Justin Sladek', 'justin-sladek', 'ABWEHR', 3, false],
  ['Dawid Neuber', 'dawid-neuber', 'STURM', 11, false],
  ['Noah Pejas', 'noah-pejas', 'MITTELFELD', 8, false],
]

const spielLive = (status) => ({
  id: uuid(1), gegner: 'TuS Fischbek', heim: true,
  anstoss: status === 'live' ? T(-0.03) : (() => { const d = new Date(); d.setHours(15, 0, 0, 0); return d.toISOString() })(),
  ort: 'Waldsportplatz', wettbewerb: 'Kreisliga Stade', spieltag_nr: 9,
  tore_sva: status === 'live' ? 2 : null, tore_gegner: status === 'live' ? 1 : null,
  live_tore_sva: status === 'live' ? 2 : 0, live_tore_gegner: status === 'live' ? 1 : 0,
  status,
})

const dbFuer = (status) => ({
  sm_spiele: [spielLive(status)].map((s) => ({ demo: false, notizen: null, created_at: T(-30), updated_at: T(-1), anpfiff_at: null, wiederanpfiff_at: null, motm_roster_id: null, live_updated_at: null, ...s })),
  sm_roster: KADER.map(([name, slug, position, nummer, kapitaen], i) => ({
    id: uuid(100 + i), slug, name, nummer, position, rolle: 'spieler',
    foto_url: `/players/${slug}.webp`, freisteller_url: `/players/cutout/${slug}.webp`,
    aktiv: true, kapitaen, neuzugang: false, im_verein_seit: 2018, fupa_spieler_id: null,
    kontakt_text: null, steckbrief: {}, sortierung: i * 10, created_at: T(-90), updated_at: T(-3),
  })),
  sva_album_einstellungen: [{ id: 1, aktiv: true, schwelle_1: 3, belohnung_1: 'ein Getränk nach Wahl', schwelle_2: 6, belohnung_2: 'SVA-Fanschal', belohnung_komplett: 'Los für die Saison-Verlosung', checkin_rotation: true, checkin_rotation_minuten: 3, updated_at: T(-2), updated_by: 'preview' }],
  sva_settings: [{ id: 1, saison: '2026/27' }],
  sm_admins: [{ email: 'preview@audit.local' }],
})

// volle web_live-Form (fetchLive.pruefe verlangt events[])
const liveBody = (status) => ({
  version: 2, serverNow: ISO(0),
  match: status === 'live'
    ? { id: uuid(1), opponent: 'TuS Fischbek', home: true, kickoff: T(-0.03), status: 'live', minute: 63, goalsFor: 2, goalsAgainst: 1 }
    : null,
  events: status === 'live'
    ? [{ id: 'e2', type: 'tor', minute: 58, player: 'julio-paruzel', at: ISO(-120000) }, { id: 'e1', type: 'tor', minute: 24, player: 'tobias-helck', at: ISO(-600000) }]
    : [],
  lineup: null, players: [], staff: [], previous: null, settings: {},
})

let checkins = 46
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function routes(ctx, status) {
  const DB = dbFuer(status)
  await ctx.route('**/rest/v1/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const table = url.pathname.split('/rest/v1/')[1]
    if (table === 'rpc/sva_meine_rolle') return json(route, 'admin')
    if (table === 'rpc/web_live') return json(route, liveBody(status))
    if (table === 'rpc/album_checkin_code') {
      const intervallMin = 3
      const periode = intervallMin * 60_000
      const bis = Math.ceil(Date.now() / periode) * periode - Date.now()
      return json(route, {
        rotation: true, intervallMin, token: 'aaaabbbbccccddddeeeeffff',
        jetzt: { code: 'K7P2', bis: ISO(bis) },
        codes: [
          { code: 'K7P2', von: ISO(bis - periode), bis: ISO(bis) },
          { code: 'M4XQ', von: ISO(bis), bis: ISO(bis + periode) },
        ],
      })
    }
    if (table === 'rpc/album_admin_statistik') {
      checkins += 1
      return json(route, { saison: '2026/27', fans: 128, checkinsSaison: 412, packsOffen: 9, gutscheineOffen: 4, gutscheineEingeloest: 1, albenKomplett: 1, spiele: [{ spielId: uuid(1), checkins }, { spielId: uuid(2), checkins: 0 }], kontakte: [] })
    }
    if (req.method() === 'GET' && DB[table]) {
      const accept = req.headers()['accept'] || ''
      return json(route, accept.includes('vnd.pgrst.object') ? DB[table][0] ?? null : DB[table])
    }
    return json(route, { message: 'audit: write blocked' }, 403)
  })
  await ctx.route('**/storage/v1/**', (r) => r.fulfill({ status: 403, body: '{}' }))
  await ctx.route('**/auth/v1/**', (r) => r.fulfill({ status: 403, body: '{}' }))
  await ctx.route('**/functions/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"configured":false}' }))
  await ctx.route('**/api/live', (r) => json(r, liveBody(status)))
}

const engines = [
  ['chromium', chromium, { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--use-gl=angle'] }],
  ['webkit', webkit, {}],
]
const orients = [
  ['quer', { width: 1180, height: 820 }],
  ['hoch', { width: 820, height: 1180 }],
]
const errors = []
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` })
const warte = (page, sel, ms = 20000) => page.waitForSelector(sel, { timeout: ms }).catch(() => null)

async function frameMessung(page) {
  // 5 s requestAnimationFrame-Deltas während der Showcase-Szene sammeln
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const deltas = []
        let last = performance.now()
        const t0 = last
        const loop = (t) => {
          deltas.push(t - last)
          last = t
          if (t - t0 < 5000) requestAnimationFrame(loop)
          else {
            const sorted = deltas.slice(1).sort((a, b) => a - b)
            const unter20 = sorted.filter((d) => d < 20).length
            resolve({ frames: sorted.length, p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0, anteilUnter20: sorted.length ? unter20 / sorted.length : 0 })
          }
        }
        requestAnimationFrame(loop)
      }),
  )
}

for (const [eng, launcher, opts] of engines) {
  const browser = await launcher.launch(opts)
  for (const [oname, viewport] of orients) {
    // ── (1) ECHT live: Scorebug live + jede Szene ──────────────
    {
      const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 })
      await routes(ctx, 'live')
      const page = await ctx.newPage()
      page.on('pageerror', (e) => errors.push(`[${eng}/${oname}/live] pageerror ${e.message}`))
      page.on('console', (mmsg) => { if (mmsg.type() === 'error' && !/403|api\/live|web_live/.test(mmsg.text())) errors.push(`[${eng}/${oname}/live] ${mmsg.text().slice(0, 160)}`) })
      await page.goto(`${BASE}/admin/checkin-anzeige?preview`, { waitUntil: 'networkidle' })
      await page.locator('.ca-start__btn--echt').click().catch(() => {})
      await warte(page, '.ca-karte__bild')
      await page.evaluate(() => document.fonts?.ready).catch(() => {})
      for (const sz of ['showcase', 'team', 'heute', 'shiny']) {
        await warte(page, `[data-szene="${sz}"]`)
        await page.waitForTimeout(1500)
        await shot(page, `${eng}-${oname}-szene-${sz}`)
      }
      if (eng === 'chromium' && oname === 'quer') {
        await warte(page, '[data-szene="showcase"]')
        const fm = await frameMessung(page).catch(() => null)
        if (fm) console.log(`Frame-Messung Showcase (chromium/quer): ${fm.frames} Frames, p95=${fm.p95.toFixed(1)}ms, <20ms=${(fm.anteilUnter20 * 100).toFixed(1)}%`)
      }
      await ctx.close()
    }

    // ── (2) VORFÜHRUNG: vor Anpfiff, TOR!, Torschütze, Abpfiff ──
    {
      const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 })
      await routes(ctx, 'geplant')
      const page = await ctx.newPage()
      page.on('pageerror', (e) => errors.push(`[${eng}/${oname}/vorf] pageerror ${e.message}`))
      page.on('console', (mmsg) => { if (mmsg.type() === 'error' && !/403|api\/live|web_live/.test(mmsg.text())) errors.push(`[${eng}/${oname}/vorf] ${mmsg.text().slice(0, 160)}`) })
      await page.goto(`${BASE}/admin/checkin-anzeige?preview&vorfuehrung=1`, { waitUntil: 'networkidle' })
      await page.locator('.ca-start__knoepfe button:last-child').click().catch(() => {})
      await warte(page, '.ca-karte__bild')
      await page.evaluate(() => document.fonts?.ready).catch(() => {})
      // vor Anpfiff (Anstoßzeit groß) — läuft 0–12 s
      await warte(page, '.ca-score__anstoss')
      await page.waitForTimeout(800)
      await shot(page, `${eng}-${oname}-vorf-vorkick`)
      // TOR!-Einblendung (um 24 s)
      if (await warte(page, '.tj', 30000)) {
        await page.waitForTimeout(900)
        await shot(page, `${eng}-${oname}-vorf-tor`)
      }
      // Torschütze-Szene (nach dem Overlay)
      if (await warte(page, '[data-szene="scorer"]', 12000)) {
        await page.waitForTimeout(1200)
        await shot(page, `${eng}-${oname}-vorf-torschuetze`)
      }
      // Live mit Stand (Scorebug 1:0, Minute rollt)
      await shot(page, `${eng}-${oname}-vorf-live`)
      // Abpfiff-Moment (um 80 s)
      if (await warte(page, '.ca-ende', 80000)) {
        await page.waitForTimeout(1400)
        await shot(page, `${eng}-${oname}-vorf-abpfiff`)
      }
      await ctx.close()
    }
  }
  await browser.close()
}
console.log(errors.length ? `Konsole: ${errors.length} Fehler\n${errors.join('\n')}` : 'Konsole: 0 Fehler')
console.log(`Screenshots → ${OUT}`)
process.exit(errors.length ? 1 : 0)
