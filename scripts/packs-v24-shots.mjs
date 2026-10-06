// v24-P: Frames + Videos aller Pack-Typen (Tütchen-Optik, Reveal) in der
// Album-Vorführung, dazu Bildrate beim Öffnen (rAF-Frametimes, p95).
// Nichts geht ins Netz — die Vorführung läuft komplett im Browser.
//   VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 5247 --strictPort
//   BASE=http://localhost:5247 OUT=shots-v24-packs/typen node scripts/packs-v24-shots.mjs   (ENG=webkit · VIDEO=1 · VIEW=d)
import { chromium, webkit } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5247'
const OUT = process.env.OUT || 'shots-v24-packs/typen'
const ENG = process.env.ENG === 'webkit' ? 'webkit' : 'chromium'
const VIEW = process.env.VIEW === 'd' ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
const V = process.env.VIEW === 'd' ? 'd' : 'm'
fs.mkdirSync(OUT, { recursive: true })
const browser = await (ENG === 'webkit' ? webkit : chromium).launch(ENG === 'chromium' ? { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } : {})
const TYPEN = [['tipp', 'Tipp-Pack'], ['spieltag', 'Spieltags-Pack'], ['sieg', 'Sieg-Pack'], ['starter', 'Starter-Pack'], ['ziel', 'Ziel-Pack'], ['event', 'Event-Pack']]
// Vergleich mit einem älteren Stand: KNOPF='Normales Pack' klickt diesen Steuerleisten-Knopf statt der Pack-Typen
if (process.env.KNOPF) TYPEN.splice(0, TYPEN.length, ['vergleich', process.env.KNOPF])
const ergebnis = []

for (const [typ, titel] of TYPEN) {
  const ctx = await browser.newContext({ ...VIEW, ...(process.env.VIDEO ? { recordVideo: { dir: `${OUT}/video-${typ}-${ENG}-${V}`, size: VIEW.viewport } } : {}) })
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('sva-album-einfuehrung', '1')
      localStorage.setItem('sva-album-einfuehrung-v22', '1')
      sessionStorage.setItem('sva-album-offen', '1')
    } catch {
      /* */
    }
  })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.goto(`${BASE}/album?vorfuehrung=1`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.locator('.vf-leiste__knopf').click()
  await (process.env.KNOPF ? page.locator('.vf-leiste__panel button', { hasText: titel }) : page.locator('.vf-typ', { hasText: titel })).first().click()
  await page.waitForSelector('.po__auf:not([disabled])', { timeout: 8000 })
  await page.waitForTimeout(700)
  const optik = await page.locator('.po-tuete').getAttribute('data-optik')
  const reveal = await page.locator('.po').getAttribute('data-reveal')
  await page.screenshot({ path: `${OUT}/${typ}-1-tuete-${ENG}-${V}.png` })
  // Frametimes ab dem Aufreißen messen
  await page.evaluate(() => {
    window.__ft = []
    let last = performance.now()
    const f = (t) => {
      window.__ft.push(t - last)
      last = t
      if (window.__ft.length < 2000) requestAnimationFrame(f)
    }
    requestAnimationFrame(f)
  })
  await page.locator('.po__auf').click()
  await page.waitForTimeout(reveal === '1' ? 450 : reveal === '3' ? 700 : 550)
  await page.screenshot({ path: `${OUT}/${typ}-2-reissen-${ENG}-${V}.png` })
  await page.waitForSelector('.po__buehne--karte', { timeout: 6000 })
  // alle Karten aufdecken (Walkouts abwarten), dabei Frames
  let n = 0
  for (let i = 0; i < 8; i++) {
    if (!(await page.locator('.po__buehne--karte').count())) break
    await page.waitForSelector('.po__karte.is-auf', { timeout: 9000 }).catch(() => {})
    await page.waitForTimeout(250)
    await page.screenshot({ path: `${OUT}/${typ}-3-karte${++n}-${ENG}-${V}.png` })
    await page.locator('.po__weiter').click()
    await page.waitForTimeout(150)
  }
  await page.waitForSelector('.po__buehne--ende', { timeout: 6000 })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${typ}-4-ende-${ENG}-${V}.png` })
  const ft = (await page.evaluate(() => window.__ft)).slice(5).sort((a, b) => a - b)
  const p = (q) => ft[Math.min(ft.length - 1, Math.floor(q * ft.length))]
  const karten = await page.locator('.po__liste li').count()
  ergebnis.push({ typ, optik, reveal, karten, frames: ft.length, 'p50 ms': p(0.5).toFixed(1), 'p95 ms': p(0.95).toFixed(1), '>33 ms': ft.filter((x) => x > 33.4).length, fehler: errs.length })
  await page.locator('.po__aktionen .al-btn').first().click()
  await page.waitForTimeout(2500) // einkleben
  await page.screenshot({ path: `${OUT}/${typ}-5-eingeklebt-${ENG}-${V}.png` })
  await ctx.close()
}
console.table(ergebnis)
fs.writeFileSync(`${OUT}/frametimes-${ENG}-${V}.json`, JSON.stringify(ergebnis, null, 2))
await browser.close()
