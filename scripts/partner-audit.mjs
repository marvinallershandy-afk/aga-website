// v16-S: Admin „Partner“ headless durchklicken + screenshotten (desktop + 390 px).
// KEIN Login, KEINE echte DB: DEV-?preview-Bypass, alle REST-Antworten gemockt
// (Anfragen zustandsbehaftet, damit Status/Notiz wirklich wechseln), Uploads geblockt.
// Zusätzlich: Endstand-Story-Grafik mit „Live-Ticker präsentiert von“ (Vite-Modul).
//   npx vite --port 5189 --strictPort        (vorher starten)
//   BASE=http://localhost:5189 OUT=./shots-partner/admin node scripts/partner-audit.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5189'
const OUT = process.env.OUT || './shots-partner/admin'
fs.mkdirSync(OUT, { recursive: true })
const T = (d) => new Date(Date.now() + d * 864e5).toISOString()
const LOGO = (name, farbe) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="140" viewBox="0 0 400 140"><rect x="10" y="30" width="80" height="80" rx="16" fill="${farbe}"/><text x="50" y="86" font-family="Arial" font-size="44" font-weight="900" fill="#fff" text-anchor="middle">${name[0]}</text><text x="110" y="92" font-family="Arial" font-size="40" font-weight="900" fill="${farbe}">${name}</text></svg>`)}`

const PAKETE = [
  ['Bande am Spielfeld', 250, 'Saison', 8, true, 4], ['Trikot / Ärmel', null, 'Saison', 2, false, 2], ['Social-Media-Paket', 150, 'Saison', null, false, 3],
  ['„Spieltag präsentiert von“', 75, 'Spieltag', 15, false, 3], ['„Live-Ticker präsentiert von“', 300, 'Saison', 1, false, 2], ['Unterstützer', 50, 'Saison', null, false, 2],
].map(([name, preis, einheit, plaetze, hervor, n], i) => ({
  id: `0000000${i + 1}-0000-4000-8000-000000000000`, name, beschreibung: 'Kurzbeschreibung des Pakets für /partner.', leistungen: Array.from({ length: n }, (_, k) => `Leistung ${k + 1}`),
  preis_ab: preis, preis_einheit: einheit, plaetze, hervorgehoben: hervor, sichtbar: i !== 2, sortierung: (i + 1) * 10, created_at: T(-20), updated_at: T(-1),
}))
const DB = {
  sm_sponsoren: [
    { id: 'so1', name: 'Autohaus Müller', logo_url: LOGO('MÜLLER', '#0b3d91'), website_url: 'https://autohaus.example', aktiv: true, bande: true, stufe: 'hauptpartner', partner_paket_id: PAKETE[0].id, sortierung: 10 },
    { id: 'so2', name: 'Bäckerei Behrens', logo_url: LOGO('Behrens', '#8a4b14'), website_url: null, aktiv: true, bande: true, stufe: 'partner', partner_paket_id: PAKETE[0].id, sortierung: 20 },
    { id: 'so3', name: 'Elektro Lühmann', logo_url: null, website_url: null, aktiv: true, bande: false, stufe: 'unterstuetzer', partner_paket_id: null, sortierung: 30 },
    { id: 'so4', name: 'Getränke Kruse', logo_url: null, website_url: null, aktiv: false, bande: true, stufe: 'partner', partner_paket_id: null, sortierung: 40 },
  ].map((s) => ({ paket: null, laufzeit_von: null, laufzeit_bis: null, leistungen: null, ansprechpartner: null, kontakt: null, notizen: null, created_at: T(-90), updated_at: T(-3), ...s })),
  sva_partner_pakete: PAKETE,
  sva_partner_info: [{ id: 1, instagram_follower: 2840, reichweite_monat: 41000, zuschauer_heim: 120, website_besuche_monat: null, heimspiele_saison: 15, stand: '2026-10-01', live_partner_id: 'so1', updated_at: T(-2), updated_by: 'marvin@aga-erste.de' }],
  sva_partner_anfragen: [
    { id: 'an1', firma: 'Elektro Peters GmbH', ansprechpartner: 'Jana Peters', email: 'jana@peters.example', telefon: '04141 12345', paket_id: PAKETE[0].id, paket_name: 'Bande am Spielfeld', nachricht: 'Wir hätten Interesse an einer Bande ab der Rückrunde. Budget ca. 300 €.', quelle: 'instagram', datenschutz_ok: true, status: 'neu', notiz: null, ip_hash: null, created_at: T(-0.1), updated_at: T(-0.1) },
    { id: 'an2', firma: 'Fahrschule Pape', ansprechpartner: 'Tim Pape', email: 'tim@pape.example', telefon: null, paket_id: null, paket_name: null, nachricht: '[Noch unsicher, bitte beraten]', quelle: null, datenschutz_ok: true, status: 'neu', notiz: null, ip_hash: null, created_at: T(-1.2), updated_at: T(-1.2) },
    { id: 'an3', firma: 'Zimmerei Stahmer', ansprechpartner: 'Ole Stahmer', email: 'ole@stahmer.example', telefon: '0171 5550101', paket_id: PAKETE[3].id, paket_name: '„Spieltag präsentiert von“', nachricht: null, quelle: 'instagram', datenschutz_ok: true, status: 'in_kontakt', notiz: 'Rückruf Mi 18 Uhr', ip_hash: null, created_at: T(-6), updated_at: T(-4) },
    { id: 'an4', firma: 'Café Lindenhof', ansprechpartner: 'Anke Lüders', email: 'anke@lindenhof.example', telefon: null, paket_id: null, paket_name: 'Unterstützer', nachricht: null, quelle: null, datenschutz_ok: true, status: 'gewonnen', notiz: 'zugesagt, Logo kommt', ip_hash: null, created_at: T(-20), updated_at: T(-10) },
  ],
  sva_settings: [{ id: 1, fussball_de_team_id: null, fupa_url: null, instagram: 'svagathenburg', whatsapp: null, email: 'info@aga-erste.de', training: 'Di & Do, ab 19:00 Uhr', training_ort: null, adresse: 'Waldsportplatz Agathenburg', saison: '2026/27', rechtstexte_ok: false, updated_at: T(-4), updated_by: 'marvin@aga-erste.de', fussball_de_widget_tabelle: null, fussball_de_widget_spielplan: null }],
  sva_publish_log: [{ id: 'pl1', angefordert_at: T(-3), angefordert_von: 'marvin@aga-erste.de', status: 'ok', detail: null }],
  sva_lineup: [], sm_spiele: [], sm_roster: [], sm_tabelle: [],
  sm_insights: [{ id: 'i1', datum: T(-3).slice(0, 10), kanal: 'instagram', follower: 2911, reichweite: 9800, top_beitrag: null, notizen: null, created_at: T(-3), updated_at: T(-3) }],
}
const errors = []
const checks = []
const check = (ok, msg) => checks.push(`${ok ? 'OK ' : 'FEHLER'}  ${msg}`)

