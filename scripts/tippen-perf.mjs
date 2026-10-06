// v21-T: Bildrate /tippen am Handy-Profil (390×844, 4× CPU-Drosselung wie ein Mittelklasse-Handy).
// Misst requestAnimationFrame-Abstände in der Vorführung: Live (Minute läuft ×3, Ereignisse,
// Ranglisten-Animation), Scrollen durch Spieltag, Tab-Wechsel per Wischen, Auflösung zählt hoch.
//   BASE=http://localhost:5193 node scripts/tippen-perf.mjs   (Vite oder vite preview)
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:5193'
const CPU = Number(process.env.CPU || 4)
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await ctx.addInitScript(() => { try { localStorage.setItem('sva-tipp-einfuehrung-vorfuehrung', '1') } catch { /* */ } })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })

const messen = (ms) =>
  page.evaluate(
    (dauer) =>
      new Promise((ok) => {
        const t = []
        let letzte = performance.now()
        const ende = letzte + dauer
        const f = (n) => {
          t.push(n - letzte)
          letzte = n
          if (n < ende) requestAnimationFrame(f)
          else {
            t.sort((a, b) => a - b)
            const mittel = t.reduce((a, b) => a + b, 0) / t.length
            ok({ fps: Math.round(1000 / mittel), p95: Math.round(t[Math.floor(t.length * 0.95)]), lang: t.filter((x) => x > 34).length, n: t.length })
          }
        }
        requestAnimationFrame(f)
      }),
    ms,
  )

const ergebnis = []
// 1) Live, Minute läuft im Tempo ×3, mit Ereignissen
await page.goto(`${BASE}/tippen?vorfuehrung=1&phase=live`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.getByRole('button', { name: 'Tempo' }).click()
ergebnis.push(['Live läuft (×3, Ereignisse, Rangliste)', await messen(6000)])
// 2) Scrollen im Live-Bereich
const scroll = page.evaluate(async () => {
  for (let i = 0; i < 40; i++) {
    window.scrollBy(0, 60)
    await new Promise((r) => requestAnimationFrame(r))
  }
})
ergebnis.push(['Scrollen (Live)', await messen(2500)])
await scroll
// 3) Vor Anpfiff: Spieltag scrollen über die Elf (5 Sammelkarten)
await page.goto(`${BASE}/tippen?vorfuehrung=1&phase=vor`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const s2 = page.evaluate(async () => {
  for (let i = 0; i < 80; i++) {
    window.scrollBy(0, 40)
    await new Promise((r) => requestAnimationFrame(r))
  }
})
ergebnis.push(['Scrollen (Tippschein + Elf)', await messen(3000)])
await s2
// 4) Tab-Wechsel (gerichtetes Einblenden)
const wechsel = (async () => {
  for (const t of ['Rangliste', 'Ligen', 'Profil', 'Spieltag', 'Rangliste']) {
    await page.locator('.tp-tabs--unten a', { hasText: t }).click()
    await page.waitForTimeout(450)
  }
})()
ergebnis.push(['Tab-Wechsel', await messen(2500)])
await wechsel
// 5) Auflösung zählt hoch
await page.goto(`${BASE}/tippen?vorfuehrung=1&phase=abpfiff`, { waitUntil: 'networkidle' })
ergebnis.push(['Auflösung zählt hoch', await messen(4000)])

for (const [n, e] of ergebnis) console.log(`${n.padEnd(40)} ${e.fps} fps · p95 ${e.p95} ms · ${e.lang} lange Frames (>34 ms) von ${e.n}`)
await browser.close()
