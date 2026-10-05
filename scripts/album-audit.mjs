// v17-A: /album headless durchklicken + screenshotten (390 px mobil, dazu Desktop).
// KEINE echte DB, KEIN echtes Login: alle RPCs (album_*) und /auth/v1 werden
// gemockt (zustandsbehaftet: Check-in → Pack → Besitz → Gutschein einlösen —
// v17-D ohne PIN: Bestätigung, doppeltes Einlösen abgelehnt).
// Eine Fan-Sitzung wird direkt in localStorage ('sva-album-auth') gelegt.
//   npx vite --port 5192 --strictPort        (vorher starten)
//   BASE=http://localhost:5192 OUT=./shots-album node scripts/album-audit.mjs
import { chromium, devices } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5192'
const OUT = process.env.OUT || './shots-album'
fs.mkdirSync(OUT, { recursive: true })
const SB = /^https:\/\/[^/]+\.supabase\.co/

// ── Katalog (echter Kader, Freisteller aus public/) ─────────
const KADER = [
  ['p-pils', 'Malte Pils', 1, 'TW', 'malte-pils'], ['p-ebeling-t', 'Tino Ebeling', 38, 'TW', 'tino-ebeling'],
  ['p-huettry', 'Justin Hüttry', 3, 'ABW', 'justin-huettry'], ['p-brettschneider', 'Lennard Brettschneider', 4, 'ABW', 'lennard-brettschneider'],
  ['p-sladek', 'Justin Sladek', 11, 'ABW', 'justin-sladek'], ['p-neuber-m', 'Marcel Neuber', 14, 'ABW', 'marcel-neuber'],
  ['p-nauerz', 'Noel Nauerz', 15, 'ABW', 'noel-nauerz'], ['p-neuber-d', 'Dawid Neuber', 21, 'ABW', 'dawid-neuber'],
  ['p-marchel', 'Oliver Marchel', 29, 'ABW', 'oliver-marchel'], ['p-elsen', 'Joshua Elsen', 32, 'ABW', 'joshua-elsen'],
  ['p-warkehr-i', 'Isaak Warkehr', null, 'ABW', 'isaak-warkehr'], ['p-litwitz', 'Lukas-Alexander Litwitz', 5, 'MIT', null],
  ['p-paruzel', 'Julio Paruzel', 7, 'MIT', 'julio-paruzel'], ['p-becker', 'Niclas Becker', 8, 'MIT', 'niclas-becker'],
  ['p-kalwa', 'Justin Kalwa', 13, 'MIT', 'justin-kalwa'], ['p-jochim', 'Sam Luca Jochim', 17, 'MIT', null],
  ['p-pejas-n', 'Noah Pejas', 20, 'MIT', 'noah-pejas'], ['p-pejas-e', 'Elias Pejas', 22, 'MIT', 'elias-pejas'],
  ['p-helck', 'Tobias Helck', 24, 'MIT', 'tobias-helck'], ['p-bruenjes', 'Janek Brünjes', 33, 'MIT', 'janek-bruenjes'],
  ['p-matthes', 'Paul Matthes', 44, 'MIT', 'paul-matthes'], ['p-warkehr-a', 'Aaron Warkehr', 6, 'ANG', 'aaron-warkehr'],
  ['p-viedts', 'Lennox Viedts', 10, 'ANG', null], ['p-biedermann', 'Marc Kevin Biedermann', 37, 'ANG', 'marc-kevin-biedermann'],
]
const LOGO = (name, farbe) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><rect x="20" y="40" width="120" height="120" rx="24" fill="${farbe}"/><text x="80" y="122" font-family="Arial" font-size="64" font-weight="900" fill="#fff" text-anchor="middle">${name[0]}</text><text x="160" y="118" font-family="Arial" font-size="44" font-weight="900" fill="${farbe}">${name}</text></svg>`)}`
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
let n = 0
const KARTEN = []
for (const [slug, name, nummer, position, datei] of KADER) {
  const spieler = { slug, name, ...(nummer != null ? { nummer } : {}), position, ...(datei ? { fotoUrl: `/players/${datei}.webp`, cutoutUrl: `/players/cutout/${datei}.webp` } : {}), ...(slug === 'p-helck' ? { kapitaen: true } : {}) }
  KARTEN.push({ id: id(++n), typ: 'spieler', titel: name, untertitel: { TW: 'Torwart', ABW: 'Abwehr', MIT: 'Mittelfeld', ANG: 'Angriff' }[position], seltenheit: 'bronze', spieler })
  if (slug === 'p-helck') KARTEN.push({ id: id(++n), typ: 'spieler', titel: name, untertitel: 'Kapitän', seltenheit: 'gold', spieler })
  if (slug === 'p-biedermann') KARTEN.push({ id: id(++n), typ: 'spieler', titel: name, untertitel: 'Torjäger', seltenheit: 'gold', spieler, walkoutUrl: '/players/walkout/gibt-es-nicht.webm' })
  if (slug === 'p-paruzel') KARTEN.push({ id: id(++n), typ: 'spieler', titel: name, untertitel: 'Silber', seltenheit: 'silber', spieler })
}
KARTEN.push(
  { id: id(++n), typ: 'trainer', titel: 'Carsten Junge', untertitel: 'Trainer', seltenheit: 'bronze', spieler: { slug: 's-junge', name: 'Carsten Junge', position: 'MIT', rolle: 'trainer', fotoUrl: '/players/carsten-junge.webp' } },
  { id: id(++n), typ: 'trainer', titel: 'Adolf Ebeling', untertitel: 'Co-Trainer', seltenheit: 'bronze', spieler: { slug: 's-ebeling-a', name: 'Adolf Ebeling', position: 'MIT', rolle: 'co-trainer', fotoUrl: '/players/adolf-ebeling.webp' } },
  { id: id(++n), typ: 'trainer', titel: 'Niko Hause', untertitel: 'Teammanager', seltenheit: 'bronze', spieler: { slug: 's-hause', name: 'Niko Hause', position: 'MIT', rolle: 'teammanager', fotoUrl: '/players/niko-hause.webp' } },
  { id: id(++n), typ: 'moment', titel: 'Das Tor zur Meisterschaft', untertitel: '90+7. Minute · Meister 2026', seltenheit: 'spezial', bildUrl: '/fans/meister.webp' },
  { id: id(++n), typ: 'moment', titel: 'Torjubel am Waldsportplatz', untertitel: 'Saison 25/26', seltenheit: 'gold', bildUrl: '/fans/torjubel.webp' },
  { id: id(++n), typ: 'moment', titel: 'Urknall-Pokal 2026', untertitel: 'Sieg beim Aspe-Haie-Pokal', seltenheit: 'silber', bildUrl: '/fans/torjubel-sign.webp' },
  { id: id(++n), typ: 'partner', titel: 'Mr. Döner', seltenheit: 'silber', partner: { name: 'Mr. Döner', logoUrl: LOGO('Döner', '#c2410c') } },
  { id: id(++n), typ: 'partner', titel: 'Altstadtcafé', seltenheit: 'bronze', partner: { name: 'Altstadtcafé', logoUrl: LOGO('Café', '#0b3d91') } },
  { id: id(++n), typ: 'fan', titel: 'Die Kurve', untertitel: 'Waldsportplatz', seltenheit: 'bronze', bildUrl: '/fans/dritte-halbzeit-sign.webp' },
  { id: id(++n), typ: 'fan', titel: 'Dodos Raum', seltenheit: 'gold' },
)
const PARTNER = { name: 'Mr. Döner', logoUrl: LOGO('Döner', '#c2410c') }
const KATALOG = {
  saison: '2026/27', aktiv: true,
  regeln: {
    chancen: { bronze: 70, silber: 22, gold: 7, spezial: 1 }, kartenProPack: 3, fensterVorMin: 60, fensterNachMin: 135, bonusHeimsieg: true,
    belohnungen: [
      { stufe: 'schwelle_1', checkins: 5, titel: 'Freibier oder Bratwurst', partner: PARTNER },
      { stufe: 'schwelle_2', checkins: 10, titel: 'SVA-Fanartikel' },
      { stufe: 'komplett', titel: 'Los für die Saison-Verlosung' },
    ],
  },
  karten: KARTEN,
}
const k = (titel, selt) => KARTEN.find((x) => x.titel === titel && (!selt || x.seltenheit === selt)).id
const TOKEN_OK = 'a1b2c3d4e5f6a7b8c9d0e1f2'
const TOKEN_FRUEH = 'f00000000000000000000001'
const TOKEN_ALT = 'a00000000000000000000002'

