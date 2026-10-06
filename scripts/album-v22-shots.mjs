// v22-A: Album-Vorführung headless prüfen — Screenshots + Videos (Handy WebKit + Chromium).
// KEINE DB, KEIN Login: /album?vorfuehrung=1 ist eine reine Browser-Simulation.
//   npx vite --port 5197 --strictPort
//   BASE=http://localhost:5197 OUT=./shots-v22-album node scripts/album-v22-shots.mjs [teil,teil]
// Teile: start, packs, shiny, alle, geheim, labor, wappen, ball, desktop
import { chromium, webkit, devices } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5197'
const OUT = process.env.OUT || './shots-v22-album'
const NUR = (process.argv[2] || process.env.NUR || '').split(',').filter(Boolean)
const MOTOREN = (process.env.MOTOR || 'webkit,chromium').split(',')
fs.mkdirSync(OUT, { recursive: true })
const soll = (t) => !NUR.length || NUR.includes(t)
const fehler = []
const warte = (p, ms) => p.waitForTimeout(ms)

async function kontext(motor, { video = false, desktop = false, einf = false } = {}) {
  const b = await (motor === 'webkit' ? webkit : chromium).launch(motor === 'chromium' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {})
  const geraet = desktop ? { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 } : motor === 'webkit' ? { ...devices['iPhone 13'] } : { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }
  const ctx = await b.newContext({ ...geraet, ...(video ? { recordVideo: { dir: `${OUT}/video-tmp`, size: desktop ? { width: 1280, height: 860 } : { width: 390, height: 844 } } } : {}) })
  // Keine Anfrage an Supabase: alles, was nicht localhost ist, protokollieren
  ctx.on('request', (r) => {
    const u = r.url()
    if (!u.startsWith(BASE) && /supabase|\/rest\/v1|\/auth\/v1/.test(u)) fehler.push(`[${motor}] DB-Anfrage in der Vorführung: ${u}`)
  })
  // Einführung („So funktioniert’s“) nur im eigenen Teil zeigen
  if (!einf) await ctx.addInitScript(() => { try { localStorage.setItem('sva-album-einfuehrung', '1') } catch { /* */ } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => fehler.push(`[${motor}] pageerror ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') fehler.push(`[${motor}] console ${m.text().slice(0, 200)}`) })
  return { b, ctx, page }
}
async function heftAuf(page) {
  await page.goto(`${BASE}/album?vorfuehrung=1`, { waitUntil: 'networkidle' })
  await warte(page, 700)
  await page.locator('.al-cover').click()
  await warte(page, 1200)
}
async function reiter(page, text) {
  await page.locator('.hf-reiter__b').filter({ hasText: text }).first().click()
  await warte(page, 1300)
}
async function videoSpeichern(ctx, page, name) {
  const v = page.video()
  await ctx.close()
  if (v) fs.renameSync(await v.path(), `${OUT}/${name}.webm`)
}
// Ein Pack durchklicken (Aufreißen → alle Karten → Übersicht), Bilder zu Schlüsselmomenten
async function packDurch(page, pre) {
  await page.waitForSelector('.po-tuete:not(.is-laden)', { timeout: 8000 })
  await warte(page, 500)
  await page.screenshot({ path: `${OUT}/${pre}-1-tuete.png` })
  await page.locator('.po__auf').click()
  for (let n = 0; n < 12; n++) {
    await page.waitForSelector('.po__karte', { timeout: 8000 })
    const kl = (await page.locator('.po__karte').getAttribute('class')) ?? ''
    // Zeitlinie abwarten und Schlüsselbilder machen
    if (kl.includes('po__karte--shiny')) {
      await warte(page, 1500); await page.screenshot({ path: `${OUT}/${pre}-shiny-a-stille.png` })
      await warte(page, 1400); await page.screenshot({ path: `${OUT}/${pre}-shiny-b-kamera.png` })
      await warte(page, 900); await page.screenshot({ path: `${OUT}/${pre}-shiny-c-hinweis.png` })
      await warte(page, 2400); await page.screenshot({ path: `${OUT}/${pre}-shiny-d-auf.png` })
    } else if (/--(gold|spezial|geheim)/.test(kl)) {
      const art = kl.match(/--(geheim|gold|spezial)/)[1]
      await warte(page, 2000); await page.screenshot({ path: `${OUT}/${pre}-${n}-${art}-walkout.png` })
      await warte(page, 3000); await page.screenshot({ path: `${OUT}/${pre}-${n}-${art}-auf.png` })
    } else {
      await warte(page, 1500)
    }
    const knopf = page.locator('.po__weiter')
    const t = (await knopf.textContent()) ?? ''
    if (/Aufdecken/.test(t)) { await knopf.click(); await warte(page, 400) }
    const t2 = (await knopf.textContent()) ?? ''
    await knopf.click()
    await warte(page, 500)
    if (/Alle ansehen/.test(t2)) break
  }
  await page.waitForSelector('.po__buehne--ende', { timeout: 8000 })
  await warte(page, 1200)
  await page.screenshot({ path: `${OUT}/${pre}-9-uebersicht.png` })
  await page.locator('.po__aktionen .al-btn').first().click()
  await warte(page, 4500)
  await page.screenshot({ path: `${OUT}/${pre}-10-nach-einkleben.png` })
}
async function steuer(page, text) {
  await page.locator('.vf-leiste__knopf').click()
  await warte(page, 300)
  await page.locator('.vf-leiste__panel button').filter({ hasText: text }).first().click()
  await warte(page, 600)
}

for (const motor of MOTOREN) {
  const k = motor === 'webkit' ? 'webkit' : 'chromium'
  if (soll('start')) {
    const { b, ctx, page } = await kontext(motor)
    await page.goto(`${BASE}/album?vorfuehrung=1`, { waitUntil: 'networkidle' })
    await warte(page, 900)
    await page.screenshot({ path: `${OUT}/${k}-01-cover.png` })
    await page.locator('.al-cover').click()
    await warte(page, 1400)
    await page.screenshot({ path: `${OUT}/${k}-02-start.png`, fullPage: true })
    for (const [r, n] of [['Shiny', 'shiny-vitrine'], ['???', 'geheimseite'], ['Bonus', 'bonus'], ['Abwehr', 'abwehr'], ['Sammeln', 'sammeln']]) {
      await reiter(page, r)
      await page.screenshot({ path: `${OUT}/${k}-03-${n}.png`, fullPage: true })
    }
    await b.close()
  }
  if (soll('einfuehrung')) {
    const { b, page } = await kontext(motor, { einf: true })
    await heftAuf(page)
    await warte(page, 1200)
    for (let i = 0; i < 6; i++) {
      await page.screenshot({ path: `${OUT}/${k}-05-einfuehrung-${i + 1}.png` })
      await page.locator('.ef__fuss .al-btn').last().click()
      await warte(page, 600)
    }
    await page.screenshot({ path: `${OUT}/${k}-06-start-quellen.png`, fullPage: true })
    await b.close()
  }
  if (soll('packs')) {
    const { b, ctx, page } = await kontext(motor, { video: true })
    await heftAuf(page)
    await page.locator('.al-tuete-badge, .al-fach').first().click()
    await packDurch(page, `${k}-10-pack1-gold`)
    await packDurch(page, `${k}-11-pack2-shiny`)
    await reiter(page, 'Shiny')
    await page.screenshot({ path: `${OUT}/${k}-12-vitrine-nach-shiny.png`, fullPage: true })
    await videoSpeichern(ctx, page, `${k}-video-packs-gold-shiny`)
    await b.close()
  }
  if (soll('alle')) {
    const { b, ctx, page } = await kontext(motor, { video: true })
    await heftAuf(page)
    await steuer(page, 'Test-Pack')
    await packDurch(page, `${k}-20-alle`)
    await videoSpeichern(ctx, page, `${k}-video-testpack-alle`)
    await b.close()
  }
  if (soll('geheim')) {
    const { b, ctx, page } = await kontext(motor, { video: true })
    await heftAuf(page)
    await steuer(page, 'Geheimkarte')
    await warte(page, 1500)
    await page.screenshot({ path: `${OUT}/${k}-30-geste.png` })
    await warte(page, 2600)
    await packDurch(page, `${k}-31-geheim`)
    await page.screenshot({ path: `${OUT}/${k}-32-geheimseite-nach-fund.png`, fullPage: true })
    await videoSpeichern(ctx, page, `${k}-video-geheim-geste`)
    await b.close()
  }
  if (soll('labor')) {
    const { b, page } = await kontext(motor)
    await heftAuf(page)
    await steuer(page, 'Kartenlabor')
    await warte(page, 1500)
    await page.screenshot({ path: `${OUT}/${k}-40-labor.png` })
    await page.locator('.kl__schalter input').check()
    await warte(page, 900)
    await page.screenshot({ path: `${OUT}/${k}-40b-labor-rueckseiten.png` })
    await page.locator('.kl__schalter input').uncheck()
    await warte(page, 900)
    for (const f of ['Shiny', 'Geheim', 'Limitiert']) {
      await page.locator('.kl__f').filter({ hasText: f }).first().click()
      await warte(page, 900)
      await page.screenshot({ path: `${OUT}/${k}-41-labor-${f.toLowerCase()}.png`, fullPage: false })
    }
    await page.locator('.kl__f').filter({ hasText: 'Shiny' }).first().click()
    await warte(page, 600)
    await page.locator('.kl__karte').first().click()
    await warte(page, 1200)
    await page.screenshot({ path: `${OUT}/${k}-42-labor-gross.png` })
    await page.locator('.kl-gross__knoepfe .kl__f').first().click()
    await warte(page, 1300)
    await page.screenshot({ path: `${OUT}/${k}-43-labor-rueckseite.png` })
    await b.close()
  }
  if (soll('wappen')) {
    const { b, ctx, page } = await kontext(motor, { video: true })
    await page.goto(`${BASE}/?vorfuehrung=1`, { waitUntil: 'load' })
    await warte(page, 3500)
    for (let i = 0; i < 7; i++) { await page.locator('.kmap__brand img').click({ force: true }) }
    await warte(page, 1200)
    await page.screenshot({ path: `${OUT}/${k}-50-wappen-fund.png` })
    await page.locator('.gh__los').click()
    await page.waitForURL(/album/)
    await warte(page, 2500)
    await page.screenshot({ path: `${OUT}/${k}-51-wappen-album.png` })
    await videoSpeichern(ctx, page, `${k}-video-wappen-ei`)
    await b.close()
  }
}
if (soll('desktop')) {
  const { b, ctx, page } = await kontext('chromium', { desktop: true, video: true })
  await heftAuf(page)
  await page.screenshot({ path: `${OUT}/desktop-01-start.png` })
  await reiter(page, 'Shiny')
  await page.screenshot({ path: `${OUT}/desktop-02-shiny-geheim.png` })
  await page.locator('.al-tuete-badge, .al-fach').first().click()
  await packDurch(page, 'desktop-10-pack')
  await packDurch(page, 'desktop-11-shiny')
  await videoSpeichern(ctx, page, 'desktop-video-packs')
  await b.close()
}
try { fs.rmSync(`${OUT}/video-tmp`, { recursive: true, force: true }) } catch { /* */ }
console.log(fehler.length ? 'FEHLER:\n' + [...new Set(fehler)].join('\n') : 'Keine Fehler, keine DB-Anfragen.')
