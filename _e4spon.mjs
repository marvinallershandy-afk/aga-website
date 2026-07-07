import { chromium } from 'playwright'
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
for (const [dev,w,h,dsr,ua] of [['desktop',1440,900,2,undefined],['mobile',390,844,3,'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)']]) {
  const p = await (await b.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:dsr, userAgent:ua })).newPage()
  const errs=[]; p.on('pageerror',e=>errs.push(e.message))
  await p.goto('http://localhost:5199/',{waitUntil:'load',timeout:60000})
  await p.waitForFunction(()=>!document.querySelector('[data-testid=gate] button[disabled]'),null,{timeout:60000}).catch(()=>{})
  await p.click('text=Lieber leise').catch(()=>{}); await p.waitForTimeout(2000)
  await p.evaluate(()=>document.getElementById('sponsoren')?.scrollIntoView({block:'center',behavior:'instant'}))
  await p.waitForTimeout(2400)
  await p.screenshot({ path:`SVA_SCREENSHOTS/e4-sponsoren-${dev}.png` })
  console.log(dev, errs.length?JSON.stringify(errs.slice(0,3)):'ok')
  await p.context().close()
}
await b.close()
