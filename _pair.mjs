import { chromium } from 'playwright'
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport:{width:960,height:540}, deviceScaleFactor:2 })
const pairs = [
  ['P1-vereinsheim', '-1.5,0.55,0.6,7.2,0.4,-0.3'],
  ['P2-nordreling', '0,0.5,-4.4,0,0.2,4'],
  ['P3-satellit', '0.5,15,0.01,0,0,0'],
  ['P4-fanblock-sw', '-2.2,0.4,5.2,-4.6,0.3,3.6'],
  ['P5-huette-nw', '-2.8,0.5,-2.6,-5.2,0.3,-5.2'],
]
for (const [name, cam] of pairs) {
  const p = await ctx.newPage()
  await p.goto(`http://localhost:5199/?cam=${cam}`,{waitUntil:'load', timeout:60000})
  await p.waitForFunction(() => window.useStore?.getState().ready, null, { timeout: 60000 })
  await p.evaluate(() => { window.useStore.getState().setGateOpen(true) })
  await p.waitForTimeout(1500)
  await p.evaluate(() => { document.querySelector('[data-testid=gate]')?.remove() })
  await p.evaluate(() => {
    for (const sel of ['.scroll-root','.brandbar','.scrollhint']) document.querySelector(sel)?.setAttribute('style','display:none')
  })
  await p.waitForTimeout(400)
  await p.screenshot({ path:`SVA_SCREENSHOTS/v3-vergleich-${name}-render.png` })
  await p.close()
  console.log('shot', name)
}
await b.close()
