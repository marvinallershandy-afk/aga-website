// v24-P: Regressionstest „Tipp abgeben → Tipp-Pack öffnen“ (Bug von Marvin:
// Knopf „Ins Album“ in der Belohnung → Album zeigt nichts, Tipp danach weg).
// Beide Wege, Chromium + WebKit (Handy 390×844 isMobile/hasTouch) + Desktop:
//   A. Vorführung: /tippen?vorfuehrung=1 → Tipp → „Tipp-Pack öffnen“ →
//      /album?vorfuehrung=1&oeffnen=<id> öffnet GENAU dieses Tipp-Pack (2 Karten),
//      einkleben, zurück zur Tipp-Liga → Tipp ist noch da.
//   B. Echtbetrieb mit GEMOCKTER Supabase (keine echte DB): Abgabe ist vom Server
//      bestätigt, BEVOR navigiert wird; das gutgeschriebene Pack öffnet im Album
//      sofort (album_pack_oeffnen für genau diese ID); zurück → „Gespeichert“.
//   C. „Weiter“ bleibt wie bisher (Tipp gespeichert, keine Navigation).
//   VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 5247 --strictPort
//   BASE=http://localhost:5247 node scripts/tippen-pack-ablauf-test.mjs   (ENG=webkit · SHOTS=shots-v24-packs/ablauf · VIDEO=1)
import { chromium, webkit } from 'playwright'
import fs from 'node:fs'
import { lageFixture } from './tippen-fixtures.mjs'