// ── Zustand ─────────────────────────────────────────────────
function neuerZustand(art) {
  const s = {
    profil: { vorname: 'Marvin', initial: 'A', anzeigename: 'Marvin A.', rangliste: true, erinnerung: false },
    checkins: 0, besitz: new Map(), packs: [], gutscheine: [], pinFehler: 0, naechstesPack: null,
  }
  if (art === 'ohneProfil') s.profil = null
  if (art === 'halb') {
    s.checkins = 4
    KARTEN.filter((x, i) => i % 2 === 0 && x.seltenheit !== 'spezial').forEach((x, i) => s.besitz.set(x.id, i % 5 === 0 ? 2 : 1))
    s.packs = [{ id: 'pk-warte', art: 'heimsieg', anzahl: 3, gegner: 'TuS Fischbek', at: new Date().toISOString() }]
  }
  if (art === 'voll') {
    s.checkins = 11
    KARTEN.forEach((x, i) => s.besitz.set(x.id, 1 + (i % 4 === 0 ? 1 : 0)))
    s.gutscheine = [
      { id: 'g1', stufe: 'schwelle_1', titel: 'Freibier oder Bratwurst', code: 'SVA-7K3PQ', status: 'offen', saison: '2026/27', at: new Date().toISOString(), partner: PARTNER },
      { id: 'g2', stufe: 'schwelle_2', titel: 'SVA-Fanartikel', code: 'SVA-M4XTR', status: 'eingeloest', saison: '2026/27', eingeloestAt: new Date(Date.now() - 864e5 * 6).toISOString(), at: new Date().toISOString() },
      { id: 'g3', stufe: 'komplett', titel: 'Los für die Saison-Verlosung', code: 'SVA-Z9HWB', status: 'offen', saison: '2026/27', at: new Date().toISOString() },
    ]
  }
  return s
}
let Z = neuerZustand()
const mein = () => ({
  email: 'marvin@fan.example', saison: '2026/27', profil: Z.profil, checkins: Z.checkins, checkinsGesamt: Z.checkins,
  spiele: [], besitz: [...Z.besitz].map(([karteId, anzahl]) => ({ karteId, anzahl })), packs: Z.packs, gutscheine: Z.gutscheine,
})
const errors = []
const checks = []
const check = (ok, msg) => checks.push(`${ok ? 'OK ' : 'FEHLER'}  ${msg}`)
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) })
const pgErr = (route, message) => json(route, { code: 'P0001', message, details: null, hint: null }, 400)

