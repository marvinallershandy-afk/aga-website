// v22-A: Bildraten am Handy-Profil (390×844, DPR 2, 4× CPU-Drossel, Metal-GPU).
//   Album-Vorführung: Shiny-Reveal, Gold-Walkout, Shiny-Vitrine, Kartenlabor scrollen.
//   Startseite (3D): Leerlauf + Scroll in den Rundgang (für alt/neu-Vergleich: START_BASE).
//   BASE=http://localhost:5197 [START_BASE=http://localhost:5199] node scripts/album-v22-perf.mjs
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:5197'
const START_BASE = (process.env.START_BASE || '').split(',').filter(Boolean)
const CPU = Number(process.env.CPU || 4)
const TEIL = process.env.TEIL || 'album,start'
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })

async function seite() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await ctx.addInitScript(() => { try { localStorage.setItem('sva-album-einfuehrung', '1') } catch { /* */ } })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  return { ctx, page }
}
const messen = (page, ms) =>
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
            ok({ fps: Math.round(1000 / mittel), p50: +t[Math.floor(t.length * 0.5)].toFixed(1), p95: +t[Math.floor(t.length * 0.95)].toFixed(1), lang: t.filter((x) => x > 34).length, n: t.length, max: Math.round(t[t.length - 1]) })
          }
        }
        requestAnimationFrame(f)
      }),
    ms,
  )
const ergebnis = []
if (TEIL.includes('album')) {
  const { ctx, page } = await seite()
  await page.goto(`${BASE}/album?vorfuehrung=1`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.locator('.al-cover').click()
  await page.waitForTimeout(1500)
  ergebnis.push(['Album Leerlauf (Startseite)', await messen(page, 3000)])
  // Pack 1: Gold-Walkout (dritte Karte)
  await page.locator('.al-tuete-badge, .al-fach').first().click()
  await page.waitForSelector('.po-tuete:not(.is-laden)')
  await page.locator('.po__auf').click()
  await page.waitForTimeout(1200)
  for (let i = 0; i < 2; i++) {
    await page.locator('.po__weiter').click()
    await page.waitForTimeout(250)
    await page.locator('.po__weiter').click()
    await page.waitForTimeout(250)
  }
  ergebnis.push(['Gold-Walkout (Reveal 4 s)', await messen(page, 4500)])
  while (!(await page.locator('.po__buehne--ende').count())) { await page.locator('.po__weiter').click(); await page.waitForTimeout(400) }
  await page.locator('.po__aktionen .al-btn').first().click()
  await page.waitForTimeout(1500)
  // Pack 2: Shiny (öffnet sich direkt nach Pack 1)
  if (!(await page.locator('.po').count())) await page.locator('.al-tuete-badge, .al-fach').first().click()
  await page.waitForSelector('.po-tuete:not(.is-laden)')
  await page.locator('.po__auf').click()
  await page.waitForTimeout(1150)
  ergebnis.push(['Shiny-Reveal (Stille, Staub, Schweben, Stempel)', await messen(page, 6500)])
  ergebnis.push(['Shiny aufgedeckt (Schimmer, Sterne, Holo)', await messen(page, 3000)])
  while (!(await page.locator('.po__buehne--ende').count())) { await page.locator('.po__weiter').click(); await page.waitForTimeout(400) }
  await page.locator('.po__aktionen .al-btn').first().click()
  await page.waitForTimeout(6000)
  await page.locator('.hf-reiter__b').filter({ hasText: 'Shiny' }).first().click()
  await page.waitForTimeout(1500)
  const sc = page.evaluate(async () => { for (let i = 0; i < 60; i++) { window.scrollBy(0, 40); await new Promise((r) => requestAnimationFrame(r)) } })
  ergebnis.push(['Shiny-Vitrine scrollen', await messen(page, 2500)])
  await sc
  // Kartenlabor (95 Karten) scrollen
  await page.locator('.vf-leiste__knopf').click()
  await page.locator('.vf-leiste__panel button').filter({ hasText: 'Kartenlabor' }).click()
  await page.waitForTimeout(1500)
  const sl = page.evaluate(async () => { const el = document.querySelector('.kl--vollbild'); for (let i = 0; i < 90; i++) { el.scrollBy(0, 50); await new Promise((r) => requestAnimationFrame(r)) } })
  ergebnis.push(['Kartenlabor scrollen (95 Karten)', await messen(page, 3000)])
  await sl
  await ctx.close()
}
if (TEIL.includes('start')) {
  for (const base of [BASE, ...START_BASE]) {
    const { ctx, page } = await seite()
    await page.goto(`${base}/`, { waitUntil: 'load' })
    await page.waitForTimeout(7000)
    ergebnis.push([`Startseite 3D Leerlauf · ${base}`, await messen(page, 5000)])
    const sc = page.evaluate(async () => { for (let i = 0; i < 70; i++) { window.scrollBy(0, 30); await new Promise((r) => requestAnimationFrame(r)) } })
    ergebnis.push([`Startseite → Rundgang scrollen · ${base}`, await messen(page, 3000)])
    await sc
    await ctx.close()
  }
}
await browser.close()
for (const [n, r] of ergebnis) console.log(`${n.padEnd(62)} ${String(r.fps).padStart(3)} fps · p50 ${r.p50} ms · p95 ${r.p95} ms · >34 ms: ${r.lang}/${r.n} · max ${r.max} ms`)
