import { chromium } from 'playwright'
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
async function run(tag, vp, mobile=false) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: mobile?3:2, isMobile: mobile, hasTouch: mobile })
  const p = await ctx.newPage()
  await p.goto('http://localhost:5199',{waitUntil:'load', timeout:60000})
  await p.waitForTimeout(1200)
  await p.screenshot({ path:`SVA_SCREENSHOTS/v4-audit-${tag}-tor.png` })
  await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, {timeout: 60000})
  await p.click('text=Ohne Ton')
  await p.waitForTimeout(1600)
  await p.waitForTimeout(1500) // Layout-Wachstum abwarten
const total = await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight)
  for (const [name,frac] of [['hero',0],['beat',0.16],['team',0.4],['musik? none',-1],['tabelle',0.72],['finale',1]]) {
    if (frac < 0) continue
    await p.evaluate((f)=>window.scrollTo({top:(document.documentElement.scrollHeight-window.innerHeight)*f, behavior:'instant'}), frac); await p.waitForTimeout(2000)
    await p.screenshot({ path:`SVA_SCREENSHOTS/v4-audit-${tag}-${name}.png` })
  }
  // Karten-Modal
  await p.evaluate(() => document.querySelectorAll('.holo')[9]?.scrollIntoView({block:'center', behavior:'instant'}))
  await p.waitForTimeout(900)
  await p.locator('.holo').nth(9).click()
  await p.waitForTimeout(900)
  await p.screenshot({ path:`SVA_SCREENSHOTS/v4-audit-${tag}-modal.png` })
  await p.keyboard.press('Escape'); await p.waitForTimeout(400)
  // Partyraum
  await p.evaluate((y)=>window.scrollTo(0,y), Math.round(total*0.72)); await p.waitForTimeout(1400)
  const enter = p.locator('text=Reinkommen?')
  if (await enter.count()) {
    await enter.click(); await p.waitForTimeout(2200)
    await p.screenshot({ path:`SVA_SCREENSHOTS/v4-audit-${tag}-party.png` })
  }
  await ctx.close()
  console.log('done', tag)
}
await run('desktop', {width:1440,height:900})
await run('mobile', {width:390,height:844}, true)
await b.close()
