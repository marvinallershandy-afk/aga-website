import { chromium } from 'playwright'
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
for (const [name,w,h,dsr] of [['desktop',1440,900,2],['mobile',390,844,3]]) {
  const p = await (await b.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:dsr, userAgent: dsr===3?'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)':undefined })).newPage()
  const errs=[]; p.on('pageerror',e=>errs.push(e.message))
  await p.goto('http://localhost:5199/',{waitUntil:'load',timeout:60000})
  await p.waitForFunction(()=>!document.querySelector('[data-testid=gate] button[disabled]'),null,{timeout:60000}).catch(()=>{})
  await p.click('text=Lieber leise').catch(()=>p.click('text=Ohne Ton').catch(()=>{}))
  await p.waitForTimeout(2000)
  await p.evaluate(()=>{ const el=document.getElementById('kontakt'); el && el.scrollIntoView({block:'center'}) })
  await p.waitForTimeout(2200)
  await p.screenshot({ path:`SVA_SCREENSHOTS/v6-e4-${name}.png` })
  console.log(name, errs.length?JSON.stringify(errs.slice(0,3)):'ok')
  await p.context().close()
}
await b.close()
