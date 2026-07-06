import { chromium } from 'playwright'
// Schnelle Kadrierungs-Iteration: CAMS = JSON [[name,"x,y,z,lx,ly,lz"],...]
const PORT = process.env.PORT || '5199'
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
for (const [name, cam] of JSON.parse(process.env.CAMS)) {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage()
  await p.goto(`http://localhost:${PORT}/?cam=${cam}`, { waitUntil: 'load', timeout: 60000 })
  await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, { timeout: 60000 })
  await p.click('text=Lieber leise').catch(() => p.click('text=Ohne Ton'))
  await p.waitForTimeout(2200)
  await p.evaluate(() => { document.querySelectorAll('main, nav, [data-testid=dom]').forEach(() => {}) })
  await p.screenshot({ path: `SVA_SCREENSHOTS/v5-cam-${name}.png` })
  console.log(name, cam)
  await p.context().close()
}
await b.close()
