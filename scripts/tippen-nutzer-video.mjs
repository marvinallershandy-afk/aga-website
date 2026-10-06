// v21-T: Handy-Session wie ein echter neuer Fan, als Video (Playwright recordVideo, 390×844).
// Startseite → Spieltag-Panel → Tipp-Liga → Einführung → Tipp (Gast) → Login (gemockt:
// Link „angeklickt“) → Profil → Tipp wird automatisch abgeschickt → +1 Karte → Album →
// zurück → Rangliste → Ligen → Liga gründen.
// KEINE echte DB: alle Supabase-Aufrufe gemockt (tipp_*, album_*, /auth/v1).
//   VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 5193 --strictPort
//   BASE=http://localhost:5193 OUT=./shots-v21-tipp/video KATALOG_JSON=<album_katalog.json> node scripts/tippen-nutzer-video.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
import { DUELL, LIGA_TIPPS, VERTEILUNG, lageFixture, ranglisteFixture } from './tippen-fixtures.mjs'

const BASE = process.env.BASE || 'http://localhost:5193'
const OUT = process.env.OUT || './shots-v21-tipp/video'
fs.mkdirSync(OUT, { recursive: true })
const KATALOG = process.env.KATALOG_JSON ? JSON.parse(fs.readFileSync(process.env.KATALOG_JSON, 'utf8')) : { saison: '2026/27', aktiv: true, regeln: { chancen: {}, kartenProPack: 3, fensterVorMin: 60, fensterNachMin: 120, bonusHeimsieg: false, belohnungen: [] }, karten: [] }
const USER = { id: '22222222-2222-4222-8222-222222222222', aud: 'authenticated', role: 'authenticated', email: 'mia@fan.example', app_metadata: { provider: 'email' }, user_metadata: { app: 'sva-album' }, created_at: new Date().toISOString() }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 86400
const JWT = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, email: USER.email, role: 'authenticated', aud: 'authenticated', exp })}.sig`
const SESSION = JSON.stringify({ access_token: JWT, refresh_token: 'r-video', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: USER })
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) })

// Zustand des „Servers“
const z = { stufe: 'gast', ligen: [] }
const lage = () => {
  if (z.stufe === 'gast') return lageFixture('frisch-gast')
  const l = lageFixture(z.stufe === 'getippt' ? 'getippt' : 'neu')
  const ich = { email: USER.email, profil: { vorname: 'Mia', initial: 'S', anzeigename: 'Mia S.' }, abzeichen: z.stufe === 'getippt' ? [{ key: 'erster_tipp', at: new Date().toISOString() }] : [], tippsGesamt: z.stufe === 'getippt' ? 1 : 0, ligen: z.ligen.length }
  if (z.stufe === 'login') return { ...l, gewertet: undefined, ich }
  return { ...l, gewertet: undefined, ich: { ...ich, teilnehmer: { sichtbar: true, kabine: false, seit: new Date().toISOString() }, jokerFrei: true, statistik: { punkte: 0, spieltage: 0, exakt: 0, beste: 0 } } }
}
const mein = () => ({
  email: USER.email, saison: '2026/27', profil: { vorname: 'Mia', initial: 'S', anzeigename: 'Mia S.', rangliste: false, erinnerung: false },
  checkins: 0, checkinsGesamt: 0, spiele: [], besitz: KATALOG.karten.slice(0, 2).map((k) => ({ karteId: k.id, anzahl: 1 })),
  packs: z.stufe === 'getippt' ? [{ id: 'pk-tipp', art: 'tipp', anzahl: 1, at: new Date().toISOString(), titel: 'Tipp-Karte' }] : [], gutscheine: [],
})

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, recordVideo: { dir: OUT, size: { width: 390, height: 844 } } })
const notizen = []
const notiz = (t) => {
  notizen.push(`${new Date().toISOString().slice(11, 19)}  ${t}`)
  console.log(t)
}
await ctx.route(/supabase\.co\//, async (route) => {
  const req = route.request()
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
  const u = new URL(req.url())
  if (u.pathname.includes('/auth/v1/')) {
    if (u.pathname.endsWith('/otp')) return json(route, {})
    if (u.pathname.endsWith('/user')) return json(route, USER)
    return json(route, { error: 'video' }, 400)
  }
  const name = u.pathname.split('/rpc/')[1]
  let a = {}
  try { a = req.postDataJSON() ?? {} } catch { /* leer */ }
  switch (name) {
    case 'tipp_lage': return json(route, lage())
    case 'tipp_rangliste': return json(route, ranglisteFixture(a.p_art, !!a.p_liga))
    case 'tipp_duell': return json(route, DUELL)
    case 'tipp_verteilung': return json(route, VERTEILUNG)
    case 'tipp_meine_ligen': return json(route, z.ligen)
    case 'tipp_liga_tipps': return json(route, LIGA_TIPPS)
    case 'tipp_kabinen_liga': return json(route, { id: 'liga-kabine', name: 'Kabinen-Liga', system: 'kabine', mitglieder: 9 })
    case 'tipp_beitreten': z.stufe = 'neu'; notiz('RPC tipp_beitreten'); return json(route, { ok: true })
    case 'tipp_abgeben': z.stufe = 'getippt'; notiz(`RPC tipp_abgeben ${a.p_tore_sva}:${a.p_tore_gegner}`); return json(route, { ok: true, neu: true, karte: true, abzeichen: ['erster_tipp'], anzahlTipps: 38 })
    case 'tipp_elf_speichern': notiz(`RPC tipp_elf_speichern ${a.p_spieler?.join(',')} C=${a.p_kapitaen}`); return json(route, { ok: true })
    case 'tipp_liga_gruenden': {
      const l = { id: 'liga-neu', name: a.p_name, code: 'K7Q2MX' }
      z.ligen = [{ ...l, gruender: true, mitglieder: 1, meinPlatz: 1, fuehrender: 'Mia S.' }]
      notiz(`RPC tipp_liga_gruenden ${a.p_name}`)
      return json(route, l)
    }
    case 'album_katalog': return json(route, KATALOG)
    case 'album_mein': return json(route, mein())
    case 'web_zaehlen': return json(route, true)
    default: return json(route, null)
  }
})
await ctx.route('**/api/album-sitzung**', (r) => r.fulfill({ status: 204, body: '' }))

const page = await ctx.newPage()
const fehler = []
page.on('pageerror', (e) => fehler.push(e.message))
const pause = (ms = 900) => page.waitForTimeout(ms)
const t0 = Date.now()

// 1) Startseite → Spieltag-Panel → Tipp-Liga
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await pause(2500)
notiz('Startseite geladen')
await page.getByText('Spieltag & Live', { exact: true }).first().click({ timeout: 5000 }).catch(() => notiz('HAKT: Spieltag-Panel-Knopf nicht gefunden'))
await pause(1800)
const zurTipp = page.locator('a[href^="/tippen"]').first()
if (await zurTipp.isVisible().catch(() => false)) {
  notiz(`Einstieg im Panel: „${(await zurTipp.textContent())?.trim().slice(0, 40)}“`)
  await zurTipp.click()
} else {
  notiz('HAKT: im Spieltag-Panel kein sichtbarer Tipp-Liga-Link (ohne Spieldaten?) → über /tippen direkt')
  await page.goto(`${BASE}/tippen?utm_source=video`)
}
await page.waitForURL(/\/tippen/)
await pause(1500)

// 2) Einführung (3 Schritte)
const einf = page.locator('.tp-einf')
if (await einf.isVisible().catch(() => false)) {
  notiz('Einführung erscheint beim ersten Besuch')
  for (let i = 0; i < 3; i++) {
    await pause(1600)
    await page.getByRole('button', { name: /Weiter|Los geht/ }).click()
  }
  await pause(900)
} else notiz('HAKT: keine Einführung beim ersten Besuch')

// 3) Tipp als Gast
await page.locator('.tp-schritt').click()
await pause(1200)
for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'SVA: ein Tor mehr' }).click()
await page.getByRole('button', { name: /: ein Tor mehr/ }).nth(1).click()
await pause(600)
for (let i = 0; i < 3; i++) {
  await page.locator('.tp-frage .tp-option').first().click()
  await pause(700)
}
await page.locator('.tp-elf').scrollIntoViewIfNeeded()
await pause(800)
// einen Platz von Hand besetzen, den Rest „Freie Plätze füllen“
await page.locator('.tp-slot__leer').first().click()
await pause(900)
await page.locator('.tp-wahl button:not([disabled]):not(.is-drin)').first().click()
await pause(700)
await page.getByRole('button', { name: 'Freie Plätze füllen' }).click()
await pause(1200)
notiz(`Hinweis zur Binde sichtbar: ${await page.locator('.tp-binde-tipp').isVisible().catch(() => false)}`)
const binde = page.locator('.tp-binde-knopf').first()
if (await binde.count()) {
  await binde.click()
  notiz('Kapitän per Binde gewählt')
}
await pause(900)
const ent = await page.evaluate(() => JSON.parse(localStorage.getItem('sva-tipp-entwurf') || 'null'))
notiz(`Entwurf: ${ent?.toreSva}:${ent?.toreGegner} · Elf ${(ent?.elf ?? []).filter(Boolean).length}/5 · Kapitän ${ent?.kapitaen ?? '–'}`)
await page.getByRole('button', { name: 'Tipp abgeben' }).click()
await pause(1200)
notiz(`Login-Sheet: ${(await page.locator('.al-sheet__titel').first().textContent().catch(() => '–'))?.trim()}`)
await page.getByRole('textbox', { name: 'E-Mail-Adresse' }).fill('mia@fan.example')
const ok = page.locator('.tp-check input').first()
if (!(await ok.isChecked())) await ok.check()
await page.getByRole('button', { name: 'Login-Link schicken' }).click()
await pause(1600)
// „Link in der E-Mail antippen“: Sitzung liegt jetzt im Speicher, Seite lädt neu
z.stufe = 'login'
await page.evaluate((s) => localStorage.setItem('sva-album-auth', s), SESSION)
await page.goto(`${BASE}/tippen`)
await pause(1800)
notiz(`nach Login: ${(await page.locator('.al-sheet__titel').first().textContent().catch(() => '–'))?.trim()}`)
await page.getByRole('textbox', { name: 'Vorname' }).fill('Mia', { timeout: 1500 }).catch(() => {})
await page.getByRole('textbox', { name: 'Initial' }).fill('S', { timeout: 1500 }).catch(() => {})
for (const c of await page.locator('.al-sheet .tp-check input').all()) if (!(await c.isChecked())) await c.check()
await page.getByRole('button', { name: 'Mitmachen' }).click()
await pause(2600)
const bel = await page.locator('.tp-belohnung').getByText(/Tipp-Pack · 2 Karten/).first().isVisible().catch(() => false)
notiz(bel ? 'Belohnung „Tipp-Pack · 2 Karten“ nach Login automatisch' : 'HAKT: keine Belohnung nach dem Login sichtbar')
await pause(1500)

// 4) Ins Album und zurück
await page.getByRole('button', { name: /Tipp-Pack öffnen/ }).click().catch(() => notiz('HAKT: „Tipp-Pack öffnen“ fehlt'))
await page.waitForURL(/\/album/).catch(() => {})
await pause(3000)
notiz(`Album geladen: ${await page.title()}`)
const tuete = await page.locator('.al-tuete-badge, .hf-tuetchen').first().isVisible().catch(() => false)
notiz(tuete ? 'Album zeigt das wartende Tütchen' : 'Album: kein Tütchen-Hinweis sichtbar')
const rueck = page.locator('a.al-wechsel__b', { hasText: 'Tipp-Liga' })
if (await rueck.isVisible().catch(() => false)) {
  await rueck.click()
  notiz('zurück über den Umschalter „Tipp-Liga“ im Album-Kopf')
} else {
  await page.goBack()
  notiz('zurück per Browser-Zurück')
}
await page.waitForURL(/\/tippen/)
await pause(2000)

// 5) Rangliste → Ligen → Liga gründen
await page.locator('.tp-tabs--unten a', { hasText: 'Rangliste' }).click()
await pause(2200)
await page.getByRole('tab', { name: 'Spieltag' }).click()
await pause(1500)
await page.locator('.tp-tabs--unten a', { hasText: 'Ligen' }).click()
await pause(1400)
await page.getByPlaceholder('z. B. Stammtisch-Liga').fill('Theke Dollern')
await pause(500)
await page.getByRole('button', { name: 'Gründen' }).click()
await pause(2200)
notiz(`Liga gegründet: ${(await page.locator('.tp-einladen__code').first().textContent().catch(() => '–'))?.trim()}`)
await page.keyboard.press('Escape')
await pause(1200)
await page.locator('.tp-tabs--unten a', { hasText: 'Spieltag' }).click()
await pause(1800)
notiz(`Nächster Schritt am Ende: ${(await page.locator('.tp-schritt').textContent().catch(() => '–'))?.trim()}`)
notiz(`Dauer ${(Date.now() - t0) / 1000} s · Seitenfehler ${fehler.length} ${fehler.slice(0, 2).join(' | ')}`)

const video = page.video()
await ctx.close()
await browser.close()
if (video) {
  const p = await video.path()
  fs.renameSync(p, `${OUT}/nutzer-session-handy.webm`)
}
fs.writeFileSync(`${OUT}/_notizen.txt`, notizen.join('\n'))
