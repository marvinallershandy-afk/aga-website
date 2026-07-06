import { chromium } from 'playwright'
// E6 Echt-GPU-Frametimes (ohne SwiftShader). Am Netzteil ausführen!
const PORT = process.env.PORT || '5199'
const b = await chromium.launch({ headless: false, args: ['--hide-scrollbars', '--window-position=40,40'] })
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage()
await p.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 60000 })
await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, { timeout: 60000 })
await p.click('text=Lieber leise')
await p.waitForTimeout(2500)

async function frametime(n = 140) {
  return p.evaluate((N) => new Promise((r) => {
    const ts = []; let last = performance.now(); let i = 0
    function loop(t) {
      ts.push(t - last); last = t
      if (++i < N) requestAnimationFrame(loop)
      else { ts.sort((a, b) => a - b); r({ avg: +(ts.reduce((a, b) => a + b) / ts.length).toFixed(2), p95: +ts[Math.floor(ts.length * 0.95)].toFixed(2) }) }
    }
    requestAnimationFrame(loop)
  }), n)
}
const gpu = await p.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2')
  const ext = gl?.getExtension('WEBGL_debug_renderer_info')
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unbekannt'
})
console.log('GPU:', gpu)

const frac = (id) => p.evaluate((s) => {
  const el = document.getElementById(s); const max = document.documentElement.scrollHeight - innerHeight
  return Math.max(0, Math.min(1, (el.offsetTop + el.offsetHeight / 2 - innerHeight / 2) / max))
}, id)
const stations = { hero: 0, mannschaft: await frac('mannschaft'), tabelle: await frac('tabelle'), finale: 1 }
for (const [name, f] of Object.entries(stations)) {
  await p.evaluate((ff) => window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * ff, behavior: 'instant' }), f)
  await p.waitForTimeout(1800)
  console.log('station', name, JSON.stringify(await frametime()))
}
// Party-Durchfahrt (v8-Formel: scrollY = offsetTop - 0.95vh + p*1.15vh)
for (const tp of [0.2, 0.4, 0.46, 0.6, 1.0]) {
  await p.evaluate((t) => { const el = document.getElementById('musik'); const vh = innerHeight; window.scrollTo({ top: el.offsetTop - vh * 0.95 + t * vh * 1.15, behavior: 'instant' }) }, tp)
  await p.waitForTimeout(1400)
  console.log('durchfahrt p=' + tp, JSON.stringify(await frametime()))
}
await b.close()
