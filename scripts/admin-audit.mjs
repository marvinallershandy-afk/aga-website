// PHASE-0-Audit: klickt das Admin-Cockpit headless durch und screenshottet.
// KEIN Login, KEINE DB-Mutation: nutzt den eingebauten DEV-?preview-Bypass,
// GET-Antworten kommen aus einem echten (read-only) SQL-Dump, alle
// Schreib-Requests werden mit 403 geblockt, drive-bridge wird gemockt.
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5199'
const OUT = process.env.OUT || './screenshots-review/admin-audit'
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

const DUMP = {
  sm_content: [
    {"id":"af468651-6ae6-49f6-9ecb-508ae81d0750","titel":"Spieltag-Ankündigung: SVA vs. TuS Fischbek","beschreibung":"Anstoß So 15:00, Sportplatz Agathenburg. Aufruf: Kommt vorbei!","kanal":["instagram","facebook","whatsapp"],"status":"geplant","format":"Grafik","kategorie":"Spieltag","geplant_am":"2026-07-09","verantwortlich":"Marvin","idee_id":null,"notizen":null,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00","hook":null,"caption":null,"cta":null,"sound":null,"drive_rohmaterial_url":null,"drive_asset_url":null},
    {"id":"b6455cc1-60bf-4fc8-9e2f-e65f8357a038","titel":"Trainingsimpression Donnerstag","beschreibung":"Kurzes Reel vom Abschlusstraining.","kanal":["instagram","tiktok"],"status":"idee","format":"Reel","kategorie":"Team","geplant_am":"2026-07-10","verantwortlich":null,"idee_id":null,"notizen":null,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00","hook":null,"caption":null,"cta":null,"sound":null,"drive_rohmaterial_url":null,"drive_asset_url":null},
    {"id":"33be23e5-7f54-498e-ab66-fc1e34bd5d52","titel":"Startaufstellung SVA vs. TuS Fischbek","beschreibung":"Aufstellungs-Grafik ~1h vor Anpfiff.","kanal":["instagram","facebook"],"status":"geplant","format":"Grafik","kategorie":"Spieltag","geplant_am":"2026-07-11","verantwortlich":"Marvin","idee_id":null,"notizen":null,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00","hook":null,"caption":null,"cta":null,"sound":null,"drive_rohmaterial_url":"https://drive.google.com/drive/folders/demo123","drive_asset_url":null},
    {"id":"ca9bda15-0192-4e2b-bd36-04b2c1da92f1","titel":"Endergebnis SVA vs. TuS Fischbek","beschreibung":"Ergebnis-Kachel direkt nach Abpfiff.","kanal":["instagram","facebook","whatsapp"],"status":"idee","format":"Grafik","kategorie":"Spieltag","geplant_am":"2026-07-11","verantwortlich":null,"idee_id":null,"notizen":null,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00","hook":null,"caption":null,"cta":null,"sound":null,"drive_rohmaterial_url":null,"drive_asset_url":null},
    {"id":"ef083dce-1a42-45de-b31c-9d5e7849fb1d","titel":"MOTM des Spieltags","beschreibung":"Spieler des Spiels küren.","kanal":["instagram"],"status":"idee","format":"Grafik","kategorie":"Spieltag","geplant_am":"2026-07-12","verantwortlich":null,"idee_id":null,"notizen":null,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00","hook":null,"caption":null,"cta":null,"sound":null,"drive_rohmaterial_url":null,"drive_asset_url":null},
    {"id":"3e3d9a89-0990-4503-add8-d1f3c720281e","titel":"Rückblick der Woche","beschreibung":"Alle Mannschaften im Überblick.","kanal":["instagram","website"],"status":"idee","format":"Karussell","kategorie":"Verein","geplant_am":"2026-07-12","verantwortlich":null,"idee_id":null,"notizen":null,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00","hook":null,"caption":null,"cta":null,"sound":null,"drive_rohmaterial_url":null,"drive_asset_url":null},
    {"id":"47ae55d8-3c57-4b05-94fa-f96156b1d567","titel":"Sponsor des Monats: Autohaus Müller","beschreibung":"Partner vorstellen, Danke sagen.","kanal":["instagram","facebook"],"status":"in_arbeit","format":"Post","kategorie":"Sponsoren","geplant_am":"2026-07-13","verantwortlich":"Marvin","idee_id":null,"notizen":null,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00","hook":null,"caption":null,"cta":null,"sound":null,"drive_rohmaterial_url":null,"drive_asset_url":null}
  ],
  sm_ideen_pool: [
    {"id":"80efa74c-4911-4409-b2c4-9e197aad93ac","titel":"Spieltag-Ankündigung","beschreibung":"Gegner, Anstoßzeit, Ort – Freitag vor dem Spiel.","kanal":["instagram","facebook","whatsapp"],"kategorie":"Spieltag","rhythmus":"pro_spieltag","aktiv":true,"sortierung":10,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00"},
    {"id":"f607fb45-cdbe-418c-9f32-a8b4581f3f6d","titel":"Startaufstellung","beschreibung":"Grafik mit Aufstellung ~1h vor Anpfiff.","kanal":["instagram","facebook"],"kategorie":"Spieltag","rhythmus":"pro_spieltag","aktiv":true,"sortierung":20,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00"},
    {"id":"ff3c5bfc-ac1e-4b27-9aa0-4e1cfb636165","titel":"Endergebnis","beschreibung":"Ergebnis-Kachel direkt nach Abpfiff.","kanal":["instagram","facebook","whatsapp"],"kategorie":"Spieltag","rhythmus":"pro_spieltag","aktiv":true,"sortierung":30,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00"},
    {"id":"1faa8c2f-4a18-4beb-aed1-25af1ddea077","titel":"Spieler des Spiels (MOTM)","beschreibung":"Man of the Match küren – Sonntagabend.","kanal":["instagram"],"kategorie":"Spieltag","rhythmus":"pro_spieltag","aktiv":true,"sortierung":40,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00"},
    {"id":"c87d68c8-6a86-4251-be6d-d7d77f553c46","titel":"Trainingsimpression","beschreibung":"Foto/Reel aus dem Training – Dienstag/Donnerstag.","kanal":["instagram","tiktok"],"kategorie":"Team","rhythmus":"woechentlich","aktiv":true,"sortierung":50,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00"},
    {"id":"2f64663b-b48d-4adf-a5e8-6162f0986f4c","titel":"Geburtstagsgruß","beschreibung":"Spieler-/Mitglieder-Geburtstage.","kanal":["instagram","facebook"],"kategorie":"Community","rhythmus":"einmalig","aktiv":true,"sortierung":60,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00"},
    {"id":"aedb4809-243f-4538-9996-d20a661948e3","titel":"Sponsor des Monats","beschreibung":"Partner vorstellen, Danke sagen.","kanal":["instagram","facebook"],"kategorie":"Sponsoren","rhythmus":"monatlich","aktiv":true,"sortierung":70,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00"},
    {"id":"b1e49ad0-c14e-43fd-a3c1-c8ab439bc4bf","titel":"Rückblick der Woche","beschreibung":"Wochenrückblick aller Mannschaften – Sonntag.","kanal":["instagram","website"],"kategorie":"Verein","rhythmus":"woechentlich","aktiv":true,"sortierung":80,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00"},
    {"id":"95260e5a-4605-471b-bc4e-0cbf15ced3ff","titel":"Tabellen-Update","beschreibung":"Aktueller Tabellenstand nach dem Spieltag.","kanal":["instagram","facebook"],"kategorie":"Spieltag","rhythmus":"woechentlich","aktiv":true,"sortierung":90,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00"},
    {"id":"1199fd9d-b2a7-45eb-9015-59f58fdef307","titel":"Neuzugang / Vertragsverlängerung","beschreibung":"Transfer-News ankündigen.","kanal":["instagram","facebook"],"kategorie":"Team","rhythmus":"einmalig","aktiv":true,"sortierung":100,"created_at":"2026-07-08T16:21:46.286134+00:00","updated_at":"2026-07-08T16:21:46.286134+00:00"}
  ],
  sm_ideen_eingang: [
    {"id":"bd55f86a-858b-4ebc-b121-a4035aa211c8","titel":"Kabinen-Karaoke nach dem Heimsieg","beschreibung":"Kurzes Reel: Team singt den Vereins-Song in der Kabine. Stimmung pur.","von":"Nico","kanal":["instagram","tiktok"],"status":"offen","content_id":null,"created_at":"2026-07-09T13:19:01.178116+00:00","updated_at":"2026-07-09T13:19:01.178116+00:00"},
    {"id":"68666d32-a53e-4775-8329-08501095191b","titel":"Spieler-Steckbrief: Lieblingsessen & Trikotnummer","beschreibung":"Schnelle Frage-Antwort-Story mit einem Spieler pro Woche.","von":"Nico","kanal":["instagram"],"status":"offen","content_id":null,"created_at":"2026-07-09T13:19:01.178116+00:00","updated_at":"2026-07-09T13:19:01.178116+00:00"},
    {"id":"9f5f0cd2-c959-4748-b2cc-8ef2815bb47a","titel":"Torhymne-Voting","beschreibung":"Fans stimmen per Story-Sticker über die nächste Torhymne ab.","von":"Marvin","kanal":["instagram","facebook"],"status":"geprueft","content_id":null,"created_at":"2026-07-09T13:19:01.178116+00:00","updated_at":"2026-07-09T13:19:01.178116+00:00"}
  ],
  sm_sponsoren: [
    { id: 'so1', name: 'Autohaus Müller', paket: 'gold', laufzeit_von: '2025-08-01', laufzeit_bis: new Date(Date.now() + 32 * 864e5).toISOString().slice(0, 10), leistungen: 'Bande + 2 Instagram-Posts pro Saison + Trikotärmel', ansprechpartner: 'K. Müller', kontakt: 'info@autohaus-mueller.de', logo_url: null, aktiv: true, notizen: null, created_at: '2025-08-01T10:00:00Z', updated_at: '2025-08-01T10:00:00Z' },
    { id: 'so2', name: 'Bäckerei Behrens', paket: 'silber', laufzeit_von: '2025-07-01', laufzeit_bis: '2027-06-30', leistungen: 'Bande + Sponsor des Monats', ansprechpartner: 'H. Behrens', kontakt: '04141 555 123', logo_url: null, aktiv: true, notizen: null, created_at: '2025-07-01T10:00:00Z', updated_at: '2025-07-01T10:00:00Z' },
    { id: 'so3', name: 'Getränke Kruse', paket: 'bronze', laufzeit_von: '2024-07-01', laufzeit_bis: '2025-06-30', leistungen: 'Bande', ansprechpartner: null, kontakt: null, logo_url: null, aktiv: false, notizen: 'Nicht verlängert.', created_at: '2024-07-01T10:00:00Z', updated_at: '2025-07-01T10:00:00Z' },
  ],
  sm_admins: [{ email: 'preview@audit.local' }],
  sm_insights: Array.from({ length: 8 }, (_, i) => ({
    id: `ig-${i}`, datum: new Date(Date.now() - (7 - i) * 7 * 864e5).toISOString().slice(0, 10),
    kanal: 'instagram', follower: 320 + i * 14 + (i % 3) * 5, reichweite: 1800 + i * 210,
    top_beitrag: i === 7 ? 'Endergebnis-Kachel SVA vs. Apensen' : null, notizen: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  })).concat(Array.from({ length: 4 }, (_, i) => ({
    id: `tt-${i}`, datum: new Date(Date.now() - (3 - i) * 7 * 864e5).toISOString().slice(0, 10),
    kanal: 'tiktok', follower: 95 + i * 22, reichweite: 4200 + i * 800,
    top_beitrag: null, notizen: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }))),
  sm_spiele: [
    { id: 'sp1', gegner: 'TSV Apensen', heim: false, anstoss: new Date(Date.now() - 6 * 864e5).toISOString(), ort: 'Sportplatz Apensen', wettbewerb: 'Kreisliga Stade', spieltag_nr: 21, tore_sva: 2, tore_gegner: 2, notizen: null, created_at: new Date(Date.now() - 20 * 864e5).toISOString(), updated_at: new Date(Date.now() - 6 * 864e5).toISOString() },
    { id: 'sp2', gegner: 'TuS Fischbek', heim: true, anstoss: new Date(Date.now() + 2 * 864e5 + 3 * 36e5).toISOString(), ort: 'Sportplatz Agathenburg', wettbewerb: 'Kreisliga Stade', spieltag_nr: 22, tore_sva: null, tore_gegner: null, notizen: null, created_at: new Date(Date.now() - 10 * 864e5).toISOString(), updated_at: new Date(Date.now() - 10 * 864e5).toISOString() },
    { id: 'sp3', gegner: 'VfL Güldenstern Stade III', heim: false, anstoss: new Date(Date.now() + 9 * 864e5).toISOString(), ort: 'Güldenstern-Arena', wettbewerb: 'Kreisliga Stade', spieltag_nr: 23, tore_sva: null, tore_gegner: null, notizen: null, created_at: new Date(Date.now() - 10 * 864e5).toISOString(), updated_at: new Date(Date.now() - 10 * 864e5).toISOString() },
  ],
  sm_roster: [
    { id: 'r1', name: 'Carsten Beckmann', nummer: 1, position: 'Torwart', foto_url: '/players/carsten.webp', aktiv: true, sortierung: 10, steckbrief: {}, created_at: '2026-07-01T10:00:00Z', updated_at: '2026-07-01T10:00:00Z' },
    { id: 'r2', name: 'Lennard Voss', nummer: 4, position: 'Abwehr', foto_url: '/players/lennard.webp', aktiv: true, sortierung: 20, steckbrief: {}, created_at: '2026-07-01T10:00:00Z', updated_at: '2026-07-01T10:00:00Z' },
    { id: 'r3', name: 'Julio Fernandes', nummer: 8, position: 'Mittelfeld', foto_url: '/players/julio.webp', aktiv: true, sortierung: 30, steckbrief: {}, created_at: '2026-07-01T10:00:00Z', updated_at: '2026-07-01T10:00:00Z' },
    { id: 'r4', name: 'Nico Hause', nummer: 10, position: 'Mittelfeld', foto_url: '/players/nico-hause.webp', aktiv: true, sortierung: 40, steckbrief: { im_verein_seit: '2018', lieblingsessen: 'Lasagne', lieblingsverein: 'HSV', staerke: 'Übersicht', motto: 'Immer weiter.' }, created_at: '2026-07-01T10:00:00Z', updated_at: '2026-07-01T10:00:00Z' },
    { id: 'r5', name: 'Tino Albers', nummer: 9, position: 'Sturm', foto_url: '/players/tino.webp', aktiv: true, sortierung: 50, steckbrief: {}, created_at: '2026-07-01T10:00:00Z', updated_at: '2026-07-01T10:00:00Z' },
    { id: 'r6', name: 'Eli Brandt', nummer: 11, position: 'Sturm', foto_url: '/players/eli.webp', aktiv: false, sortierung: 60, steckbrief: {}, created_at: '2026-07-01T10:00:00Z', updated_at: '2026-07-01T10:00:00Z' },
  ],
}

const PAKET_ROWS = [
  { titel: 'Spieltag-Ankündigung: SVA vs. TuS Fischbek' },
  { titel: 'Startaufstellung: SVA vs. TuS Fischbek' },
  { titel: 'Endergebnis: SVA vs. TuS Fischbek' },
  { titel: 'Spieler des Spiels: SVA vs. TuS Fischbek' },
].map((r, i) => ({
  id: `paket-${i}`, beschreibung: null, kanal: ['instagram'], status: 'geplant', format: 'Grafik',
  kategorie: 'Spieltag', geplant_am: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10),
  verantwortlich: null, idee_id: null, notizen: null, hook: null, caption: null, cta: null, sound: null,
  drive_rohmaterial_url: null, drive_asset_url: null, spiel_id: 'sp2',
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...r,
}))

const DRIVE_FILES = {
  root: {
    folder: { id: 'root', name: 'SVA Social Media', webViewLink: 'https://drive.google.com/drive/folders/root' },
    files: [
      { id: 'f1', name: '01 Rohmaterial', mimeType: 'application/vnd.google-apps.folder', modifiedTime: '2026-07-05T10:00:00Z', webViewLink: '#' },
      { id: 'f2', name: '02 Fertige Assets', mimeType: 'application/vnd.google-apps.folder', modifiedTime: '2026-07-08T09:00:00Z', webViewLink: '#' },
      { id: 'f3', name: '03 Vorlagen', mimeType: 'application/vnd.google-apps.folder', modifiedTime: '2026-06-20T12:00:00Z', webViewLink: '#' },
      { id: 'd1', name: 'Spieltag_2026-07-11_Ankuendigung.png', mimeType: 'image/png', size: '482133', modifiedTime: '2026-07-09T14:00:00Z', webViewLink: '#' },
      { id: 'd2', name: 'Training_Reel_Rohschnitt.mp4', mimeType: 'video/mp4', size: '58231344', modifiedTime: '2026-07-09T18:30:00Z', webViewLink: '#' },
    ],
  },
  f1: {
    folder: { id: 'f1', name: '01 Rohmaterial', webViewLink: '#' },
    files: [
      { id: 'd3', name: 'IMG_2041.jpg', mimeType: 'image/jpeg', size: '3120400', modifiedTime: '2026-07-09T18:00:00Z', webViewLink: '#' },
      { id: 'd4', name: 'IMG_2042.jpg', mimeType: 'image/jpeg', size: '2988112', modifiedTime: '2026-07-09T18:01:00Z', webViewLink: '#' },
    ],
  },
}

const errors = []
const clicks = []

async function setupRoutes(ctx) {
  await ctx.route('**/rest/v1/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const table = url.pathname.split('/rest/v1/')[1]?.split('?')[0]
    if (table === 'rpc/sm_spieltagspaket') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PAKET_ROWS) })
    }
    if (req.method() === 'GET' && table && DUMP[table]) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DUMP[table]) })
    }
    // Audit-Modus: alles andere (Schreibzugriffe) hart blocken.
    return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'audit: write blocked' }) })
  })
  await ctx.route('**/functions/v1/drive-bridge', async (route) => {
    let body = {}
    try { body = route.request().postDataJSON() ?? {} } catch { /* ignore */ }
    if (body.action === 'list') {
      const node = DRIVE_FILES[body.folderId] ?? DRIVE_FILES.root
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: true, ...node }) })
    }
    return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'audit: write blocked' }) })
  })
  await ctx.route('**/auth/v1/**', (route) => route.fulfill({ status: 403, contentType: 'application/json', body: '{}' }))
}