async function routes(ctx) {
  await ctx.route(SB, (r) => r.fallback())
  await ctx.route('**/rest/v1/rpc/**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } })
    const fn = new URL(req.url()).pathname.split('/rpc/')[1]
    const body = req.postDataJSON() ?? {}
    if (fn === 'album_katalog') return json(route, KATALOG)
    if (fn === 'album_rangliste') return json(route, [
      { platz: 1, name: 'Lena B.', checkins: 9, karten: 31 }, { platz: 2, name: 'Marvin A.', checkins: Z.checkins, karten: Z.besitz.size, ich: true },
      { platz: 3, name: 'Ole K.', checkins: 3, karten: 14 }, { platz: 3, name: 'Jana P.', checkins: 3, karten: 11 }, { platz: 5, name: 'Tim S.', checkins: 2, karten: 8 },
    ].sort((a, b) => b.checkins - a.checkins))
    if (fn === 'album_mein') return json(route, mein())
    if (fn === 'album_profil_speichern') {
      Z.profil = { vorname: body.p_vorname, initial: body.p_initial, anzeigename: `${body.p_vorname} ${body.p_initial}.`, rangliste: body.p_rangliste, erinnerung: body.p_erinnerung }
      return json(route, { ok: true })
    }
    if (fn === 'album_checkin') {
      if (body.p_token === TOKEN_FRUEH) return pgErr(route, `album_code_zu_frueh|${new Date(Date.now() + 2 * 36e5).toISOString().slice(0, 19)}Z`)
      if (body.p_token === TOKEN_ALT) return pgErr(route, 'album_code_abgelaufen')
      if (body.p_token !== TOKEN_OK) return pgErr(route, 'album_code_unbekannt')
      Z.checkins += 1
      const pid = 'pk-' + Z.checkins
      Z.packs.push({ id: pid, art: 'checkin', anzahl: 3, gegner: 'TuS Fischbek', at: new Date().toISOString() })
      return json(route, { ok: true, packId: pid, spiel: { gegner: 'TuS Fischbek', anstoss: new Date().toISOString() }, partner: PARTNER, checkins: Z.checkins, gutscheine: [] })
    }
    if (fn === 'album_pack_oeffnen') {
      // wie der Server: zweites Öffnen liefert denselben Inhalt (StrictMode ruft doppelt)
      Z.geoeffnet ??= new Map()
      if (Z.geoeffnet.has(body.p_pack)) return json(route, Z.geoeffnet.get(body.p_pack))
      const p = Z.packs.find((x) => x.id === body.p_pack)
      const inhalt = Z.naechstesPack ?? [k('Justin Sladek'), k('Julio Paruzel', 'silber'), k('Tobias Helck', 'gold')]
      Z.packs = Z.packs.filter((x) => x.id !== body.p_pack)
      const karten = inhalt.map((kid) => {
        const vorher = Z.besitz.get(kid) ?? 0
        Z.besitz.set(kid, vorher + 1)
        return { karteId: kid, seltenheit: KARTEN.find((x) => x.id === kid).seltenheit, neu: vorher === 0, anzahl: vorher + 1 }
      })
      const antwort = { id: body.p_pack, art: p?.art ?? 'checkin', gegner: 'TuS Fischbek', karten, gutscheine: Z.gutscheinBeimOeffnen ?? [] }
      Z.geoeffnet.set(body.p_pack, antwort)
      return json(route, antwort)
    }
    if (fn === 'album_gutschein_einloesen') {
      const g = Z.gutscheine.find((x) => x.id === body.p_gutschein)
      if ('p_pin' in body) return pgErr(route, 'function album_gutschein_einloesen(uuid, text) does not exist')
      if (g.status === 'eingeloest') return json(route, { ok: false, grund: 'schon_eingeloest', eingeloestAt: g.eingeloestAt })
      g.status = 'eingeloest'; g.eingeloestAt = new Date().toISOString()
      return json(route, { ok: true, eingeloestAt: g.eingeloestAt })
    }
    if (fn === 'album_konto_loeschen') return json(route, { ok: true, loginGeloescht: true })
    return pgErr(route, 'unbekannt ' + fn)
  })
  await ctx.route('**/auth/v1/**', async (route) => {
    const u = new URL(route.request().url())
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } })
    if (u.pathname.endsWith('/otp')) return json(route, {})
    if (u.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } })
    if (u.pathname.endsWith('/user')) return json(route, USER)
    return json(route, { error: 'audit' }, 400)
  })
}
const USER = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'marvin@fan.example', app_metadata: { provider: 'email' }, user_metadata: { app: 'sva-album' }, created_at: new Date().toISOString() }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 3600 * 24
const JWT = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, email: USER.email, role: 'authenticated', aud: 'authenticated', exp })}.sig`
const SESSION = JSON.stringify({ access_token: JWT, refresh_token: 'r-audit', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: USER })

const browser = await chromium.launch()
async function seite(label, { login = true, zustand, reduced = false, desktop = false } = {}) {
  Z = neuerZustand(zustand)
  const ctx = await browser.newContext(desktop ? { viewport: { width: 1280, height: 860 } } : { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } , reducedMotion: reduced ? 'reduce' : 'no-preference' })
  await routes(ctx)
  if (login) await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('audit-init')) { localStorage.setItem('sva-album-auth', s); sessionStorage.setItem('audit-init', '1') } } catch { /* */ } }, SESSION)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 400/.test(m.text()) && !/\/walkout\//.test(m.location()?.url ?? '')) errors.push(`[${label}] ${m.text().slice(0, 220)}`) })
  return { ctx, page }
}
const shot = async (page, name, full = false) => { await page.waitForTimeout(350); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }) }
const go = async (page, path = '/album') => { await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(600) }

// 1) Login (Gast) + QR-Einstieg ohne Login + Link gesendet
{
  const { ctx, page } = await seite('login', { login: false })
  await go(page)
  await shot(page, '01-login', true)
  check(await page.getByRole('button', { name: 'Login-Link schicken' }).isVisible(), 'Login: Formular sichtbar')
  await page.getByRole('textbox', { name: 'E-Mail-Adresse' }).fill('marvin@fan.example')
  await page.getByRole('button', { name: 'Login-Link schicken' }).click()
  await page.waitForTimeout(300)
  check(await page.getByText(/Bitte bestätige die Einwilligung/).isVisible(), 'Login: ohne Einwilligung kein Versand')
  await page.locator('.al-check input').check()
  await page.getByRole('button', { name: 'Login-Link schicken' }).click()
  await page.waitForTimeout(500)
  check(await page.getByText('Schau in dein Postfach.').isVisible(), 'Login: „Schau in dein Postfach“ + Code-Feld')
  await shot(page, '03-login-gesendet')
  await go(page, `/album?c=${TOKEN_OK}`)
  check(!page.url().includes('c='), 'QR-Token verschwindet aus der Adresszeile')
  check(await page.evaluate(() => localStorage.getItem('sva-album-c')) === TOKEN_OK, 'QR-Token gemerkt (überlebt den Login)')
  await shot(page, '02-login-checkin-wartet')
  await ctx.close()
}

// 2) Profil (erster Login)
{
  const { ctx, page } = await seite('profil', { zustand: 'ohneProfil' })
  await page.addInitScript(() => localStorage.setItem('sva-album-einwilligung', new Date().toISOString()))
  await go(page, `/album?c=${TOKEN_OK}`)
  await shot(page, '04-profil')
  await page.getByRole('textbox', { name: 'Vorname' }).fill('Marvin')
  await page.getByRole('textbox', { name: 'Nachname' }).fill('allers')
  await page.getByRole('button', { name: 'Weiter zum Album' }).click()
  await page.waitForTimeout(900)
  check(await page.locator('.al-pack').isVisible(), 'Nach dem Profil startet der wartende Check-in direkt mit dem Pack')
  await shot(page, '06-checkin-pack')
  await ctx.close()
}

// 3) Album leer → Check-in → Pack-Opening Bronze/Silber/Gold/Spezial
{
  const { ctx, page } = await seite('pack')
  await go(page)
  await shot(page, '05a-cover-start')
  await page.locator('.al-cover').click()
  await page.waitForTimeout(1000)
  check(await page.locator('.hf-seiten').isVisible(), 'Cover antippen → Heft schlägt auf')
  await shot(page, '05-album-leer-inhalt')
  check((await page.locator('.hf-leer').count()) === KATALOG.karten.length - 3, 'Leeres Heft: alle Plätze als gestrichelter Umriss (Versionen zusammengefasst)')
  await page.locator('.hf-reiter__b').filter({ hasText: /^Tor/ }).click()
  await page.waitForTimeout(700)
  await shot(page, '05b-album-leer-torhueter')
  Z.naechstesPack = [k('Justin Sladek'), k('Julio Paruzel', 'silber'), k('Tobias Helck', 'gold'), k('Das Tor zur Meisterschaft')]
  await go(page, `/album?c=${TOKEN_OK}`)
  await page.waitForSelector('.al-tuete:not([disabled])')
  await shot(page, '06b-checkin-tuetchen')
  await page.locator('.al-tuete').click({ force: true })
  await page.waitForTimeout(900)
  await shot(page, '07a-pack-rueckseite')
  for (const [name, wait] of [['bronze', 900], ['silber', 900], ['gold', 2000], ['spezial', 2000]]) {
    if (name === 'gold' || name === 'spezial') {
      await page.waitForTimeout(800)
      await shot(page, `07-pack-${name}-spannung`)
      await page.waitForTimeout(wait - 600)
    } else {
      await page.waitForTimeout(wait)
    }
    await shot(page, `08-pack-${name}`)
    check(await page.locator(`.al-flip--${name}.is-vorne`).count() === 1, `Pack: ${name} aufgedeckt`)
    await page.locator('.al-pack .al-btn--gross').click()
  }
  await page.waitForTimeout(500)
  await shot(page, '09-pack-ende')
  check(await page.getByText(/4 neue Sticker/).isVisible(), 'Tütchen-Ende: „4 neue Sticker“')
  await page.getByRole('button', { name: 'Ins Heft einkleben' }).click()
  const flog = await page.waitForSelector('.hf-flug', { timeout: 4000 }).then(() => true, () => false)
  check(flog, 'Einkleben: Sticker fliegt an seinen Platz')
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${OUT}/10a-einkleben-flug.png` })
  await page.waitForFunction(() => document.querySelectorAll('.hf-platz.is-frisch').length === 4, null, { timeout: 15000 }).catch(() => {})
  check((await page.locator('.hf-platz.is-frisch').count()) === 4 && (await page.locator('.hf-flug').count()) === 0, 'Alle 4 neuen Sticker eingeklebt (frisch markiert)')
  await shot(page, '10-eingeklebt')
  await page.locator('.hf-reiter__b').filter({ hasText: /^Inhalt/ }).click()
  await page.waitForTimeout(700)
  await shot(page, '10b-inhalt-nach-pack', true)
  // Heimsieg-Bonus-Tütchen (Doppelter)
  Z.naechstesPack = [k('Justin Sladek')]
  Z.packs.push({ id: 'pk-x', art: 'heimsieg', anzahl: 1, gegner: 'TuS Fischbek', at: new Date().toISOString() })
  await go(page)
  await page.locator('.hf-tuetchen').click()
  await page.waitForSelector('.al-tuete:not([disabled])')
  await shot(page, '11-heimsieg-tuetchen')
  await ctx.close()
}