async function routes(ctx) {
  await ctx.route('**/rest/v1/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const table = url.pathname.split('/rest/v1/')[1]
    if (table === 'rpc/sva_meine_rolle') return route.fulfill({ status: 200, contentType: 'application/json', body: '"admin"' })
    if (table === 'rpc/web_live') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ partner: { name: 'Autohaus Müller', logoUrl: DB.sm_sponsoren[0].logo_url } }) })
    if (table === 'sva_partner_anfragen' && req.method() === 'PATCH') {
      const id = (url.searchParams.get('id') || '').replace('eq.', '')
      DB.sva_partner_anfragen = DB.sva_partner_anfragen.map((r) => (r.id === id ? { ...r, ...req.postDataJSON() } : r))
      return route.fulfill({ status: 204, body: '' })
    }
    if (req.method() === 'GET' && DB[table]) {
      const accept = req.headers()['accept'] || ''
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(accept.includes('vnd.pgrst.object') ? DB[table][0] ?? null : DB[table]) })
    }
    return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'audit: write blocked' }) })
  })
  await ctx.route('**/storage/v1/**', (r) => r.fulfill({ status: 403, body: '{}' }))
  await ctx.route('**/auth/v1/**', (r) => r.fulfill({ status: 403, body: '{}' }))
  await ctx.route('**/functions/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"configured":false}' }))
}