async function run(label, viewport) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext(viewport)
  await setupRoutes(ctx)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${label}] console: ${m.text().slice(0, 300)}`) })

  let n = 0
  const shot = async (name, full = false) => {
    const file = `${label}-${String(n).padStart(2, '0')}-${name}.png`
    await page.waitForTimeout(350)
    await page.screenshot({ path: `${OUT}/${file}`, fullPage: full })
    console.log(file)
    n++
  }
  const go = async (path) => {
    await page.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}preview`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
  }
  const tryClick = async (locator, desc) => {
    try {
      await locator.first().click({ timeout: 3000 })
      clicks.push(`[${label}] OK  ${desc}`)
      await page.waitForTimeout(450)
      return true
    } catch {
      clicks.push(`[${label}] FEHLT/NICHT KLICKBAR  ${desc}`)
      return false
    }
  }

  // Login (ohne Preview-Session zeigt / die Login-Umleitung; hier direkt)
  await go('/admin/login')
  await shot('login')

  // Dashboard
  await go('/admin/')
  await shot('dashboard', true)

  // Redaktionsplan: Tabelle → Woche → Kanban → Suche → Editor → Neu
  await go('/admin/redaktionsplan')
  await shot('plan-tabelle', true)
  if (await tryClick(page.getByRole('tab', { name: /woche/i }), 'Plan: Ansicht Woche')) await shot('plan-woche', true)
  if (await tryClick(page.getByRole('tab', { name: /kanban/i }), 'Plan: Ansicht Kanban')) await shot('plan-kanban', true)
  await tryClick(page.getByRole('tab', { name: /tabelle/i }), 'Plan: zurück zu Tabelle')
  try {
    await page.getByLabel('Beiträge durchsuchen').fill('Sponsor')
    await page.waitForTimeout(400)
    await shot('plan-suche')
    await page.getByLabel('Beiträge durchsuchen').fill('')
  } catch { clicks.push(`[${label}] FEHLT Suche`) }
  if (await tryClick(page.locator('table tbody tr'), 'Plan: Zeile öffnen (Editor)')) {
    await shot('plan-editor', true)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await tryClick(page.getByRole('button', { name: /abbrechen|schließen/i }), 'Plan: Editor schließen (Button)')
  }
  if (await tryClick(page.getByRole('button', { name: /neuer beitrag/i }), 'Plan: Neuer Beitrag')) {
    await shot('plan-neu')
    await page.keyboard.press('Escape')
    await tryClick(page.getByRole('button', { name: /abbrechen|schließen/i }), 'Plan: Neu-Modal schließen')
  }

  // Ideen: Bibliothek + Eingang + Editor
  await go('/admin/ideen')
  await shot('ideen-bibliothek', true)
  if (await tryClick(page.getByRole('tab', { name: /eingang/i }), 'Ideen: Tab Eingang')) await shot('ideen-eingang', true)
  if (await tryClick(page.getByRole('button', { name: /bearbeiten/i }), 'Ideen: Editor öffnen')) {
    await shot('ideen-editor')
    await page.keyboard.press('Escape')
    await tryClick(page.getByRole('button', { name: /abbrechen|schließen/i }), 'Ideen: Editor schließen')
  }

  // Spiele & Kader (P2)
  await go('/admin/spiele')
  await shot('spiele', true)
  if (await tryClick(page.getByRole('button', { name: /spieltagspaket/i }), 'Spiele: Spieltagspaket anlegen')) {
    await shot('spiele-paket-toast')
  }
  if (await tryClick(page.getByRole('button', { name: 'Bearbeiten' }).first(), 'Spiele: Spiel-Editor öffnen')) {
    await shot('spiele-editor')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }
  if (await tryClick(page.getByRole('tab', { name: /kader/i }), 'Spiele: Tab Kader')) {
    await shot('kader', true)
    if (await tryClick(page.getByRole('button', { name: /neuer spieler/i }).first(), 'Kader: Spieler-Editor öffnen')) {
      await shot('kader-editor')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }
  }

  // Produktion + Drive-Browser (gemockt)
  await go('/admin/produktion')
  await shot('produktion', true)
  if (await tryClick(page.getByRole('button', { name: /drive|laden|verbinden|anzeigen/i }), 'Produktion: Drive-Browser laden')) {
    await shot('produktion-drive', true)
    if (await tryClick(page.getByText('01 Rohmaterial'), 'Produktion: in Unterordner navigieren')) await shot('produktion-drive-sub')
  }

  // Matchday-Generator: alle 4 Templates + Story-Format + Export
  await go('/admin/matchday')
  await shot('matchday-spieltag', true)
  // Prefill: Spiel aus Dropdown übernehmen
  try {
    await page.locator('#md-spiel').selectOption('sp2')
    await page.waitForTimeout(400)
    clicks.push(`[${label}] OK  Matchday: Spiel-Prefill (Dropdown)`)
    await shot('matchday-prefill')
  } catch {
    clicks.push(`[${label}] FEHLT Matchday: Spiel-Prefill`)
  }
  // Steckbrief-Template inkl. Kader-Übernahme
  if (await tryClick(page.getByRole('button', { name: /steckbrief/i }), 'Matchday: Template Steckbrief')) {
    try {
      await page.locator('select').filter({ hasText: 'Spieler wählen' }).first().selectOption('r4')
      await page.waitForTimeout(400)
      clicks.push(`[${label}] OK  Matchday: Steckbrief aus Kader (Nico)`)
    } catch {
      clicks.push(`[${label}] FEHLT Matchday: Steckbrief-Kader-Select`)
    }
    await shot('matchday-steckbrief', true)
  }
  for (const t of ['Aufstellung', 'Ergebnis', 'MOTM']) {
    if (await tryClick(page.getByRole('button', { name: new RegExp(t, 'i') }), `Matchday: Template ${t}`)) {
      await shot(`matchday-${t.toLowerCase()}`)
    }
  }
  if (await tryClick(page.getByRole('button', { name: /story/i }), 'Matchday: Format Story')) await shot('matchday-story', true)
  if (label === 'desktop') {
    try {
      const dl = page.waitForEvent('download', { timeout: 15000 }).catch(() => null)
      await page.getByRole('button', { name: /png|export|herunterladen/i }).first().click()
      const d = await dl
      if (!d) throw new Error('kein Download-Event innerhalb 15s')
      clicks.push(`[desktop] OK  Matchday: PNG-Export → ${d.suggestedFilename()}`)
      await d.saveAs(`${OUT}/export-${d.suggestedFilename()}`)
    } catch (e) {
      clicks.push(`[desktop] FEHLGESCHLAGEN  Matchday: PNG-Export (${String(e).slice(0, 120)})`)
    }
    await shot('matchday-nach-export')
  }

  // Sponsoren-CRM (P4)
  await go('/admin/sponsoren')
  await shot('sponsoren', true)
  if (await tryClick(page.getByRole('button', { name: /neuer sponsor/i }).first(), 'Sponsoren: Editor öffnen')) {
    await shot('sponsoren-editor', true)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }

  // Insights (P5)
  await go('/admin/insights')
  await shot('insights', true)
  if (await tryClick(page.getByRole('button', { name: /kpis eintragen/i }).first(), 'Insights: Editor öffnen')) {
    await shot('insights-editor')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }

  // Mobil: Drawer
  if (label === 'mobile') {
    await go('/admin/')
    if (await tryClick(page.getByRole('button', { name: /menü/i }), 'Mobil: Drawer öffnen')) await shot('drawer')
  }

  await browser.close()
}

await run('desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await run('mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

console.log('\n--- KLICK-PROTOKOLL ---')
for (const c of clicks) console.log(c)
console.log('\n--- KONSOLEN-/SEITENFEHLER ---')
if (!errors.length) console.log('keine')
for (const e of [...new Set(errors)]) console.log(e)
console.log('\nFERTIG →', OUT)