// 4) reduced motion
{
  const { ctx, page } = await seite('ruhig', { reduced: true })
  Z.naechstesPack = [k('Das Tor zur Meisterschaft')]
  await go(page, `/album?c=${TOKEN_OK}`)
  await page.waitForSelector('.al-tuete:not([disabled])')
  await page.locator('.al-tuete').click({ force: true })
  await page.waitForTimeout(500)
  check(await page.locator('.al-flip.is-vorne').count() === 1 && (await page.locator('.al-konfetti').count()) === 0, 'reduced-motion: sofort aufgedeckt, kein Konfetti')
  await shot(page, '12-pack-reduced-motion')
  await ctx.close()
}

// 5) Fehlerzustände
{
  const { ctx, page } = await seite('fehler')
  await go(page, `/album?c=${TOKEN_FRUEH}`)
  check(await page.getByText(/gilt nur rund ums Spiel — einchecken kannst du heute ab/).isVisible(), 'Fehler: zu früh mit Uhrzeit')
  await shot(page, '13-fehler-zu-frueh')
  await go(page, `/album?c=${TOKEN_ALT}`)
  check(await page.getByText(/dieses Spiel ist schon vorbei/).isVisible(), 'Fehler: abgelaufen')
  await shot(page, '14-fehler-abgelaufen')
  await go(page, '/album?c=b00000000000000000000003')
  check(await page.getByText(/kennen wir nicht/).isVisible(), 'Fehler: unbekannter Code')
  await ctx.close()
}

