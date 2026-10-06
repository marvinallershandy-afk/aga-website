// v26: Check-in-Anzeige (iPad-Bühne) headless screenshotten — KEIN Login, KEINE
// echte DB: DEV-?preview-Bypass + gemockte REST/RPC/-Antworten (echte Spieler-
// Cutouts, heutiges Live-Heimspiel). Chromium (ANGLE/Metal) + WebKit, quer
// 1180×820 und hoch 820×1180, je zwei Zeitpunkte (Bildwechsel sichtbar).
//   npx vite --port 5193 --strictPort   (vorher, im Hintergrund)
//   BASE=http://localhost:5193 OUT=./audit-v25/fix/ipad-v2 node scripts/checkin-anzeige-shots.mjs
import { chromium, webkit } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5193'
const OUT = process.env.OUT || './audit-v25/fix/ipad-v2'
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

const DB = {
  sm_spiele: [
    { id: uuid(1), gegner: 'TuS Fischbek', heim: true, anstoss: T(-0.03), ort: 'Waldsportplatz', wettbewerb: 'Kreisliga Stade', spieltag_nr: 9, tore_sva: 2, tore_gegner: 1, status: 'live' },
    { id: uuid(2), gegner: 'VfL Güldenstern Stade III', heim: true, anstoss: T(13), ort: 'Waldsportplatz', wettbewerb: 'Kreisliga Stade', spieltag_nr: 11, tore_sva: null, tore_gegner: null, status: 'geplant' },
  ].map((s) => ({ demo: false, notizen: null, created_at: T(-30), updated_at: T(-1), ...s })),
  sm_roster: KADER.map(([name, slug, position, nummer, kapitaen], i) => ({
    id: uuid(100 + i), slug, name, nummer, position, rolle: 'spieler',
    foto_url: `/players/${slug}.webp`, freisteller_url: `/players/cutout/${slug}.webp`,
    aktiv: true, kapitaen, neuzugang: false, im_verein_seit: 2018, fupa_spieler_id: null,
    kontakt_text: null, steckbrief: {}, sortierung: i * 10, created_at: T(-90), updated_at: T(-3),
  })),
  sva_album_einstellungen: [{ id: 1, aktiv: true, schwelle_1: 3, belohnung_1: 'ein Getränk nach Wahl', schwelle_2: 6, belohnung_2: 'SVA-Fanschal', belohnung_komplett: 'Los für die Saison-Verlosung', checkin_rotation: true, checkin_rotation_minuten: 3, updated_at: T(-2), updated_by: 'preview' }],
  sva_settings: [{ id: 1, saison: '2026/27' }],
  sm_admins: [{ email: 'preview@audit.local' }],
}
let checkins = 46
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function routes(ctx) {
  await ctx.route('**/rest/v1/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const table = url.pathname.split('/rest/v1/')[1]
    if (table === 'rpc/sva_meine_rolle') return json(route, 'admin')
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
  await ctx.route('**/api/live', (r) => json(r, { match: { status: 'live', home: true, opponent: 'TuS Fischbek', goalsFor: 2, goalsAgainst: 1, minute: "63'" } }))
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
for (const [eng, launcher, opts] of engines) {
  const browser = await launcher.launch(opts)
  for (const [oname, viewport] of orients) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 })
    await routes(ctx)
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[${eng}/${oname}] pageerror ${e.message}`))
    page.on('console', (m) => { if (m.type() === 'error' && !/403|api\/live/.test(m.text())) errors.push(`[${eng}/${oname}] ${m.text().slice(0, 160)}`) })
    await page.goto(`${BASE}/admin/checkin-anzeige?preview`, { waitUntil: 'networkidle' })
    // Start-Overlay (Vollbild-Geste) wegklicken
    await page.locator('.ca-start').click().catch(() => {})
    await page.waitForSelector('.ca-karte__bild', { timeout: 15000 }).catch(() => {})
    await page.waitForSelector('.ca-held__bild.is-da', { timeout: 15000 }).catch(() => {})
    await page.evaluate(() => document.fonts?.ready).catch(() => {})
    await page.waitForTimeout(1600)
    await page.screenshot({ path: `${OUT}/${eng}-${oname}-t1.png` })
    // Zweiter Zeitpunkt: Held wechselt nach 8 s
    await page.waitForTimeout(8600)
    await page.screenshot({ path: `${OUT}/${eng}-${oname}-t2.png` })
    await ctx.close()
  }
  await browser.close()
}
console.log(errors.length ? `Konsole: ${errors.length} Fehler\n${errors.join('\n')}` : 'Konsole: 0 Fehler')
console.log(`Screenshots → ${OUT}`)
process.exit(errors.length ? 1 : 0)
