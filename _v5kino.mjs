import { chromium } from 'playwright'
// Gate-3-Bildpaare: je Station einmal MIT kompletter Kino-Ebene (full)
// und einmal OHNE (alle Effekte aus) → v5-kino-<station>-{mit,ohne}.png
const PORT = process.env.PORT || '5199'
// Echte GPU (headed): SwiftShader schafft die volle Kette nicht.
const b = await chromium.launch({ headless: false, args: ['--hide-scrollbars', '--window-position=40,40'] })
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage()
const errs = []
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
p.on('pageerror', (e) => errs.push('PE:' + e.message))
await p.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 60000 })
await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, { timeout: 60000 })
await p.click('text=Lieber leise')
await p.waitForTimeout(2000)

const centers = await p.evaluate(() => {
  const max = document.documentElement.scrollHeight - innerHeight
  const at = (id) => {
    const el = document.getElementById(id)
    return Math.max(0, Math.min(1, (el.offsetTop + el.offsetHeight / 2 - innerHeight / 2) / max))
  }
  return { beat: at('anstoss') * 0.82, team: at('mannschaft'), tabelle: at('tabelle'), finale: 1 }
})

const setChain = (on) => p.evaluate((v) => {
  const st = window.useStore.getState()
  st.setCinemaTier('full')
  for (const k of ['bloom', 'grade', 'vignette', 'grain', 'ca', 'mist', 'letterbox']) st.setFx(k, v)
}, on)

for (const [name, frac] of Object.entries(centers)) {
  await p.evaluate((f) => window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * f, behavior: 'instant' }), frac)
  for (const on of [true, false]) {
    await setChain(on)
    await p.waitForTimeout(2400)
    await p.screenshot({ path: `SVA_SCREENSHOTS/v5-kino-${name}-${on ? 'mit' : 'ohne'}.png` })
  }
  await setChain(true)
  console.log('paar', name)
}
// Partyraum-Totale (DoF-Moment)
await p.evaluate(() => {
  const el = document.getElementById('musik')
  window.scrollTo({ top: el.offsetTop + el.offsetHeight / 2 - innerHeight / 2, behavior: 'instant' })
})
for (const on of [true, false]) {
  await setChain(on)
  await p.waitForTimeout(2600)
  await p.screenshot({ path: `SVA_SCREENSHOTS/v5-kino-raum-${on ? 'mit' : 'ohne'}.png` })
}
console.log('ERRORS', errs.length ? JSON.stringify(errs.slice(0, 6)) : 'none')
await b.close()
