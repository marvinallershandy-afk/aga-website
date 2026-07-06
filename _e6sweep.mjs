import { chromium } from 'playwright'
// E6-Abschluss-Sweep: alle Sektionen Desktop + Mobile.
const PORT = process.env.PORT || '5199'
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const devices = [
  ['desktop', 1440, 900, 2, undefined],
  ['mobile', 390, 844, 3, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'],
]
const sections = ['verein', 'mannschaft', 'musik', 'tabelle', 'kontakt']
for (const [dev, w, h, dsr, ua] of devices) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsr, userAgent: ua })).newPage()
  const errs = []; p.on('pageerror', e => errs.push(e.message))
  await p.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 60000 })
  await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, { timeout: 60000 }).catch(() => {})
  await p.click('text=Lieber leise').catch(() => {})
  await p.waitForTimeout(2200)
  // Hero (top)
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await p.waitForTimeout(2200)
  await p.screenshot({ path: `SVA_SCREENSHOTS/e6-${dev}-hero.png` })
  for (const id of sections.slice(1)) {
    await p.evaluate((s) => document.getElementById(s)?.scrollIntoView({ block: 'center', behavior: 'instant' }), id)
    await p.waitForTimeout(2200)
    await p.screenshot({ path: `SVA_SCREENSHOTS/e6-${dev}-${id}.png` })
  }
  // Finale (ganz unten, Rauszoom)
  await p.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
  await p.waitForTimeout(2600)
  await p.screenshot({ path: `SVA_SCREENSHOTS/e6-${dev}-finale.png` })
  console.log(dev, errs.length ? JSON.stringify(errs.slice(0, 3)) : 'ok')
  await p.context().close()
}
await b.close()
