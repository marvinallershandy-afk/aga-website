// v26-Z2: Ziele-Seite der Album-Vorführung headless prüfen (Handy WebKit + Chromium,
// Desktop 1440×900). KEINE DB, KEIN Login: /album?vorfuehrung=1 ist reine Simulation.
// Meldet jede Supabase-Anfrage (Soll: keine).
//   npx vite --port 5197 --strictPort
//   BASE=http://localhost:5197 OUT=./shots-v26-album node scripts/album-v26-shots.mjs [ziele,teaser,desktop]
import { chromium, webkit, devices } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5197'
const OUT = process.env.OUT || './shots-v26-album'
const NUR = (process.argv[2] || process.env.NUR || '').split(',').filter(Boolean)
const MOTOREN = (process.env.MOTOR || 'webkit,chromium').split(',')
// Task: Chromium auf diesem Mac mit Metal; CI-Fallback swiftshader via MOTOR/ANGLE.
const ANGLE = process.env.ANGLE || 'metal'
fs.mkdirSync(OUT, { recursive: true })
const soll = (t) => !NUR.length || NUR.includes(t)
const warte = (p, ms) => p.waitForTimeout(ms)
const fehler = []

async function kontext(motor, { desktop = false } = {}) {
  const args = motor === 'chromium' ? (ANGLE === 'metal' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']) : []
  const b = await (motor === 'webkit' ? webkit : chromium).launch(motor === 'chromium' ? { args } : {})
  const geraet = desktop
    ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
    : motor === 'webkit'
      ? { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }
      : { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }
  const ctx = await b.newContext(geraet)
  ctx.on('request', (r) => {
    const u = r.url()
    if (!u.startsWith(BASE) && /supabase|\/rest\/v1|\/auth\/v1/.test(u)) fehler.push(`[${motor}] DB-Anfrage in der Vorführung: ${u}`)
  })
  await ctx.addInitScript(() => { try { localStorage.setItem('sva-album-einfuehrung', '1'); localStorage.setItem('sva-album-ziele-gesehen', '[]') } catch { /* */ } })
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
  await warte(page, 1200)
}

for (const motor of MOTOREN) {
  const k = motor === 'webkit' ? 'webkit' : 'chromium'
  if (soll('ziele')) {
    const { b, page } = await kontext(motor)
    await heftAuf(page)
    await reiter(page, 'Ziele')
    await warte(page, 900)
    await page.screenshot({ path: `${OUT}/${k}-01-ziele.png`, fullPage: true }).catch(() => page.screenshot({ path: `${OUT}/${k}-01-ziele.png` }))
    // Filter durchklicken
    for (const [chip, name] of [['Fast geschafft', 'fast'], ['Platz & Check-in', 'platz'], ['Woche & Monat', 'woche'], ['Sets & Familien', 'sets'], ['Geheim', 'geheim']]) {
      await page.locator('.zm-chip').filter({ hasText: chip }).first().click()
      await warte(page, 600)
      await page.screenshot({ path: `${OUT}/${k}-02-filter-${name}.png`, fullPage: true }).catch(() => page.screenshot({ path: `${OUT}/${k}-02-filter-${name}.png` }))
    }
    await b.close()
  }
  if (soll('kult')) {
    const { b, page } = await kontext(motor)
    await heftAuf(page)
    await reiter(page, 'Kult')
    await warte(page, 1000)
    await page.screenshot({ path: `${OUT}/${k}-04-kult-seite.png`, fullPage: true }).catch(() => page.screenshot({ path: `${OUT}/${k}-04-kult-seite.png` }))
    // Kartenlabor → Filter „Kult"
    await page.locator('.vf-leiste__knopf').click().catch(() => {})
    await page.locator('.vf-leiste__panel button').filter({ hasText: 'Kartenlabor' }).click().catch(() => {})
    await warte(page, 1200)
    await page.locator('.kl__f').filter({ hasText: 'Kult' }).first().click().catch(() => {})
    await warte(page, 800)
    await page.screenshot({ path: `${OUT}/${k}-05-labor-kult.png` }).catch(() => {})
    await page.locator('.kl__karte').first().click().catch(() => {})
    await warte(page, 1200)
    await page.screenshot({ path: `${OUT}/${k}-06-kult-gross.png` }).catch(() => {})
    await b.close()
  }
  if (soll('teaser')) {
    const { b, page } = await kontext(motor)
    await heftAuf(page)
    await reiter(page, 'Sammeln')
    await warte(page, 700)
    await page.locator('.zm-teaser').scrollIntoViewIfNeeded().catch(() => {})
    await warte(page, 400)
    await page.screenshot({ path: `${OUT}/${k}-03-teaser.png`, fullPage: true }).catch(() => page.screenshot({ path: `${OUT}/${k}-03-teaser.png` }))
    await b.close()
  }
}
if (soll('desktop')) {
  const { b, page } = await kontext('chromium', { desktop: true })
  await heftAuf(page)
  await reiter(page, 'Ziele')
  await warte(page, 900)
  await page.screenshot({ path: `${OUT}/desktop-01-ziele.png` })
  await page.locator('.zm-chip').filter({ hasText: 'Geheim' }).first().click()
  await warte(page, 600)
  await page.screenshot({ path: `${OUT}/desktop-02-ziele-geheim.png` })
  await b.close()
}
console.log(fehler.length ? 'FEHLER:\n' + [...new Set(fehler)].join('\n') : 'Keine Fehler, keine DB-Anfragen.')
