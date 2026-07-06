import { chromium } from 'playwright'
// v6 Mobile-Sweep: iPhone-Viewport, Nordstern-Audit „von Insta kommend, Handy".
const PORT = process.env.PORT || '5199'
const TAG = process.env.TAG || 'mob'
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await b.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
})).newPage()
const errs = []
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
p.on('pageerror', (e) => errs.push('PE:' + e.message))
await p.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 60000 })
await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, { timeout: 60000 }).catch(() => {})
// Gate (erster Frame = wichtigster Insta-Eindruck)
await p.screenshot({ path: `SVA_SCREENSHOTS/v6-${TAG}-00gate.png` })
await p.click('text=Lieber leise').catch(() => p.click('text=Ohne Ton').catch(() => {}))
await p.waitForFunction(() => !document.querySelector('[data-testid=gate]'), null, { timeout: 15000 }).catch(() => {})
await p.waitForTimeout(2600)
const stops = [['hero', 0], ['team', 0.41], ['musik', 0.55], ['tabelle', 0.83], ['finale', 1]]
for (const [name, frac] of stops) {
  await p.evaluate((f) => window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * f, behavior: 'instant' }), frac)
  await p.waitForTimeout(2200)
  await p.screenshot({ path: `SVA_SCREENSHOTS/v6-${TAG}-${name}.png` })
}
console.log('ERRORS', errs.length ? JSON.stringify(errs.slice(0, 4)) : 'none')
await b.close()
