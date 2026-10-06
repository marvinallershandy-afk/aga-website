// v22-A: Admin → Album → „Shiny & Geheim“, „Labor“, „Regeln“ headless (Mocks, ?preview, keine DB).
//   VITE_SUPABASE_URL=https://audit.supabase.co VITE_SUPABASE_ANON_KEY=anon npx vite --port 5198 --strictPort
//   BASE=http://localhost:5198 OUT=./shots-v22-album KATALOG_JSON=<album_katalog()-Antwort> node scripts/album-v22-admin-shots.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5198'
const OUT = process.env.OUT || './shots-v22-album'
fs.mkdirSync(OUT, { recursive: true })
const KATALOG = JSON.parse(fs.readFileSync(process.env.KATALOG_JSON, 'utf8'))
const spieler = KATALOG.karten.filter((k) => k.typ === 'spieler' && !k.variante && !k.limitiert)
const T = (d) => new Date(Date.now() - d * 864e5).toISOString()
const SHINY = {
  saison: KATALOG.saison, chance: 250, gesamt: 3, personen: 2, fans: 3,
  funde: [
    { karteId: spieler[3].id, person: spieler[3].titel, fan: 'Lena B.', at: T(1), anzahl: 1, erstfund: true },
    { karteId: spieler[3].id, person: spieler[3].titel, fan: 'Tom K.', at: T(0.2), anzahl: 1, erstfund: false },
    { karteId: spieler[9].id, person: spieler[9].titel, fan: 'Jana W.', at: T(4), anzahl: 1, erstfund: true },
  ],
  erstfunde: [
    { karteId: spieler[3].id, person: spieler[3].titel, name: 'Lena B.', at: T(1) },
    { karteId: spieler[9].id, person: spieler[9].titel, name: 'Jana W.', at: T(4) },
  ],
}
const GEHEIM = {
  vereinsGeburtstag: null,
  eier: [
    ['wappen', 'Der Platzwart', 'moment', '/album/karten/geheim-platzwart.webp', 'Sieben Mal klopft, wer den Platzwart sprechen will.', 4, true],
    ['ball', 'Der verlorene Ball', 'fan', null, 'Einer ging nie ins Tor. Er wartet darauf, dass ihn jemand findet.', 1, true],
    ['geburtstag', 'Seit 1949', 'fan', null, 'Nur an einem Tag im Jahr brennen die Kerzen.', 0, true],
    ['geste', 'Die Geheimtaktik', 'fan', null, 'Hoch, hoch, runter, runter … wer die Alten kennt, kennt den Rest.', 2, false],
  ].map(([schluessel, titel, typ, bildUrl, raetsel, gefunden, aktiv], i) => ({
    schluessel, aktiv, raetsel, sortierung: i, gefunden, kartenAktiv: true,
    karte: { id: `g-${i}`, titel, typ, bildUrl: bildUrl ?? undefined, seltenheit: 'spezial', serie: 'Geheimkarte', limitiert: true, geheim: true, bildFokus: '50% 46%' },
  })),
}
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) })
const b = await chromium.launch({ args: ['--use-angle=swiftshader'] })
const fehler = []
for (const [label, viewport] of [['desktop', { width: 1280, height: 900 }], ['handy', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: label === 'handy' ? 2 : 1 })
  await ctx.route('**/rest/v1/**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } })
    const u = new URL(req.url())
    const fn = u.pathname.split('/rpc/')[1]
    if (fn === 'album_katalog') return json(route, KATALOG)
    if (fn === 'album_admin_shiny') return json(route, SHINY)
    if (fn === 'album_admin_geheim') return json(route, GEHEIM)
    if (fn) return json(route, {})
    if (u.pathname.endsWith('/sva_album_einstellungen')) return json(route, { id: 1, aktiv: true, gewicht_bronze: 70, gewicht_silber: 22, gewicht_gold: 7, gewicht_spezial: 1, karten_pro_pack: 3, doppelte_bremse: 25, fenster_vor_min: 60, fenster_nach_min: 135, shiny_chance: 250, vereins_geburtstag: null, schwelle_1: 3, schwelle_2: 6, belohnung_1: 'Getränk nach Wahl', belohnung_2: 'Bratwurst', belohnung_komplett: 'Los' })
    return json(route, [])
  })
  await ctx.route('**/auth/v1/**', (r) => r.fulfill({ status: 403, body: '{}' }))
  await ctx.route('**/functions/v1/**', (r) => json(r, { configured: false }))
  const page = await ctx.newPage()
  page.on('pageerror', (e) => fehler.push(`[${label}] ${e.message}`))
  for (const [tab, name] of [['shiny', 'shiny-geheim'], ['labor', 'labor'], ['einstellungen', 'regeln']]) {
    await page.goto(`${BASE}/admin/album?tab=${tab}&preview`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1800)
    await page.screenshot({ path: `${OUT}/admin-${label}-${name}.png`, fullPage: name !== 'labor' })
  }
  if (label === 'desktop') {
    await page.goto(`${BASE}/admin/album?tab=shiny&preview`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.getByRole('button', { name: /SHINY gezogen/ }).first().click()])
    await dl.saveAs(`${OUT}/admin-story-shiny-gezogen.png`)
  }
  await ctx.close()
}
await b.close()
console.log(fehler.length ? 'FEHLER:\n' + fehler.join('\n') : 'ok')
