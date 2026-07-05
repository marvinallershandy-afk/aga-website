import { chromium } from 'playwright'
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true })
const p = await ctx.newPage()
await p.goto('http://localhost:5199',{waitUntil:'load', timeout:60000})
await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, {timeout: 60000})
await p.click('text=Lieber leise')
await p.waitForTimeout(2500)
for (const [name,frac] of [['v4-3d-mobile-hero',0],['v4-3d-mobile-beat',0.14]]) {
  await p.evaluate((f)=>window.scrollTo({top:(document.documentElement.scrollHeight-window.innerHeight)*f, behavior:'instant'}), frac)
  await p.waitForTimeout(2200)
  await p.screenshot({ path:`SVA_SCREENSHOTS/${name}.png` })
  console.log('shot', name)
}
await b.close()