// 6) Album halb / voll, Detail, Gutschein, Konto
{
  const { ctx, page } = await seite('halb', { zustand: 'halb' })
  await go(page)
  await shot(page, '15a-cover-mit-stand')
  await page.locator('.al-cover').click()
  await page.waitForTimeout(1000)
  await shot(page, '15-album-halb-inhalt', true)
  check(await page.getByText('1 Tütchen wartet').isVisible(), 'Halb: „1 Tütchen wartet“ (Heimsieg)')
  for (const [reiter, datei] of [[/^Momente/, '15b-halb-momente'], [/^Abwehr/, '15c-halb-abwehr'], [/^Mitte/, '15d-halb-mittelfeld'], [/^Stab/, '15e-halb-trainerstab'], [/^Partner/, '15f-halb-partner'], [/^Fans-Liste/, '15g-halb-rangliste']]) {
    await page.locator('.hf-reiter__b').filter({ hasText: reiter }).click()
    await page.waitForTimeout(700)
    await shot(page, datei, true)
  }
  await page.locator('.hf-reiter__b').filter({ hasText: /^Sturm/ }).click()
  await page.waitForTimeout(700)
  await shot(page, '16-halb-sturm', true)
  await page.locator('.hf-seite--ANG').getByRole('button', { name: /fehlt noch/ }).first().click()
  await page.waitForTimeout(600)
  await shot(page, '17-detail-leer')
  await page.keyboard.press('Escape')
  await page.locator('.hf-reiter__b').filter({ hasText: /^Mitte/ }).click()
  await page.waitForTimeout(700)
  await page.locator('.hf-seite--MIT').getByRole('button', { name: /Tobias Helck/ }).click()
  await page.waitForTimeout(700)
  await shot(page, '18-detail-sticker')
  await page.keyboard.press('Escape')
  await ctx.close()
}
{
  const { ctx, page } = await seite('voll', { zustand: 'voll' })
  await go(page)
  await page.locator('.al-cover').click()
  await page.waitForTimeout(1000)
  await shot(page, '19-album-voll-inhalt', true)
  check(await page.getByText('Mannschaft komplett!').isVisible(), 'Voll: „Mannschaft komplett!“')
  await page.locator('.hf-reiter__b').filter({ hasText: /^Mitte/ }).click()
  await page.waitForTimeout(700)
  await shot(page, '19b-voll-mittelfeld', true)
  await page.locator('.hf-reiter__b').filter({ hasText: /^Momente/ }).click()
  await page.waitForTimeout(700)
  await shot(page, '19c-voll-momente', true)
  await page.locator('.hf-reiter__b').filter({ hasText: /^Sturm/ }).click()
  await page.waitForTimeout(700)
  await page.locator('.hf-seite--ANG').getByRole('button', { name: /Marc Kevin Biedermann/ }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /Gold-Folie/ }).click()
  await page.waitForTimeout(900)
  check((await page.locator('.al-detail .st__bild img').count()) === 1 && (await page.locator('.al-detail video').count()) === 0, 'Walkout fehlt (404) → sauber zurück aufs Foto')
  await shot(page, '20-detail-gold-walkout-fallback')
  await page.keyboard.press('Escape')
  await page.locator('.hf-reiter__b').filter({ hasText: /^Inhalt/ }).click()
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: /Freibier oder Bratwurst/ }).click()
  await page.waitForTimeout(500)
  await shot(page, '21-gutschein')
  await page.getByRole('button', { name: 'Einlösen', exact: true }).click()
  await page.waitForTimeout(300)
  check(await page.getByText('Wirklich einlösen?').isVisible() && await page.getByText(/Danach ist der Gutschein verbraucht/).isVisible(), 'Gutschein: Bestätigungsfrage erscheint')
  await shot(page, '22-gutschein-frage')
  await page.getByRole('button', { name: 'Abbrechen' }).click()
  check(await page.getByRole('button', { name: 'Einlösen', exact: true }).isVisible(), 'Gutschein: Abbrechen → nichts eingelöst')
  await page.getByRole('button', { name: 'Einlösen', exact: true }).click()
  await page.getByRole('button', { name: 'Ja, einlösen' }).click()
  await page.waitForTimeout(500)
  check(await page.getByText(/^am .* Uhr$/).isVisible() && await page.getByText('Nicht mehr gültig.').isVisible(), 'Gutschein: Ja → eingelöst mit Datum/Uhrzeit, großer Haken')
  check(!(await page.getByRole('button', { name: 'Einlösen', exact: true }).count()), 'Gutschein: danach kein Einlösen-Knopf mehr')
  await shot(page, '23-gutschein-eingeloest')
  await page.getByRole('button', { name: 'Schließen' }).click()
  await page.getByRole('button', { name: 'Konto' }).click()
  await page.waitForTimeout(400)
  await shot(page, '24-konto')
  await page.getByRole('button', { name: 'Konto löschen' }).click()
  await shot(page, '25-konto-loeschen-frage')
  await page.getByRole('button', { name: 'Endgültig löschen' }).click()
  await page.waitForTimeout(700)
  check(await page.getByText('Konto gelöscht.').isVisible() && (await page.evaluate(() => localStorage.getItem('sva-album-auth'))) === null, 'Konto löschen → abgemeldet, Abschiedshinweis')
  await shot(page, '26-konto-geloescht')
  await ctx.close()
}
{
  const { ctx, page } = await seite('desktop', { zustand: 'halb', desktop: true })
  await go(page)
  await shot(page, '27a-desktop-cover', true)
  await page.locator('.al-cover').click()
  await page.waitForTimeout(1000)
  await shot(page, '27-desktop-doppelseite-inhalt')
  await page.locator('.hf-reiter__b').filter({ hasText: /^Tor/ }).click()
  await page.waitForTimeout(800)
  await shot(page, '27b-desktop-doppelseite-tor-abwehr')
  await ctx.close()
}

await browser.close()
console.log(checks.join('\n'))
console.log(errors.length ? `\nKonsole/Seite: ${errors.length} Fehler\n${errors.join('\n')}` : '\nKonsole: 0 Fehler')
process.exit(checks.some((c) => c.startsWith('FEHLER')) || errors.length ? 1 : 0)
