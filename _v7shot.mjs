import { chromium } from 'playwright'
const TAG=process.env.TAG||'v7'
const FRAC=process.env.FRAC?JSON.parse(process.env.FRAC):[['hero',0]]
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const p = await (await b.newContext({ viewport:{width:1440,height:900}, deviceScaleFactor:2 })).newPage()
const errs=[]; p.on('pageerror',e=>errs.push('PE:'+e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text()))
await p.goto('http://localhost:5199/',{waitUntil:'load',timeout:60000})
await p.waitForFunction(()=>!document.querySelector('[data-testid=gate] button[disabled]'),null,{timeout:60000}).catch(()=>{})
await p.click('text=Lieber leise').catch(()=>p.click('text=Ohne Ton').catch(()=>{}))
await p.waitForTimeout(2600)
for (const [name,f] of FRAC){
  await p.evaluate((ff)=>window.scrollTo({top:(document.documentElement.scrollHeight-window.innerHeight)*ff,behavior:'instant'}),f)
  await p.waitForTimeout(2400)
  await p.screenshot({ path:`SVA_SCREENSHOTS/v7-${TAG}-${name}.png` })
}
console.log('ERRORS', errs.length?JSON.stringify(errs.slice(0,5)):'none')
await b.close()
