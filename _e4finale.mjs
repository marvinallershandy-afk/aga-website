import { chromium } from 'playwright'
// E4-Verifikation: Rauszoom-Finale (Vogelperspektive + Marker).
const PORT = process.env.PORT || '5199'
const TAG = process.env.TAG || 'e4'
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 60000 })
await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, { timeout: 60000 })
await p.click('text=Lieber leise')
await p.waitForTimeout(1500)
for (const frac of [0.85, 0.95, 1.0]) {
  await p.evaluate((f) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo({ top: max * f, behavior: 'instant' })
  }, frac)
  await p.waitForTimeout(1800)
}
await p.waitForTimeout(1800)
await p.screenshot({ path: `SVA_SCREENSHOTS/${TAG}-finale.png` })
console.log('finale', errs.length ? JSON.stringify(errs.slice(0, 3)) : 'ok')
await b.close()
