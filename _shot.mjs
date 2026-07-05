import { chromium } from 'playwright'
const PORT = process.env.PORT || '5199'
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const p = await (await b.newContext({ viewport:{width:1440,height:900}, deviceScaleFactor:2 })).newPage()
const errs=[]; p.on('console',m=>m.type()==='error'&&errs.push(m.text())); p.on('pageerror',e=>errs.push('PE:'+e.message))
await p.goto(`http://localhost:${PORT}`,{waitUntil:'load', timeout:60000})
await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, {timeout: 60000})
await p.click('text=Lieber leise').catch(()=>p.click('text=Ohne Ton'))
await p.waitForFunction(() => !document.querySelector('[data-testid=gate]'), null, {timeout: 15000}).catch(()=>{})
await p.waitForTimeout(1500)
async function frametime(){ return p.evaluate(()=>new Promise(r=>{const ts=[];let last=performance.now();let n=0;
  function loop(t){ts.push(t-last);last=t;if(++n<60)requestAnimationFrame(loop);else{ts.sort((a,b)=>a-b);r({avg:+(ts.reduce((a,b)=>a+b)/ts.length).toFixed(1),p95:+ts[Math.floor(ts.length*0.95)].toFixed(1)})}}
  requestAnimationFrame(loop)})) }
for (const [name,frac] of JSON.parse(process.env.SHOTS)) {
  await p.evaluate((f)=>window.scrollTo({top:(document.documentElement.scrollHeight-window.innerHeight)*f, behavior:'instant'}), frac)
  await p.waitForTimeout(2000)
  const ft = await frametime()
  const stats = await p.evaluate(()=>window.useStore.getState().perfStats)
  console.log(name, 'ft:', JSON.stringify(ft), 'draws:', stats.drawCalls, 'tris:', stats.triangles)
  await p.screenshot({ path:`SVA_SCREENSHOTS/${name}.png` })
}
console.log('ERRORS', errs.length?JSON.stringify(errs.slice(0,6)):'none')
await b.close()
