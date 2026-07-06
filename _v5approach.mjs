import { chromium } from 'playwright'
// Nur der Anflug: Screenshots bei p=0.2/0.3/0.38/0.44 (Sichtprüfung)
const PORT = process.env.PORT || '5199'
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage()
await p.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 60000 })
await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, { timeout: 60000 })
await p.click('text=Lieber leise')
await p.waitForTimeout(2000)
for (const tp of [0.2, 0.3, 0.38, 0.44]) {
  await p.evaluate((t) => {
    const el = document.getElementById('musik')
    const vh = window.innerHeight
    window.scrollTo({ top: el.offsetTop - (vh * 1.9 - t * vh * 1.6), behavior: 'instant' })
  }, tp)
  await p.waitForTimeout(1600)
  await p.screenshot({ path: `SVA_SCREENSHOTS/v5-anflug-${String(tp).replace('.', '')}.png` })
  console.log('anflug', tp)
}
await b.close()
