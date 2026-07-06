import { chromium } from 'playwright'
// E2-Verifikation: Anflug zur Vereinsheim-Tür bei mehreren p-Werten.
// v8-Scroll-Formel (PartyDirector): rect.top = 0.95vh - p*1.15vh
//   → scrollY = offsetTop - 0.95vh + p*1.15vh
const PORT = process.env.PORT || '5199'
const TAG = process.env.TAG || 'e2'
const PS = (process.env.PS || '0.0,0.15,0.3,0.4,0.46').split(',').map(Number)
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage()
await p.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 60000 })
await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, { timeout: 60000 })
await p.click('text=Lieber leise')
await p.waitForTimeout(2000)
for (const tp of PS) {
  await p.evaluate((t) => {
    const el = document.getElementById('musik')
    const vh = window.innerHeight
    window.scrollTo({ top: el.offsetTop - vh * 0.95 + t * vh * 1.15, behavior: 'instant' })
  }, tp)
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `SVA_SCREENSHOTS/${TAG}-anflug-${String(tp).replace('.', '')}.png` })
  console.log('anflug', tp)
}
await b.close()
