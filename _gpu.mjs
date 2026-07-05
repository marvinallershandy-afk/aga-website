import { chromium } from 'playwright'
const b = await chromium.launch({ headless: false, args:['--window-position=50,50'] })
const p = await (await b.newContext({ viewport:{width:1280,height:800} })).newPage()
await p.goto('http://localhost:5199',{waitUntil:'load', timeout:60000})
await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, {timeout: 60000})
await p.click('text=Ohne Ton'); await p.waitForTimeout(2000)
const total = await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight)
for (const [name,frac] of [['hero',0],['team',0.5],['tabelle',0.83],['kontakt',1]]) {
  await p.evaluate((y)=>window.scrollTo(0,y), Math.round(total*frac)); await p.waitForTimeout(1500)
  const ft = await p.evaluate(()=>new Promise(r=>{const ts=[];let last=performance.now();let n=0;
    function loop(t){ts.push(t-last);last=t;if(++n<120)requestAnimationFrame(loop);else{ts.sort((a,b)=>a-b);r({avg:+(ts.reduce((a,b)=>a+b)/ts.length).toFixed(2),p95:+ts[Math.floor(ts.length*0.95)].toFixed(2)})}}
    requestAnimationFrame(loop)}))
  console.log(process.env.TAG||'gpu', name, JSON.stringify(ft))
}
await b.close()
