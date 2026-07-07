import { chromium } from 'playwright'
// E1: Übergangs-Filmstrip Hero→Mannschaft bei feinen Scroll-Schritten.
const PORT = process.env.PORT || '5199'
const TAG = process.env.TAG || 'e1-before'
const STEPS = (process.env.STEPS || '0,0.04,0.08,0.11,0.14,0.17,0.20,0.24,0.28').split(',').map(Number)
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage()
await p.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 60000 })
await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, { timeout: 60000 })
await p.click('text=Lieber leise')
await p.waitForTimeout(1800)
for (const s of STEPS) {
  await p.evaluate((f) => window.scrollTo({ top: (document.documentElement.scrollHeight - window.innerHeight) * f, behavior: 'instant' }), s)
  await p.waitForTimeout(1400)
  await p.screenshot({ path: `SVA_SCREENSHOTS/${TAG}-${String(s).replace('.', '')}.png` })
}
console.log('flow', TAG, 'done')
await b.close()