const browser = await chromium.launch()
for (const [label, vp] of [
  ['desktop', { viewport: { width: 1280, height: 860 } }],
  ['mobil', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
]) {
  const ctx = await browser.newContext(vp)
  await routes(ctx)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 403/.test(m.text())) errors.push(`[${label}] ${m.text().slice(0, 200)}`) })
  const go = async (p) => { await page.goto(`${BASE}${p}${p.includes('?') ? '&' : '?'}preview`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500) }
  const shot = async (name, full = true) => { await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/${label}-${name}.png`, fullPage: full }) }

  await go('/admin/')
  await shot('01-uebersicht')
  check((await page.getByText(/^\d+ neu$/).count()) > 0, `[${label}] Übersicht: Badge „x neu“`)
  await page.getByRole('link', { name: /Partner-Anfragen/ }).click()
  await page.waitForTimeout(500)
  check(page.url().includes('tab=anfragen'), `[${label}] Badge führt zu Anfragen`)
  await shot('05-anfragen')
  await page.getByRole('radio', { name: 'In Kontakt' }).first().click()
  await page.waitForTimeout(500)
  check(DB.sva_partner_anfragen[0].status === 'in_kontakt', `[${label}] Status neu → in Kontakt gespeichert`)
  await page.getByLabel('Notiz zu Elektro Peters GmbH').fill('Angebot Bande Rückrunde geschickt')
  await page.getByLabel('Notiz zu Elektro Peters GmbH').blur()
  await page.waitForTimeout(500)
  check(DB.sva_partner_anfragen[0].notiz === 'Angebot Bande Rückrunde geschickt', `[${label}] Notiz gespeichert`)
  await page.getByRole('button', { name: /^Alle/ }).click()
  await shot('06-anfragen-alle')
  await page.getByRole('button', { name: 'Als Sponsor anlegen' }).click()
  await page.waitForTimeout(500)
  check((await page.getByLabel('Name *').inputValue()) === 'Café Lindenhof', `[${label}] „Als Sponsor anlegen“ füllt den Namen vor`)
  await shot('07-sponsor-aus-anfrage', false)
  await page.keyboard.press('Escape')

  await go('/admin/sponsoren')
  await shot('02-sponsoren')
  check((await page.getByText('Hauptpartner').count()) > 0, `[${label}] Sponsoren mit Stufe`)
  await page.getByRole('button', { name: /Autohaus Müller/ }).first().click()
  await page.waitForTimeout(400)
  await shot('02b-sponsor-editor', false)
  await page.keyboard.press('Escape')

  await go('/admin/sponsoren?tab=pakete')
  await shot('03-pakete')
  check((await page.getByText('2 von 8 Plätzen gebucht · 6 frei').count()) > 0, `[${label}] Pakete: Belegung gerechnet`)
  await page.getByRole('button', { name: /Bande am Spielfeld/ }).first().click()
  await page.waitForTimeout(400)
  await shot('03b-paket-editor', false)
  await page.getByLabel('Preis ab (€)').fill('zwei')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await page.waitForTimeout(300)
  check((await page.getByText(/Preis bitte als ganze Euro/).count()) > 0, `[${label}] Paket: Preis wird geprüft`)
  await page.keyboard.press('Escape')

  await go('/admin/sponsoren?tab=zahlen')
  await shot('04-zahlen')
  check((await page.getByRole('button', { name: /2911 aus Insights/ }).count()) > 0, `[${label}] Zahlen: Follower aus Insights übernehmbar`)
  await ctx.close()
}

// Story-Grafik mit Partner (Modul direkt im Dev-Server rendern)
{
  const ctx = await browser.newContext({ viewport: { width: 600, height: 600 } })
  await routes(ctx)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/admin/login?preview`, { waitUntil: 'networkidle' })
  for (const [name, partner] of [['mit-partner', { name: 'Autohaus Müller', logoUrl: DB.sm_sponsoren[0].logo_url }], ['ohne-partner', null]]) {
    const png = await page.evaluate(async (partner) => {
      const m = await import('/src/admin/lib/storyGrafik.ts')
      const motm = { id: 'x', slug: 'p-helck', name: 'Tobias Helck', nummer: 24, position: 'MIT', foto_url: '/players/tobias-helck.webp', freisteller_url: '/players/cutout/tobias-helck.webp', kapitaen: true, im_verein_seit: null }
      const c = await m.renderErgebnisStory({ spiel: { gegner: 'TuS Fischbek', heim: true, anstoss: new Date().toISOString(), wettbewerb: 'Kreisliga Stade', spieltag_nr: 9 }, toreSva: 2, toreGegner: 1, torschuetzen: ["Warkehr 12'", "Biedermann 51'"], motm, partner })
      return c.toDataURL('image/png')
    }, partner)
    fs.writeFileSync(`${OUT}/story-${name}.png`, Buffer.from(png.split(',')[1], 'base64'))
  }
  await ctx.close()
}
await browser.close()
console.log(checks.join('\n'))
console.log('\n--- FEHLER ---\n' + (errors.length ? [...new Set(errors)].join('\n') : 'keine'))
