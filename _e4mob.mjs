import { chromium } from 'playwright'
const PORT = process.env.PORT || '5199'
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' })).newPage()
await p.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 60000 })
await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, { timeout: 60000 })
await p.click('text=Lieber leise').catch(() => {})
await p.waitForTimeout(1500)
for (const frac of [0.85, 0.95, 1.0]) {
  await p.evaluate((f) => { const max = document.documentElement.scrollHeight - window.innerHeight; window.scrollTo({ top: max * f, behavior: 'instant' }) }, frac)
  await p.waitForTimeout(1700)
}
await p.waitForTimeout(1600)
await p.screenshot({ path: `SVA_SCREENSHOTS/e4-finale-mobile.png` })
console.log('finale mobile ok')
await b.close()
