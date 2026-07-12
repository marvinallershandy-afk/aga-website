// Temporäres Review-Screenshot-Skript (v12). Ändert NICHTS am Website-Code —
// nur laden, scrollen, screenshotten.
//
// Wichtig: Der 3D-Onepager ist scroll-GETRIEBEN mit einer cinematischen Kamera,
// deren RUHEPUNKTE (komponierte Stationen) NICHT auf glatten 0/10/20-%-Marken
// liegen, sondern an den (zur Laufzeit gemessenen) Sektions-Zentren. Ein starrer
// 0–100%-Sweep landet daher teils in dunklen Kamera-Übergängen. Für ein
// HOCHWERTIGES Review fahren wir deshalb die echten Stationen an (= genau der
// Scroll-Verlauf, den der Nutzer sieht), jede voll komponiert im Bild.
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5173/'
const OUT = './screenshots-review'

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

// Reihenfolge = Scroll-Verlauf der Reise.
const STATIONS = ['verein', 'mannschaft', 'fanblock', 'musik', 'tabelle', 'sponsoren', 'kontakt']

async function dismissGate(page) {
  try { await page.locator('button:not([disabled])', { hasText: /leise/i }).click({ timeout: 20000 }) } catch {}
  try { await page.waitForSelector('[data-testid="gate"]', { state: 'detached', timeout: 12000 }) } catch {}
  await page.waitForTimeout(1200)
}

// Zentriert eine Sektion im Viewport = der komponierte Snap-/Kamera-Punkt.
async function centerOn(page, id) {
  await page.evaluate((sid) => {
    const el = document.getElementById(sid)
    const top = el.offsetTop + el.offsetHeight / 2 - window.innerHeight / 2
    window.scrollTo(0, Math.round(top))
  }, id)
  await page.waitForTimeout(2200) // R3F-Kamera-Damping einschwingen lassen
}

async function run(label, viewport, extras) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext(viewport)
  await ctx.addInitScript(() => { try { localStorage.setItem('sva-sound', 'off') } catch {} })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await dismissGate(page)

  let n = 0
  const shot = async (station) => {
    const name = `${label}-${String(n).padStart(2, '0')}.png`
    await page.screenshot({ path: `${OUT}/${name}` })
    console.log(`${name}  ${station}`)
    n++
  }

  for (const id of STATIONS) {
    await centerOn(page, id)
    await shot(id)
    // Desktop-Extra: an der Sponsoren-Station die Bande-Kamera einmal weiterfahren
    if (extras && id === 'sponsoren') {
      await page.evaluate(() => {
        const a = [...document.querySelectorAll('.band-nav__arrow')].pop()
        a && a.click(); a && a.click()
      })
      await page.waitForTimeout(1800)
      await shot('sponsoren (Bande weitergefahren)')
    }
  }

  // Finale: kompletter Maps-Rauszoom ganz unten (braucht längeres Einschwingen)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(2800)
  await shot('finale (Maps-Rauszoom)')

  await browser.close()
}

// Desktop: 7 Stationen + Bande-Pan + Finale = 9 Bilder
await run('desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }, true)
// Mobil: 7 Stationen + Finale = 8 Bilder
await run('mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true }, false)

console.log('FERTIG →', OUT)
