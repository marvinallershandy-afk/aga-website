import { chromium } from 'playwright'
// v9-E6: Fans (nah) + Tor-Netz nach Rahmen-Streben-Politur. Der Blick
// aufs Tor entsteht über den Anstoß-Sturzflug (Ball rollt Richtung
// Ost-Tor). Wir sampeln mehrere Scroll-Anteile und behalten alle.
const PORT = process.env.PORT || '5199'
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage()
const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 60000 })
await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, { timeout: 60000 }).catch(() => {})
await p.click('text=Lieber leise').catch(() => {})
await p.waitForTimeout(1500)

// Fanblock nah
await p.evaluate(() => document.getElementById('fanblock')?.scrollIntoView({ block: 'center', behavior: 'instant' }))
await p.waitForTimeout(2200)
await p.screenshot({ path: 'SVA_SCREENSHOTS/e6-fanblock-desktop.png' })

// Tor-Blick: mehrere Scroll-Anteile durch den Sturzflug sampeln
const ratios = [0.03, 0.06, 0.09, 0.12, 0.16]
for (const r of ratios) {
  await p.evaluate((rr) => {
    const doc = document.documentElement
    const max = doc.scrollHeight - window.innerHeight
    window.scrollTo({ top: max * rr, behavior: 'instant' })
  }, r)
  await p.waitForTimeout(1400)
  await p.screenshot({ path: `SVA_SCREENSHOTS/e6-tor-${String(r).replace('.', '')}.png` })
}
console.log('desktop', errs.length ? JSON.stringify(errs.slice(0, 3)) : 'ok')

// Fanblock mobil
const pm = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' })).newPage()
await pm.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 60000 })
await pm.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, { timeout: 60000 }).catch(() => {})
await pm.click('text=Lieber leise').catch(() => {})
await pm.waitForTimeout(1500)
await pm.evaluate(() => document.getElementById('fanblock')?.scrollIntoView({ block: 'center', behavior: 'instant' }))
await pm.waitForTimeout(2200)
await pm.screenshot({ path: 'SVA_SCREENSHOTS/e6-fanblock-mobile.png' })
console.log('mobile ok')
await b.close()
