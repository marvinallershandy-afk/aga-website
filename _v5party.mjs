import { chromium } from 'playwright'
// v5-Durchfahrts-Beweis: schrittweise durch das Musik-Fenster (vor & zurück),
// Screenshot + Frametime je Fortschritts-Punkt, Audio-Gains, Preload-Timing.
const PORT = process.env.PORT || '5199'
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage()
const errs = []
p.on('pageerror', (e) => errs.push('PE:' + e.message))
await p.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 60000 })
await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, { timeout: 60000 })
await p.click('text=Mit Ton betreten')
await p.waitForTimeout(2000)

// scrollt so, dass der Durchfahrts-Fortschritt p erreicht wird
// (invertiert die pIn-Formel aus PartyDirector)
const gotoP = (target) => p.evaluate((tp) => {
  const el = document.getElementById('musik')
  const vh = window.innerHeight
  const top = vh * 1.05 - tp * (vh * 0.8) // rect.top für p
  window.scrollTo({ top: el.offsetTop - top, behavior: 'instant' })
}, target)

async function frametime(n = 50) {
  return p.evaluate((N) => new Promise((r) => {
    const ts = []; let last = performance.now(); let i = 0
    function loop(t) {
      ts.push(t - last); last = t
      if (++i < N) requestAnimationFrame(loop)
      else { ts.sort((a, b) => a - b); r({ avg: +(ts.reduce((a, b) => a + b) / ts.length).toFixed(1), p95: +ts[Math.floor(ts.length * 0.95)].toFixed(1), max: +ts[ts.length - 1].toFixed(1) }) }
    }
    requestAnimationFrame(loop)
  }), n)
}

// Preload-Beweis: weit oberhalb — partyNear muss schon true sein, Chunk laden
await p.evaluate(() => {
  const el = document.getElementById('musik')
  window.scrollTo({ top: el.offsetTop - window.innerHeight * 2.8, behavior: 'instant' })
})
await p.waitForTimeout(400)
const near = await p.evaluate(() => window.useStore.getState().partyNear)
const chunkLoaded = await p.waitForFunction(
  () => performance.getEntriesByType('resource').some((r) => r.name.includes('PartyRoom')),
  null, { timeout: 8000 },
).then(() => true).catch(() => false)
console.log('PRELOAD partyNear=', near, 'chunk-geladen=', chunkLoaded, '(2.8vh vor der Sektion)')

const stops = [0.12, 0.3, 0.44, 0.5, 0.62, 0.8, 1.0]
for (const dir of ['rein', 'raus']) {
  const seq = dir === 'rein' ? stops : [...stops].reverse()
  for (const tp of seq) {
    await gotoP(tp)
    await p.waitForTimeout(1400)
    const ft = await frametime()
    const st = await p.evaluate(() => ({
      pp: +window.useStore.getState().partyProgress.toFixed(2),
      open: window.useStore.getState().partyOpen,
      gains: window.AudioManager.debugGains(),
    }))
    console.log(`${dir} p=${tp} → progress=${st.pp} open=${st.open} ft=${JSON.stringify(ft)} gains=${JSON.stringify(st.gains)}`)
    if (dir === 'rein') await p.screenshot({ path: `SVA_SCREENSHOTS/v5-party-${String(tp).replace('.', '')}.png` })
  }
}
console.log('ERRORS', errs.length ? JSON.stringify(errs.slice(0, 6)) : 'none')
await b.close()
