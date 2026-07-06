import { chromium } from 'playwright'
const LOOP = process.env.LOOP || 'loop2'
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
async function run(tag, vp, mobile=false) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: mobile?3:2, isMobile: mobile, hasTouch: mobile })
  const p = await ctx.newPage()
  await p.goto('http://localhost:5199',{waitUntil:'load', timeout:60000})
  await p.waitForTimeout(1200)
  await p.screenshot({ path:`SVA_SCREENSHOTS/v4-${LOOP}-${tag}-tor.png` })
  await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, {timeout: 60000})
  await p.click('text=Lieber leise')
  await p.waitForTimeout(1600)
  await p.waitForTimeout(1500) // Layout-Wachstum abwarten
  const centers = await p.evaluate(() => {
    const max = document.documentElement.scrollHeight - innerHeight
    const at = (id) => {
      const el = document.getElementById(id)
      return Math.max(0, Math.min(1, (el.offsetTop + el.offsetHeight/2 - innerHeight/2) / max))
    }
    // Anflug: kurz bevor die Musik-Sektion die Mitte deckt (vor dem Schnitt)
    const el = document.getElementById('musik')
    const approach = Math.max(0, (el.offsetTop - innerHeight * 0.85) / max)
    return { beat: at('anstoss')*0.82, team: at('mannschaft'), approach, musik: at('musik'), tabelle: at('tabelle') }
  })
  for (const [name,frac] of [['hero',0],['beat',centers.beat],['team',centers.team],['approach',centers.approach],['musik',centers.musik],['tabelle',centers.tabelle],['finale',1]]) {
    await p.evaluate((f)=>window.scrollTo({top:(document.documentElement.scrollHeight-window.innerHeight)*f, behavior:'instant'}), frac); await p.waitForTimeout(2600)
    await p.screenshot({ path:`SVA_SCREENSHOTS/v4-${LOOP}-${tag}-${name}.png` })
  }
  // Karten-Modal
  await p.evaluate(() => document.querySelectorAll('.holo')[9]?.scrollIntoView({block:'center', behavior:'instant'}))
  await p.waitForTimeout(900)
  await p.locator('.holo').nth(9).click()
  await p.waitForTimeout(900)
  await p.screenshot({ path:`SVA_SCREENSHOTS/v4-${LOOP}-${tag}-modal.png` })
  await p.keyboard.press('Escape'); await p.waitForTimeout(400)
  await ctx.close()
  console.log('done', tag)
}
await run('desktop', {width:1440,height:900})
await run('mobile', {width:390,height:844}, true)
await b.close()
