import { chromium } from 'playwright'
// Gate-3-Frametime-Tabelle: echte GPU (headed), am Netzteil ausführen.
// Baseline (alles aus) → je Effekt solo → volle Kette (full) → reduced.
// Messpunkte: 'team' (meiste Draws) und Partyraum-Totale (DoF-Moment).
const PORT = process.env.PORT || '5199'
const b = await chromium.launch({ headless: false, args: ['--hide-scrollbars', '--window-position=40,40'] })
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage()
await p.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 60000 })
await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, { timeout: 60000 })
await p.click('text=Lieber leise')
await p.waitForTimeout(2500)

const FX = ['bloom', 'grade', 'vignette', 'grain', 'ca', 'mist', 'letterbox']
const setOnly = (keys) => p.evaluate(({ keys, FX }) => {
  const st = window.useStore.getState()
  st.setCinemaTier('full')
  for (const k of FX) st.setFx(k, keys.includes(k))
}, { keys, FX })

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

const gotoTeam = () => p.evaluate(() => {
  const el = document.getElementById('mannschaft')
  window.scrollTo({ top: el.offsetTop + el.offsetHeight / 2 - innerHeight / 2, behavior: 'instant' })
})
const gotoRoom = () => p.evaluate(() => {
  const el = document.getElementById('musik')
  window.scrollTo({ top: el.offsetTop + el.offsetHeight / 2 - innerHeight / 2, behavior: 'instant' })
})

console.log('— Messpunkt TEAM —')
await gotoTeam(); await p.waitForTimeout(1800)
await setOnly([]); await p.waitForTimeout(800)
console.log('baseline(nur ACES)', JSON.stringify(await frametime()))
for (const k of ['bloom', 'grade', 'vignette', 'grain', 'ca', 'mist']) {
  await setOnly([k]); await p.waitForTimeout(800)
  console.log('solo:' + k, JSON.stringify(await frametime()))
}
await setOnly(FX); await p.waitForTimeout(800)
console.log('full-kette', JSON.stringify(await frametime()))
await p.evaluate(() => window.useStore.getState().setCinemaTier('reduced')); await p.waitForTimeout(800)
console.log('reduced-kette', JSON.stringify(await frametime()))

console.log('— Messpunkt RAUM —')
await gotoRoom(); await p.waitForTimeout(2200)
await setOnly([]); await p.waitForTimeout(800)
console.log('baseline', JSON.stringify(await frametime()))
await setOnly(FX); await p.waitForTimeout(800)
console.log('full-kette', JSON.stringify(await frametime()))
await b.close()
