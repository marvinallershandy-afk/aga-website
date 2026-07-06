import { chromium } from 'playwright'
// v5-Jury-Sweep (echte GPU): Desktop (full tier erzwungen) + Mobile
// (reduced, wie Geräte-Heuristik). Beats inkl. Durchfahrts-Momente.
// LOOP=loop1|loop2|... → SVA_SCREENSHOTS/v5-<LOOP>-<vp>-<beat>.png
const LOOP = process.env.LOOP || 'loop1'
const b = await chromium.launch({ headless: false, args: ['--hide-scrollbars', '--window-position=40,40'] })

async function run(tag, vp, mobile) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: mobile ? 3 : 2, isMobile: mobile, hasTouch: mobile })
  const p = await ctx.newPage()
  await p.goto('http://localhost:5199', { waitUntil: 'load', timeout: 60000 })
  await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, { timeout: 60000 })
  await p.click('text=Lieber leise')
  await p.waitForTimeout(2600)
  await p.evaluate((m) => window.useStore.getState().setCinemaTier(m ? 'reduced' : 'full'), mobile)
  const centers = await p.evaluate(() => {
    const max = document.documentElement.scrollHeight - innerHeight
    const at = (id) => {
      const el = document.getElementById(id)
      return Math.max(0, Math.min(1, (el.offsetTop + el.offsetHeight / 2 - innerHeight / 2) / max))
    }
    const musik = document.getElementById('musik')
    const vh = innerHeight
    const pAt = (tp) => Math.max(0, (musik.offsetTop - (vh * 1.05 - tp * vh * 0.8)) / max)
    return {
      beat: at('anstoss') * 0.82,
      kickoff: at('anstoss'),
      team: at('mannschaft'),
      tuer: pAt(0.38),
      flur: pAt(0.62),
      raum: at('musik'),
      tabelle: at('tabelle'),
    }
  })
  const beats = [['hero', 0], ...Object.entries(centers), ['finale', 1]]
  for (const [name, frac] of beats) {
    await p.evaluate((f) => window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * f, behavior: 'instant' }), frac)
    await p.waitForTimeout(2600)
    await p.screenshot({ path: `SVA_SCREENSHOTS/v5-${LOOP}-${tag}-${name}.png` })
    console.log(tag, name)
  }
  await ctx.close()
}

await run('desktop', { width: 1440, height: 900 }, false)
await run('mobil', { width: 390, height: 844 }, true)
await b.close()
