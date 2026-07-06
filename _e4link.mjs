import { chromium } from 'playwright'
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
async function grab(label, ctxOpts){
  const p = await (await b.newContext(ctxOpts)).newPage()
  await p.goto('http://localhost:5199/',{waitUntil:'load',timeout:60000})
  await p.waitForFunction(()=>!document.querySelector('[data-testid=gate] button[disabled]'),null,{timeout:60000}).catch(()=>{})
  await p.click('text=Lieber leise').catch(()=>{})
  await p.waitForTimeout(1500)
  const el = await p.$('.platz-finden__body .btn')
  const href = el ? await el.getAttribute('href') : 'NOT FOUND'
  const kind = el ? await el.getAttribute('data-maps') : '-'
  console.log(`${label}: [${kind}] ${href}`)
  await p.context().close()
}
await grab('Desktop', { viewport:{width:1280,height:800} })
await grab('iPhone ', { viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' })
await b.close()
