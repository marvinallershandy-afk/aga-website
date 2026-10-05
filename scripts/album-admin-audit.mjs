// v17-A: Admin „Album“ headless durchklicken + screenshotten (desktop + 390 px).
// KEIN Login, KEINE echte DB: DEV-?preview-Bypass, alle REST-Antworten gemockt
// (Codes/Einstellungen/Gutscheine zustandsbehaftet). Prüft zusätzlich, dass der
// QR-Code auf dem A4-Plakat wirklich lesbar ist (BarcodeDetector) und dass der
// PDF-Export ein gültiges PDF liefert.
//   npx vite --port 5192 --strictPort        (vorher starten)
//   BASE=http://localhost:5192 OUT=./shots-album/admin node scripts/album-admin-audit.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5192'
const OUT = process.env.OUT || './shots-album/admin'
fs.mkdirSync(OUT, { recursive: true })
const T = (d) => new Date(Date.now() + d * 864e5).toISOString()
const LOGO = (name, farbe) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="140" viewBox="0 0 400 140"><rect x="10" y="30" width="80" height="80" rx="16" fill="${farbe}"/><text x="50" y="86" font-family="Arial" font-size="44" font-weight="900" fill="#fff" text-anchor="middle">${name[0]}</text><text x="110" y="92" font-family="Arial" font-size="40" font-weight="900" fill="${farbe}">${name}</text></svg>`)}`
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const KADER = [['Malte Pils', 'malte-pils', 'TW'], ['Justin Sladek', 'justin-sladek', 'ABW'], ['Julio Paruzel', 'julio-paruzel', 'MIT'], ['Tobias Helck', 'tobias-helck', 'MIT'], ['Aaron Warkehr', 'aaron-warkehr', 'ANG']]
const DB = {
  sm_spiele: [
    { id: uuid(1), gegner: 'TuS Fischbek', heim: true, anstoss: T(-0.02), ort: 'Waldsportplatz', wettbewerb: 'Kreisliga Stade', spieltag_nr: 9, tore_sva: null, tore_gegner: null, status: 'live' },
    { id: uuid(2), gegner: 'VfL Güldenstern Stade III', heim: true, anstoss: T(13), ort: 'Waldsportplatz', wettbewerb: 'Kreisliga Stade', spieltag_nr: 11, tore_sva: null, tore_gegner: null, status: 'geplant' },
    { id: uuid(3), gegner: 'TSV Apensen', heim: true, anstoss: T(-14), ort: 'Waldsportplatz', wettbewerb: 'Kreisliga Stade', spieltag_nr: 7, tore_sva: 3, tore_gegner: 1, status: 'beendet' },
    { id: uuid(4), gegner: 'SV Ahlerstedt', heim: false, anstoss: T(6), ort: 'Ahlerstedt', wettbewerb: 'Kreisliga Stade', spieltag_nr: 10, tore_sva: null, tore_gegner: null, status: 'geplant' },
  ].map((s) => ({ notizen: null, created_at: T(-30), updated_at: T(-1), ...s })),
  sm_sponsoren: [
    { id: 'so1', name: 'Mr. Döner', logo_url: LOGO('Mr. Döner', '#c2410c'), aktiv: true, stufe: 'partner' },
    { id: 'so2', name: 'Altstadtcafé', logo_url: LOGO('Altstadtcafé', '#0b3d91'), aktiv: true, stufe: 'hauptpartner' },
  ].map((s) => ({ paket: null, website_url: null, bande: true, sortierung: 0, created_at: T(-90), updated_at: T(-3), ...s })),
  sm_roster: KADER.map(([name, datei, position], i) => ({ id: uuid(100 + i), slug: `p-${datei}`, name, nummer: i + 3, position, rolle: 'spieler', foto_url: `/players/${datei}.webp`, freisteller_url: `/players/cutout/${datei}.webp`, aktiv: true, kapitaen: name === 'Tobias Helck', sortierung: i * 10 })),
  sva_album_karten: [
    ...KADER.map(([name, datei], i) => ({ id: uuid(200 + i), typ: 'spieler', roster_id: uuid(100 + i), sponsor_id: null, titel: name, untertitel: 'Mittelfeld', bild_url: `/players/${datei}.webp`, walkout_url: null, seltenheit: name === 'Tobias Helck' ? 'gold' : 'bronze', aktiv: true, saison: '2026/27', sortierung: i })),
    { id: uuid(300), typ: 'moment', roster_id: null, sponsor_id: null, titel: 'Das Tor zur Meisterschaft', untertitel: '90+7. Minute · Meister 2026', bild_url: '/fans/meister.webp', walkout_url: null, seltenheit: 'spezial', aktiv: true, saison: null, sortierung: 0 },
    { id: uuid(301), typ: 'partner', roster_id: null, sponsor_id: 'so1', titel: 'Mr. Döner', untertitel: null, bild_url: null, walkout_url: null, seltenheit: 'silber', aktiv: false, saison: '2026/27', sortierung: 0 },
  ].map((k) => ({ created_at: T(-5), updated_at: T(-5), ...k })),
  sva_album_spielcodes: [{ spiel_id: uuid(3), token: 'aaaabbbbccccddddeeeeffff', partner_id: 'so2', erzeugt_at: T(-15), erzeugt_von: 'marvin@aga-erste.de', bonus_at: T(-14) }],
  sva_album_einstellungen: [{ id: 1, aktiv: true, gewicht_bronze: 70, gewicht_silber: 22, gewicht_gold: 7, gewicht_spezial: 1, karten_pro_pack: 3, doppelte_bremse: 50, fenster_vor_min: 60, fenster_nach_min: 135, bonus_heimsieg: true, schwelle_1: 5, belohnung_1: 'Freibier oder Bratwurst', partner_1_id: 'so1', schwelle_2: 10, belohnung_2: 'SVA-Fanartikel', partner_2_id: null, belohnung_komplett: 'Los für die Saison-Verlosung', partner_komplett_id: null, stand_pin_gesetzt_at: null, updated_at: T(-2), updated_by: 'marvin@aga-erste.de' }],
  sva_album_gutscheine: [
    { id: 'g1', fan_user_id: 'f1', saison: '2026/27', stufe: 'schwelle_1', titel: 'Freibier oder Bratwurst', partner_id: 'so1', code: 'SVA-7K3PQ', status: 'offen', eingeloest_at: null, eingeloest_durch: null, created_at: T(-1) },
    { id: 'g2', fan_user_id: 'f2', saison: '2026/27', stufe: 'schwelle_1', titel: 'Freibier oder Bratwurst', partner_id: 'so1', code: 'SVA-M4XTR', status: 'eingeloest', eingeloest_at: T(-6), eingeloest_durch: 'stand', created_at: T(-8) },
    { id: 'g3', fan_user_id: 'f2', saison: '2026/27', stufe: 'komplett', titel: 'Los für die Saison-Verlosung', partner_id: null, code: 'SVA-Z9HWB', status: 'offen', eingeloest_at: null, eingeloest_durch: null, created_at: T(-2) },
  ],
  sva_album_fans: [{ user_id: 'f1', vorname: 'Marvin', initial: 'A' }, { user_id: 'f2', vorname: 'Lena', initial: 'B' }],
  sva_settings: [{ id: 1, saison: '2026/27' }],
  sva_partner_anfragen: [], sva_partner_pakete: [], sva_partner_info: [], sm_admins: [{ email: 'preview@audit.local' }],
}
let checkins = 47
const errors = []
const checks = []
const check = (ok, msg) => checks.push(`${ok ? 'OK ' : 'FEHLER'}  ${msg}`)
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function routes(ctx) {
  await ctx.route('**/rest/v1/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const table = url.pathname.split('/rest/v1/')[1]
    const body = req.method() === 'POST' || req.method() === 'PATCH' ? req.postDataJSON() : null
    if (table === 'rpc/sva_meine_rolle') return json(route, 'admin')
    if (table === 'rpc/album_admin_statistik') {
      checkins += 1
      return json(route, { saison: '2026/27', fans: 128, fansRangliste: 61, fansErinnerung: 2, checkinsSaison: 412, packsOffen: 9, gutscheineOffen: DB.sva_album_gutscheine.filter((g) => g.status === 'offen').length, gutscheineEingeloest: 1, albenKomplett: 1, spiele: [{ spielId: uuid(1), checkins }, { spielId: uuid(3), checkins: 96 }, { spielId: uuid(2), checkins: 0 }], kontakte: [{ name: 'Marvin A.', email: 'marvin@fan.example' }, { name: 'Jana P.', email: 'jana@fan.example' }] })
    }
    if (table === 'rpc/album_admin_code') {
      const neu = { spiel_id: body.p_spiel, token: Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 14), partner_id: body.p_partner, erzeugt_at: new Date().toISOString(), erzeugt_von: 'preview', bonus_at: null }
      const alt = DB.sva_album_spielcodes.find((c) => c.spiel_id === body.p_spiel)
      if (alt) Object.assign(alt, { partner_id: body.p_partner, ...(body.p_neu ? { token: neu.token, erzeugt_at: neu.erzeugt_at } : {}) })
      else DB.sva_album_spielcodes.push(neu)
      const c = DB.sva_album_spielcodes.find((x) => x.spiel_id === body.p_spiel)
      return json(route, { spielId: c.spiel_id, token: c.token, partnerId: c.partner_id })
    }
    if (table === 'rpc/album_admin_spielerkarten') return json(route, { bronze: 0, gold: 0, trainer: 3, saison: '2026/27' })
    if (table === 'rpc/album_admin_pin') {
      DB.sva_album_einstellungen[0].stand_pin_gesetzt_at = new Date().toISOString()
      return json(route, { ok: true })
    }
    if (req.method() === 'PATCH' && DB[table]) {
      const id = (url.searchParams.get('id') || '').replace('eq.', '')
      DB[table] = DB[table].map((r) => (String(r.id) === id ? { ...r, ...body } : r))
      return route.fulfill({ status: 204, body: '' })
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
}

const browser = await chromium.launch()
for (const [label, vp] of [
  ['desktop', { viewport: { width: 1280, height: 900 } }],
  ['mobil', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
]) {
  const ctx = await browser.newContext({ ...vp, acceptDownloads: true })
  await routes(ctx)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 403/.test(m.text())) errors.push(`[${label}] ${m.text().slice(0, 200)}`) })
  const go = async (p) => { await page.goto(`${BASE}${p}${p.includes('?') ? '&' : '?'}preview`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500) }
  const shot = async (name, full = true) => { await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/${label}-${name}.png`, fullPage: full }) }

  await go('/admin/album')
  await shot('01-spieltage')
  check((await page.getByText('Check-ins heute (TuS Fischbek)').count()) === 1, `[${label}] Live-Zähler für das heutige Heimspiel`)
  check((await page.getByText('SV Ahlerstedt').count()) === 0, `[${label}] Auswärtsspiele ohne QR-Code`)
  if (label === 'desktop') {
    await page.getByRole('button', { name: 'QR-Code erzeugen' }).first().click()
    await page.waitForTimeout(1200)
    await page.getByLabel('Check-in präsentiert von').selectOption('so1')
    await page.waitForTimeout(1500)
    await shot('02-qr-plakat', false)
    const qr = await page.evaluate(async () => {
      const c = document.querySelector('[data-testid=album-plakat]')
      if (!('BarcodeDetector' in window)) return { fehlt: true }
      const r = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(c)
      return { wert: r[0]?.rawValue ?? null, png: c.toDataURL('image/png') }
    })
    check(!!qr.wert && /\/album\?c=[a-z0-9]{16,}$/.test(qr.wert), `[${label}] QR auf dem Plakat lesbar → ${qr.wert}`)
    if (qr.png) fs.writeFileSync(`${OUT}/plakat-a4.png`, Buffer.from(qr.png.split(',')[1], 'base64'))
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /PDF \(A4\)/ }).click()])
    const pfad = `${OUT}/plakat-a4.pdf`
    await dl.saveAs(pfad)
    const pdf = fs.readFileSync(pfad)
    check(pdf.subarray(0, 5).toString() === '%PDF-' && pdf.includes('/MediaBox [0 0 595.28 841.89]') && pdf.subarray(-6).toString().includes('%%EOF'), `[${label}] PDF-Export gültig (A4, ${Math.round(pdf.length / 1024)} KB)`)
    await page.keyboard.press('Escape')
  }
  await go('/admin/album?tab=sticker')
  await shot('03-sticker-katalog')
  await page.getByRole('button', { name: 'Sticker aus Kader erzeugen' }).click()
  await page.waitForTimeout(500)
  check((await page.getByText(/3 Trainerstab-Sticker neu/).count()) > 0, `[${label}] „Sticker aus Kader erzeugen“ meldet Ergebnis`)
  await page.getByRole('button', { name: 'Neuer Sticker' }).click()
  await page.waitForTimeout(400)
  await shot('04-sticker-neu', false)
  await page.keyboard.press('Escape')
  await go('/admin/album?tab=gutscheine')
  await shot('05-gutscheine')
  await go('/admin/album?tab=einstellungen')
  await shot('06-regeln-pin')
  await page.getByLabel('Neue Stand-PIN').fill('4711')
  await page.getByRole('button', { name: 'PIN setzen' }).click()
  await page.waitForTimeout(500)
  check((await page.getByText(/Zuletzt gesetzt/).count()) === 1, `[${label}] Stand-PIN gesetzt`)
  await go('/admin/')
  if (label === 'mobil') {
    await page.getByRole('button', { name: 'Menü' }).click()
    await page.waitForTimeout(300)
  }
  check((await page.getByRole('link', { name: 'Album' }).count()) > 0, `[${label}] Navigation enthält „Album“`)
  await ctx.close()
}
await browser.close()
console.log(checks.join('\n'))
console.log(errors.length ? `\nKonsole: ${errors.length} Fehler\n${errors.join('\n')}` : '\nKonsole: 0 Fehler')
process.exit(checks.some((c) => c.startsWith('FEHLER')) || errors.length ? 1 : 0)
