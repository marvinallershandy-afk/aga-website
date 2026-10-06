// v24-P: Admin → Album „Regeln → Pack-Typen“ + „Pack-Kontrolle“ (Woche) headless,
// DEV-?preview ohne Login, alle Antworten gemockt — KEINE echte DB.
//   npx vite --port 5247 --strictPort   ·   BASE=http://localhost:5247 OUT=shots-v24-packs/admin node scripts/packs-v24-admin-shots.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5247'
const OUT = process.env.OUT || 'shots-v24-packs/admin'
fs.mkdirSync(OUT, { recursive: true })
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const TYPEN = [
  ['tipp', 'Tipp-Pack', 2, null, 'klein', 1, 8], ['spieltag', 'Spieltags-Pack', 4, 'silber', 'gross', 2, 30], ['sieg', 'Sieg-Pack', 2, 'gold', 'gold', 3, 30],
  ['starter', 'Starter-Pack', 5, 'silber', 'starter', 2, 0], ['ziel', 'Ziel-Pack', 1, null, 'ziel', 2, 0], ['event', 'Event-Pack', 3, null, 'event', 3, 60],
].map(([typ, titel, karten, min, optik, reveal, chance], i) => ({ typ, titel, karten, min_seltenheit: min, optik, reveal, limitiert_chance: chance, smart: true, beschreibung: null, sortierung: (i + 1) * 10, updated_at: new Date().toISOString() }))
let kontrolle = {
  saison: '2026/27', ok: false, soll: 214, ist: 211, fehlend: 3, doppelt: 0,
  anlaesse: [
    { anlass: 'spiel:00000000-0000-4000-8000-000000000001:sieg', art: 'heimsieg', titel: 'Sieg-Pack · TuS Fischbek', soll: 41, ist: 39, fehlend: 2, doppelt: 0, fans: ['Lena B.', 'Tom K.'] },
    { anlass: 'ziel:00000000-0000-4000-8000-000000000009', art: 'ziel', titel: 'Exakt getippt', soll: 9, ist: 8, fehlend: 1, doppelt: 0, fans: ['Jana W.'] },
    { anlass: 'spiel:00000000-0000-4000-8000-000000000001:tipp', art: 'tipp', titel: 'Tipp-Pack · TuS Fischbek', soll: 37, ist: 37, fehlend: 0, doppelt: 0, fans: [] },
  ],
}
const browser = await chromium.launch()
const errors = []
for (const [label, vp] of [['desktop', { viewport: { width: 1280, height: 900 } }], ['mobil', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
  const ctx = await browser.newContext(vp)
  await ctx.route('**/rest/v1/**', async (route) => {
    const req = route.request()
    const t = new URL(req.url()).pathname.split('/rest/v1/')[1]
    if (t === 'rpc/sva_meine_rolle') return json(route, 'admin')
    if (t === 'rpc/sva_admin_pack_kontrolle') return json(route, kontrolle)
    if (t === 'rpc/album_admin_pack_nachliefern') {
      kontrolle = { ...kontrolle, ok: true, ist: kontrolle.soll, fehlend: 0, anlaesse: kontrolle.anlaesse.map((a) => ({ ...a, ist: a.soll, fehlend: 0, fans: [] })) }
      return json(route, { nachgeliefert: 3, offen: 0 })
    }
    if (t === 'sva_album_pack_typen') return req.method() === 'GET' ? json(route, TYPEN) : route.fulfill({ status: 204, body: '' })
    if (t === 'sva_album_einstellungen') return json(route, { id: 1, aktiv: true, gewicht_bronze: 70, gewicht_silber: 22, gewicht_gold: 7, gewicht_spezial: 1, karten_pro_pack: 3, doppelte_bremse: 5, fenster_vor_min: 60, fenster_nach_min: 135, bonus_heimsieg: true, schwelle_1: 3, belohnung_1: 'Getränk nach Wahl', schwelle_2: 6, belohnung_2: 'Bratwurst', belohnung_komplett: 'Los', smart_pack: true, smart_ab_karten: 2, wunsch_kosten: 5, karten_story: 1, karten_freund: 1, tausch_min_tage: 7, tausch_pro_woche: 5, shiny_chance: 250 })
    if (req.method() === 'GET') return json(route, t.startsWith('rpc/') ? null : [])
    return json(route, null)
  })
  await ctx.route('**/auth/v1/**', (r) => r.fulfill({ status: 403, body: '{}' }))
  await ctx.route('**/functions/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false}' }))
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`[${label}] ${e.message}`))
  await page.goto(`${BASE}/admin/album?tab=einstellungen&preview`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.getByText('Pack-Typen', { exact: true }).first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${OUT}/${label}-regeln-packtypen.png`, fullPage: false })
  await page.goto(`${BASE}/admin/album?preview`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${OUT}/${label}-woche-kontrolle-fehlt.png` })
  await page.getByRole('button', { name: 'Details' }).click().catch(() => {})
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/${label}-woche-kontrolle-details.png` })
  await page.getByRole('button', { name: 'Nachliefern' }).first().click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/${label}-woche-kontrolle-ok.png` })
  console.log(label, 'ok', await page.getByText('Pack-Kontrolle: alles zugestellt ✓').count())
  kontrolle = { ...kontrolle, ok: false, ist: 211, fehlend: 3, anlaesse: kontrolle.anlaesse.map((a, i) => (i < 2 ? { ...a, ist: a.soll - (i ? 1 : 2), fehlend: i ? 1 : 2, fans: i ? ['Jana W.'] : ['Lena B.', 'Tom K.'] } : a)) }
  await ctx.close()
}
console.log(errors.length ? errors.join('\n') : 'keine Seitenfehler')
await browser.close()
