// v17-G: TV-Aufstellung auf /live headless prüfen + screenshotten.
//   npx vite --port 5194 --strictPort      (vorher starten)
//   BASE=http://localhost:5194 OUT=./shots-gs node scripts/aufstellung-audit.mjs
//   REAL=1 …                               zusätzlich ein Lauf gegen das echte web_live (anon, nur lesen)
// Prüft: immer 11 Positionen, kein three.js, keine 3D-Reste, 0 Konsolenfehler,
// Markierungen (Tore, Wechsel, Kapitän, Karten), Partner-Zeile, Story-PNG.
import { chromium } from 'playwright'
import fs from 'node:fs'
import { aufstellungFixture } from './aufstellung-fixtures.mjs'

const BASE = process.env.BASE || 'http://localhost:5194'
const OUT = process.env.OUT || './shots-gs'
fs.mkdirSync(OUT, { recursive: true })
const errors = []
const checks = []
const check = (ok, msg) => checks.push(`${ok ? 'OK    ' : 'FEHLER'}  ${msg}`)

const VIEWS = [
  ['360', { viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
  ['390', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
  ['430', { viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
  ['desktop', { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 }],
]
const VARIANTEN = (process.env.VARIANTEN ?? '442-live,433-bug,352-ende,433-vorher').split(',').filter(Boolean)

async function oeffnen(ctx, vname, label) {
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${label}] console ${m.text().slice(0, 200)}`) })
  await page.goto(`${BASE}/live`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.lv-hero', { timeout: 15000 })
  if (vname !== 'desktop') {
    await page.getByRole('button', { name: 'Aufstellung', exact: true }).click()
  }
  await page.waitForSelector('.tv-sp', { state: 'attached', timeout: 8000 })
  // Brustbilder laden lassen
  await page.evaluate(async () => {
    document.querySelector('.tv')?.scrollIntoView({ block: 'start' })
    await Promise.all([...document.querySelectorAll('.tv img')].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r }))))
  })
  // Sticky-Kopf/Tabs für die Element-Screenshots aus dem Weg
  await page.addStyleTag({ content: '.lv-top, .lv-tabs { position: static !important; }' })
  await page.waitForTimeout(400)
  return page
}

const browser = await chromium.launch()
for (const v of VARIANTEN) {
  for (const [vname, vopts] of VIEWS) {
    if (vname === '360' && v !== '433-bug') continue
    const ctx = await browser.newContext(vopts)
    await ctx.route('**/rest/v1/rpc/web_live', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(aufstellungFixture(v)) }))
    await ctx.route('https://www.fussball.de/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }))
    const label = `${vname}/${v}`
    const page = await oeffnen(ctx, vname, label)
    const n = await page.locator('.tv-sp').count()
    const nn = await page.locator('.tv-sp.is-nn').count()
    check(n === 11, `[${label}] 11 Positionen (gefunden ${n}, davon N. N.: ${nn})`)
    const ids = await page.locator('.tv-sp').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
    check(new Set(ids.filter((x) => x !== 'Position nicht besetzt')).size === ids.filter((x) => x !== 'Position nicht besetzt').length, `[${label}] niemand doppelt auf dem Platz`)
    const three = await page.evaluate(() => performance.getEntriesByType('resource').some((r) => /three|lineup3d|atlas\.mp4/.test(r.name)))
    check(!three, `[${label}] kein three.js / Atlas geladen`)
    check((await page.locator('text=3D-Aufstellung').count()) === 0, `[${label}] kein 3D-Knopf`)
    const tore = await page.locator('.tv-tor').count()
    const rein = await page.locator('.tv-rein').count()
    const partner = await page.locator('.tv-partner').count()
    checks.push(`INFO    [${label}] Tore-Marken ${tore}, Einwechsel-Marken ${rein}, Partnerzeile ${partner}, Bank ${await page.locator('.tv-bank li').count()}`)
    // Überlappung der Namensplatten (gleiche Zeile) prüfen
    const overlap = await page.evaluate(() => {
      const r = [...document.querySelectorAll('.tv-plate')].map((e) => e.getBoundingClientRect())
      let o = 0
      for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
        const a = r[i], b = r[j]
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (w > 2 && h > 2) o++
      }
      return o
    })
    check(overlap === 0, `[${label}] keine überlappenden Namensplatten (${overlap})`)
    const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    check(!hscroll, `[${label}] kein horizontales Scrollen`)
    await page.locator('.tv').screenshot({ path: `${OUT}/live-tv-${v}-${vname}.png` })
    if (vname === 'desktop') {
      await page.screenshot({ path: `${OUT}/live-tv-${v}-desktop-seite.png`, fullPage: false })
      // Story-PNG (1080×1920) mit demselben Datenmodell rendern (Modul über den Dev-Server)
      const png = await page.evaluate(async (fx) => {
        const daten = await import('/src/live/aufstellung/daten.ts')
        const story = await import('/src/live/aufstellung/story.ts')
        const cv = await story.renderAufstellungStory(daten.ausLiveDaten(fx))
        return { url: cv.toDataURL('image/png'), w: cv.width, h: cv.height }
      }, aufstellungFixture(v))
      fs.writeFileSync(`${OUT}/story-aufstellung-${v}.png`, Buffer.from(png.url.split(',')[1], 'base64'))
      check(png.w === 1080 && png.h === 1920, `[${label}] Story-PNG 1080×1920 exportierbar (Canvas nicht „tainted“)`)
    }
    await ctx.close()
  }
}

if (process.env.REAL) {
  // Echter Lese-Aufruf gegen web_live (anon-Key aus .env über Vite) — nichts gemockt
  const ctx = await browser.newContext(VIEWS[1][1])
  let status = null
  ctx.on('response', (r) => { if (r.url().includes('/rpc/web_live')) status = r.status() })
  const page = await oeffnen(ctx, '390', 'echt')
  const n = await page.locator('.tv-sp').count()
  check(status === 200, `[echt] web_live antwortet ${status}`)
  check(n === 11, `[echt] 11 Positionen aus der echten Datenbank (gefunden ${n}, N. N.: ${await page.locator('.tv-sp.is-nn').count()})`)
  await page.locator('.tv').screenshot({ path: `${OUT}/live-tv-echt-390.png` })
  await ctx.close()
}
await browser.close()
console.log(checks.join('\n'))
console.log('\n--- FEHLER ---\n' + (errors.length ? [...new Set(errors)].join('\n') : 'keine'))
