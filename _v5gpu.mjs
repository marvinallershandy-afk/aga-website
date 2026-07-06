import { chromium } from 'playwright'
// Echt-GPU-Frametimes (ohne SwiftShader): Stationen + Durchfahrts-Fenster.
// Am Netzteil ausführen! (v4-Fußnote: Batterie drosselt.)
const PORT = process.env.PORT || '5199'
const b = await chromium.launch({ headless: false, args: ['--hide-scrollbars', '--window-position=40,40'] })
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage()
await p.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 60000 })
await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, { timeout: 60000 })
await p.click('text=Lieber leise')
await p.waitForTimeout(2500)

const gotoP = (target) => p.evaluate((tp) => {
  const el = document.getElementById('musik')
  const vh = window.innerHeight
  window.scrollTo({ top: el.offsetTop - (vh * 1.9 - tp * vh * 1.6), behavior: 'instant' })
}, target)

async function frametime(n = 120) {
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
  const cv = document.createElement('canvas')
  const gl = cv.getContext('webgl2')
  const ext = gl?.getExtension('WEBGL_debug_renderer_info')
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unbekannt'
})
console.log('GPU:', gpu)

// Stationen
const centers = await p.evaluate(() => {
  const max = document.documentElement.scrollHeight - innerHeight
  const at = (id) => {
    const el = document.getElementById(id)
    return Math.max(0, Math.min(1, (el.offsetTop + el.offsetHeight / 2 - innerHeight / 2) / max))
  }
  return { hero: 0, beat: at('anstoss') * 0.82, team: at('mannschaft'), tabelle: at('tabelle'), finale: 1 }
})
for (const [name, frac] of Object.entries(centers)) {
  await p.evaluate((f) => window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * f, behavior: 'instant' }), frac)
  await p.waitForTimeout(1800)
  console.log('station', name, JSON.stringify(await frametime()))
}
// Durchfahrts-Fenster
for (const tp of [0.2, 0.35, 0.44, 0.5, 0.7, 1.0]) {
  await gotoP(tp)
  await p.waitForTimeout(1400)
  console.log('durchfahrt p=' + tp, JSON.stringify(await frametime()))
}
await b.close()