const BASE = process.env.BASE || 'http://localhost:5247'
const ENG = process.env.ENG === 'webkit' ? 'webkit' : 'chromium'
const ENGINE = ENG === 'webkit' ? webkit : chromium
const SHOTS = process.env.SHOTS
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true })
const M = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
const D = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
const USER = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'lena@fan.example', app_metadata: { provider: 'email' }, user_metadata: { app: 'sva-album' }, created_at: new Date().toISOString() }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 3600 * 24
const JWT = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, email: USER.email, role: 'authenticated', aud: 'authenticated', exp })}.sig`
const SESSION_OBJ = { access_token: JWT, refresh_token: 'r-test', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: USER }
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) })

let fehler = 0
const log = (ok, msg) => {
  if (!ok) fehler++
  console.log(`${ok ? 'OK    ' : 'FEHLER'} [${ENG}] ${msg}`)
}
const browser = await ENGINE.launch(ENG === 'chromium' ? { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } : {})
const bild = (page, n) => (SHOTS ? page.screenshot({ path: `${SHOTS}/${n}-${ENG}.png` }) : null)

async function kontext(view, name) {
  const ctx = await browser.newContext({ ...view, ...(process.env.VIDEO && SHOTS ? { recordVideo: { dir: `${SHOTS}/video-${name}-${ENG}`, size: view.viewport } } : {}) })
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('sva-tipp-einfuehrung', '1')
      localStorage.setItem('sva-tipp-einfuehrung-vorfuehrung', '1')
      localStorage.setItem('sva-album-einfuehrung', '1')
      localStorage.setItem('sva-album-einfuehrung-v22', '1')
    } catch {
      /* */
    }
  })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  return { ctx, page, errs }
}

// Ergebnis wählen + abgeben (ein Tor für den SVA = bewusst gewählt)
async function tippen(page) {
  await page.waitForSelector('.tp-formular', { timeout: 10000 })
  await page.locator('.tp-stepper .tp-rund').first().click()
  await page.locator('.tp-abgabe__los').click()
  await page.waitForSelector('.tp-belohnung', { timeout: 10000 })
}
const albumKnopf = (page) => page.locator('.tp-belohnung').getByRole('button', { name: /Tipp-Pack öffnen|Ins Album/ }).or(page.locator('.tp-belohnung').getByRole('link', { name: /Tipp-Pack öffnen|Ins Album/ }))

// Pack im Album: aufreißen, alles zeigen, einkleben
async function packOeffnen(page) {
  await page.waitForSelector('.po', { timeout: 12000 })
  await page.waitForSelector('.po__auf:not([disabled])', { timeout: 8000 })
  const kicker = (await page.locator('.po__kicker').first().textContent())?.trim()
  const anzahl = (await page.locator('.po-tuete__koerper small').first().textContent())?.trim()
  await bild(page, 'b-tuete')
  await page.locator('.po__auf').click()
  await page.waitForSelector('.po__buehne--karte', { timeout: 6000 })
  await page.waitForTimeout(900)
  await bild(page, 'c-karte')
  await page.locator('.po__skip').click()
  await page.waitForSelector('.po__buehne--ende', { timeout: 6000 })
  const karten = await page.locator('.po__liste li').count()
  await bild(page, 'd-ende')
  await page.locator('.po__aktionen .al-btn').first().click()
  await page.waitForSelector('.po', { state: 'detached', timeout: 6000 })
  return { kicker, anzahl, karten }
}

for (const [v, view] of [['m', M], ['d', D]]) {
  // ── A. Vorführung ─────────────────────────────────────────
  {
    const { ctx, page, errs } = await kontext(view, `vf-${v}`)
    await page.goto(`${BASE}/tippen?vorfuehrung=1`, { waitUntil: 'networkidle' })
    await tippen(page)
    const text = (await page.locator('.tp-belohnung').textContent()) ?? ''
    log(/Tipp-Pack/.test(text) && /2 Karten/.test(text), `A1-${v} Vorführung: Belohnung „Tipp-Pack · 2 Karten“`)
    if (SHOTS) await page.waitForTimeout(1400) // Einblenden + Tütchen-Dreh abwarten
    await bild(page, `a-belohnung-vf-${v}`)
    await albumKnopf(page).click()
    await page.waitForURL(/\/album\?/, { timeout: 8000 })
    log(/vorfuehrung=1/.test(page.url()), `A2-${v} Wechsel ins Album der Vorführung (${new URL(page.url()).search})`)
    const p = await packOeffnen(page).catch((e) => ({ fehler: e.message }))
    log(!p.fehler && /Tipp-Pack/.test(p.kicker ?? '') && p.karten === 2, `A3-${v} Album öffnet direkt das Tipp-Pack (${p.kicker ?? p.fehler} · ${p.anzahl} · ${p.karten} Karten)`)
    await page.waitForTimeout(3500) // einkleben
    await bild(page, `e-eingeklebt-vf-${v}`)
    await page.locator('.al-wechsel__b', { hasText: 'Tipp-Liga' }).click()
    await page.waitForURL(/\/tippen/)
    await page.waitForSelector('.tp-formular', { timeout: 10000 })
    const gespeichert = await page.locator('.tp-abgabe__ok').count()
    log(gespeichert === 1, `A4-${v} zurück in der Tipp-Liga: Tipp ist noch gespeichert`)
    await bild(page, `f-zurueck-vf-${v}`)
    // nochmal ins Album: das Tipp-Pack ist geöffnet und kommt nicht doppelt
    await page.goto(`${BASE}/album?vorfuehrung=1`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    const offen = await page.evaluate(() => JSON.parse(sessionStorage.getItem('sva-vf-packs') ?? '[]'))
    log(offen.filter((x) => x.art === 'tipp' && !x.geoeffnet).length === 0, `A5-${v} Tipp-Pack nach dem Öffnen nicht noch einmal da`)
    log(errs.length === 0, `A6-${v} keine Seitenfehler ${errs.slice(0, 2).join(' | ')}`)
    await ctx.close()
  }

  // ── B. Echtbetrieb (gemockte Supabase) ───────────────────
  {
    const { ctx, page, errs } = await kontext(view, `echt-${v}`)
    const spur = { abgabe: 0, abgabeFertig: 0, albumNav: 0, albumUrl: '', geoeffnet: [], elf: 0 }
    let getippt = false
    const KARTEN = [
      { id: 'k-pils', typ: 'spieler', titel: 'Malte Pils', seltenheit: 'bronze', sortierung: 1, kapitel: 'TW', spieler: { slug: 'malte-pils', name: 'Malte Pils', nummer: 1, position: 'TW', cutoutUrl: '/players/cutout/malte-pils.webp' } },
      { id: 'k-helck', typ: 'spieler', titel: 'Tobias Helck', seltenheit: 'gold', sortierung: 2, kapitel: 'MIT', spieler: { slug: 'tobias-helck', name: 'Tobias Helck', nummer: 24, position: 'MIT', kapitaen: true, cutoutUrl: '/players/cutout/tobias-helck.webp' } },
      { id: 'k-biedermann', typ: 'spieler', titel: 'Marc Kevin Biedermann', seltenheit: 'bronze', sortierung: 3, kapitel: 'ANG', spieler: { slug: 'marc-kevin-biedermann', name: 'Marc Kevin Biedermann', nummer: 37, position: 'ANG', cutoutUrl: '/players/cutout/marc-kevin-biedermann.webp' } },
    ]
    const KATALOG = {
      saison: '2026/27', aktiv: true,
      regeln: { chancen: { bronze: 70, silber: 22, gold: 7, spezial: 1 }, kartenProPack: 3, fensterVorMin: 60, fensterNachMin: 135, bonusHeimsieg: true, belohnungen: [], shinyChance: 250,
        packTypen: [{ typ: 'tipp', titel: 'Tipp-Pack', karten: 2, optik: 'klein', reveal: 1, limitiertChance: 8 }, { typ: 'spieltag', titel: 'Spieltags-Pack', karten: 4, minSeltenheit: 'silber', optik: 'gross', reveal: 2 }] },
      karten: KARTEN,
    }
    const PACK = { id: '22222222-2222-4222-8222-222222222222', typ: 'tipp', titel: 'Tipp-Pack', karten: 2 }
    const mein = () => ({
      email: USER.email, saison: '2026/27', profil: { vorname: 'Lena', initial: 'K', anzeigename: 'Lena K.', rangliste: true, erinnerung: false },
      checkins: 1, checkinsGesamt: 1, spiele: [], besitz: [{ karteId: 'k-pils', anzahl: 1 }], gutscheine: [], ziele: [], lose: 0, starterOffen: false,
      packs: getippt && !spur.geoeffnet.includes(PACK.id) ? [{ id: PACK.id, art: 'tipp', typ: 'tipp', anzahl: 2, titel: 'Tipp-Pack', at: new Date().toISOString() }] : [],
    })
    await ctx.route(/mock\.supabase\.co\//, async (route) => {
      const req = route.request()
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
      const u = new URL(req.url())
      if (u.pathname.includes('/rest/v1/rpc/')) {
        const n = u.pathname.split('/rpc/')[1]
        if (n === 'tipp_lage') {
          const l = lageFixture(getippt ? 'getippt' : 'neu')
          return json(route, { ...l, tippPack: { titel: 'Tipp-Pack', karten: 2 } })
        }
        if (n === 'tipp_abgeben') {
          spur.abgabe++
          await new Promise((r) => setTimeout(r, 700)) // langsames Netz: Knopf darf vorher nicht navigieren
          getippt = true
          spur.abgabeFertig = Date.now()
          return json(route, { ok: true, neu: true, karte: true, abzeichen: [], anzahlTipps: 12, packId: PACK.id, pack: PACK })
        }
        if (n === 'tipp_elf_speichern') {
          spur.elf++
          return json(route, { ok: true })
        }
        if (n === 'album_katalog') return json(route, KATALOG)
        if (n === 'album_mein') return json(route, mein())
        if (n === 'album_rangliste') return json(route, [])
        if (n === 'album_pack_oeffnen') {
          const id = JSON.parse(req.postData() ?? '{}').p_pack
          spur.geoeffnet.push(id)
          return json(route, { id, art: 'tipp', typ: 'tipp', titel: 'Tipp-Pack', karten: [{ karteId: 'k-helck', seltenheit: 'gold', neu: true, anzahl: 1 }, { karteId: 'k-pils', seltenheit: 'bronze', neu: false, anzahl: 2 }], gutscheine: [], kapitel: [], ziele: [] })
        }
        return json(route, null)
      }
      if (u.pathname.endsWith('/auth/v1/user')) return json(route, USER)
      if (u.pathname.endsWith('/auth/v1/token')) return json(route, SESSION_OBJ)
      return json(route, req.method() === 'GET' ? [] : null)
    })
    await ctx.route('**/api/album-sitzung', (route) => json(route, { rt: null }))
    await ctx.addInitScript((s) => {
      try {
        if (!sessionStorage.getItem('x-gesetzt')) localStorage.setItem('sva-album-auth', s)
        sessionStorage.setItem('x-gesetzt', '1')
      } catch {
        /* */
      }
    }, JSON.stringify(SESSION_OBJ))
    page.on('request', (r) => {
      if (r.isNavigationRequest() && /\/album/.test(r.url()) && !spur.albumNav) {
        spur.albumNav = Date.now()
        spur.albumUrl = r.url()
      }
    })
    await page.goto(`${BASE}/tippen`, { waitUntil: 'networkidle' })
    await tippen(page)
    const text = (await page.locator('.tp-belohnung').textContent()) ?? ''
    log(spur.abgabe === 1 && /Tipp-Pack/.test(text) && /2 Karten/.test(text), `B1-${v} Echt: Belohnung erst nach Server-Antwort, „Tipp-Pack · 2 Karten“`)
    if (SHOTS) await page.waitForTimeout(1400) // Einblenden + Tütchen-Dreh abwarten
    await bild(page, `a-belohnung-echt-${v}`)
    await albumKnopf(page).click()
    await page.waitForURL(/\/album/, { timeout: 8000 })
    log(spur.abgabeFertig > 0 && spur.albumNav >= spur.abgabeFertig, `B2-${v} Navigation erst NACH bestätigter Abgabe (${spur.albumNav - spur.abgabeFertig} ms danach)`)
    log(spur.albumUrl.includes(`oeffnen=${PACK.id}`), `B3-${v} Deep-Link ?oeffnen=<packId> (${new URL(spur.albumUrl || BASE).search})`)
    const p = await packOeffnen(page).catch((e) => ({ fehler: e.message }))
    log(!p.fehler && spur.geoeffnet[0] === PACK.id && p.karten === 2 && /Tipp-Pack/.test(p.kicker ?? ''), `B4-${v} Album öffnet sofort genau das Tipp-Pack (${p.kicker ?? p.fehler}, ${p.karten} Karten)`)
    await page.waitForTimeout(3000)
    log(!page.url().includes('oeffnen='), `B5-${v} Parameter danach aus der Adresse entfernt`)
    await page.goto(`${BASE}/tippen`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.tp-formular', { timeout: 10000 })
    log((await page.locator('.tp-abgabe__ok').count()) === 1, `B6-${v} zurück: Tipp gespeichert`)
    log(errs.length === 0, `B7-${v} keine Seitenfehler ${errs.slice(0, 2).join(' | ')}`)
    await ctx.close()
  }

  // ── C. „Weiter“ wie bisher ───────────────────────────────
  {
    const { ctx, page } = await kontext(view, `weiter-${v}`)
    await page.goto(`${BASE}/tippen?vorfuehrung=1`, { waitUntil: 'networkidle' })
    await tippen(page)
    await page.locator('.tp-belohnung').getByRole('button', { name: 'Weiter' }).click()
    await page.waitForTimeout(600)
    log((await page.locator('.tp-belohnung').count()) === 0 && (await page.locator('.tp-abgabe__ok').count()) === 1 && page.url().includes('/tippen'), `C1-${v} „Weiter“: bleibt in der Tipp-Liga, Tipp gespeichert`)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('.tp-formular', { timeout: 10000 })
    log((await page.locator('.tp-abgabe__ok').count()) === 1, `C2-${v} Vorführung: Tipp übersteht auch Neuladen (sessionStorage)`)
    await ctx.close()
  }
}

await browser.close()
console.log(fehler ? `\n${fehler} FEHLER` : '\nalles grün')
process.exit(fehler ? 1 : 0)
