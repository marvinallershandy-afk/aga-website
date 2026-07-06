import { chromium } from 'playwright'
// v5-Stationsshots: misst Sektions-Zentren, screenshotted + Frametime je Station.
// TAG=vorher|nachher|…  BEATS=optional JSON [[name,frac|"@id"],...]
const TAG = process.env.TAG || 'shot'
const PORT = process.env.PORT || '5199'
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage()
const errs = []
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
p.on('pageerror', (e) => errs.push('PE:' + e.message))
await p.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 60000 })
await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, { timeout: 60000 })
await p.click('text=Lieber leise').catch(() => p.click('text=Ohne Ton'))
await p.waitForFunction(() => !document.querySelector('[data-testid=gate]'), null, { timeout: 15000 }).catch(() => {})
await p.waitForTimeout(2600)

const centers = await p.evaluate(() => {
  const max = document.documentElement.scrollHeight - innerHeight
  const at = (id) => {
    const el = document.getElementById(id)
    return Math.max(0, Math.min(1, (el.offsetTop + el.offsetHeight / 2 - innerHeight / 2) / max))
  }
  const el = document.getElementById('musik')
  const approach = Math.max(0, (el.offsetTop - innerHeight * 0.85) / max)
  return { beat: at('anstoss') * 0.82, team: at('mannschaft'), approach, musik: at('musik'), tabelle: at('tabelle') }
})
const DEFAULT = [['hero', 0], ['beat', centers.beat], ['team', centers.team], ['approach', centers.approach], ['tabelle', centers.tabelle], ['finale', 1]]
const beats = process.env.BEATS
  ? JSON.parse(process.env.BEATS).map(([n, f]) => [n, typeof f === 'string' && f.startsWith('@') ? centers[f.slice(1)] : f])
  : DEFAULT

async function frametime() {
  return p.evaluate(() => new Promise((r) => {
    const ts = []; let last = performance.now(); let n = 0
    function loop(t) {
      ts.push(t - last); last = t
      if (++n < 60) requestAnimationFrame(loop)
      else { ts.sort((a, b) => a - b); r({ avg: +(ts.reduce((a, b) => a + b) / ts.length).toFixed(1), p95: +ts[Math.floor(ts.length * 0.95)].toFixed(1) }) }
    }
    requestAnimationFrame(loop)
  }))
}
for (const [name, frac] of beats) {
  await p.evaluate((f) => window.scrollTo({ top: (document.documentElement.scrollHeight - window.innerHeight) * f, behavior: 'instant' }), frac)
  await p.waitForTimeout(2600)
  const ft = await frametime()
  const stats = await p.evaluate(() => window.useStore.getState().perfStats)
  console.log(`${name} frac=${(+frac).toFixed(3)} ft=${JSON.stringify(ft)} draws=${stats.drawCalls} tris=${stats.triangles}`)
  await p.screenshot({ path: `SVA_SCREENSHOTS/v5-${TAG}-${name}.png` })
}
console.log('ERRORS', errs.length ? JSON.stringify(errs.slice(0, 6)) : 'none')
await b.close()
