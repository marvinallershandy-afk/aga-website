import { chromium } from 'playwright'
const PORT = process.env.PORT || '5173'
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const p = await (await b.newContext({ viewport:{width:1440,height:900}, deviceScaleFactor:2 })).newPage()
const errs=[]; p.on('console',m=>m.type()==='error'&&errs.push(m.text())); p.on('pageerror',e=>errs.push('PE:'+e.message))
await p.goto(`http://localhost:${PORT}`,{waitUntil:'networkidle'}); await p.waitForTimeout(4200)
const total = await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight)
async function frametime(){ return p.evaluate(()=>new Promise(r=>{const ts=[];let last=performance.now();let n=0;
  function loop(t){ts.push(t-last);last=t;if(++n<60)requestAnimationFrame(loop);else{ts.sort((a,b)=>a-b);r({avg:+(ts.reduce((a,b)=>a+b)/ts.length).toFixed(1),p95:+ts[Math.floor(ts.length*0.95)].toFixed(1)})}}
  requestAnimationFrame(loop)})) }
for (const [name,frac] of JSON.parse(process.env.SHOTS)) {
  await p.evaluate((y)=>window.scrollTo(0,y), Math.round(total*frac)); await p.waitForTimeout(1700)
  const ft = await frametime()
  const stats = await p.evaluate(()=>window.useStore.getState().perfStats)
  console.log(name, 'ft:', JSON.stringify(ft), 'draws:', stats.drawCalls, 'tris:', stats.triangles)
  await p.screenshot({ path:`SVA_SCREENSHOTS/${name}.png` })
}
console.log('ERRORS', errs.length?JSON.stringify(errs.slice(0,6)):'none')
await b.close()
