import { chromium } from 'playwright'
// v9-E7: vollständiges Stations-Set (Desktop + Mobile) für den Abschluss.
const PORT = process.env.PORT || '5199'
const STATIONS = ['verein', 'mannschaft', 'fanblock', 'musik', 'sponsoren', 'tabelle', 'kontakt']
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
for (const [dev, w, h, dsr, ua] of [['desktop', 1440, 900, 2, undefined], ['mobile', 390, 844, 3, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)']]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsr, userAgent: ua })).newPage()
  const errs = []; p.on('pageerror', e => errs.push(e.message))
  await p.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 60000 })
  await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, { timeout: 60000 }).catch(() => {})
  await p.click('text=Lieber leise').catch(() => {})
  await p.waitForTimeout(1500)
  // Hero (top)
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await p.waitForTimeout(1600)
  await p.screenshot({ path: `SVA_SCREENSHOTS/e7-00-hero-${dev}.png` })
  // 7 Stationen
  let i = 1
  for (const id of STATIONS) {
    await p.evaluate((s) => document.getElementById(s)?.scrollIntoView({ block: 'center', behavior: 'instant' }), id)
    await p.waitForTimeout(1900)
    await p.screenshot({ path: `SVA_SCREENSHOTS/e7-0${i}-${id}-${dev}.png` })
    i++
  }
  // Finale (Maps-Rauszoom, ganz unten)
  await p.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
  await p.waitForTimeout(2200)
  await p.screenshot({ path: `SVA_SCREENSHOTS/e7-08-finale-${dev}.png` })
  console.log(dev, errs.length ? JSON.stringify(errs.slice(0, 3)) : 'ok')
  await p.context().close()
}
await b.close()
console.log('DONE')
