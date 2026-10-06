// v21-T: Vorführung /tippen?vorfuehrung=1 durchklicken + Screenshots/Frame-Serien.
// Rein clientseitig — es gibt KEINE Netzwerk-Aufrufe an Supabase (geprüft: jede
// Anfrage an *.supabase.co wird gezählt und als Fehler gemeldet).
//   npx vite --port 5193 --strictPort
//   BASE=http://localhost:5193 OUT=./shots-v21-tipp node scripts/tippen-vorfuehrung-shots.mjs
// NUR=m,d  (Ansichten)  ·  TEIL=phasen,live,tabs (Abschnitte)
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5193'
const OUT = process.env.OUT || './shots-v21-tipp'
const NUR = (process.env.NUR || 'm,d').split(',')
const TEIL = (process.env.TEIL || 'phasen,live,tabs,elf').split(',')
fs.mkdirSync(OUT, { recursive: true })
const VIEWS = {
  m: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  d: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
}
const log = []
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })

async function seite(v, phase = 'vor', extra = '') {
  const ctx = await browser.newContext(VIEWS[v])
  let db = 0
  await ctx.route(/supabase\.co\//, (r) => {
    db++
    return r.abort()
  })
  const page = await ctx.newPage()
  const fehler = []
  page.on('pageerror', (e) => fehler.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|greenscreen|walkout/i.test(m.text()) && fehler.push(m.text().slice(0, 200)))
  await page.goto(`${BASE}/tippen?vorfuehrung=1&phase=${phase}${extra}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  return { ctx, page, fehler, db: () => db }
}
const tab = async (page, v, name) => {
  const sel = v === 'm' ? '.tp-tabs--unten a' : '.tp-tabs--oben a'
  await page.locator(sel, { hasText: name }).click()
  await page.waitForTimeout(1100)
}
// wie ein Mensch einmal durchscrollen (Lazy-Bilder, Einblendungen im Bild)
const durchscrollen = async (page) => {
  const h = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < h; y += 500) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y)
    await page.waitForTimeout(140)
  }
  await page.waitForTimeout(1600)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)
}
const ganz = async (page, datei) => {
  await durchscrollen(page)
  await page.addStyleTag({ content: '.tp-top,.tp-abgabe,.tp-steuer{position:relative!important;top:auto!important;bottom:auto!important}.tp-tabs--unten{position:relative!important}.tp-offen>.tp-match,.tp-auflblock>.tp-match,.tp-rangliste>.tp-duell,.tp-gesperrt .tp-live>.tp-live__buehne{position:relative!important;top:auto!important}' }).then((h) => page.evaluate((el) => el.setAttribute('data-shot', '1'), h))
  await page.screenshot({ path: `${OUT}/${datei}.png`, fullPage: true })
  await page.evaluate(() => document.querySelectorAll('style[data-shot]').forEach((e) => e.remove()))
}
const bild = (page, datei) => page.screenshot({ path: `${OUT}/${datei}.png` })

for (const v of NUR) {
  if (TEIL.includes('phasen')) {
    for (const phase of ['vor', 'live', 'abpfiff', 'montag']) {
      const extra = phase === 'live' ? '&minute=86' : ''
      const s = await seite(v, phase, extra)
      await s.page.waitForTimeout(phase === 'abpfiff' || phase === 'montag' ? 6500 : 800)
      await bild(s.page, `${phase}-oben-${v}`)
      await ganz(s.page, `${phase}-ganz-${v}`)
      log.push(`[${v}] ${phase}: Fehler ${s.fehler.length}, DB-Aufrufe ${s.db()} ${s.fehler.slice(0, 2).join(' | ')}`)
      await s.ctx.close()
    }
  }
  if (TEIL.includes('tabs')) {
    for (const phase of ['vor', 'montag']) {
      const s = await seite(v, phase)
      for (const t of ['Rangliste', 'Ligen', 'Profil']) {
        await tab(s.page, v, t)
        await s.page.waitForTimeout(1200)
        await bild(s.page, `tab-${phase}-${t.toLowerCase()}-${v}`)
        await ganz(s.page, `tab-${phase}-${t.toLowerCase()}-ganz-${v}`)
      }
      // Liga-Detail
      await s.page.locator('.tp-ligazeile').first().click().catch(() => {})
      await s.page.waitForTimeout(900)
      await bild(s.page, `liga-detail-${phase}-${v}`)
      log.push(`[${v}] Tabs ${phase}: Fehler ${s.fehler.length}, DB ${s.db()}`)
      await s.ctx.close()
    }
  }
  if (TEIL.includes('live')) {
    // Frame-Serie: Live vom Anpfiff, nächstes Ereignis für Ereignis
    const s = await seite(v, 'live', '&minute=1')
    let n = 0
    const naechstes = s.page.getByRole('button', { name: /Nächstes Ereignis/ })
    for (let i = 0; i < 12; i++) {
      await naechstes.click().catch(() => {})
      await s.page.waitForTimeout(350)
      await bild(s.page, `live-serie-${v}-${String(n++).padStart(2, '0')}a`)
      await s.page.waitForTimeout(900)
      // Rangliste im Blick
      await s.page.locator('.tp-rang--live').scrollIntoViewIfNeeded().catch(() => {})
      await bild(s.page, `live-serie-${v}-${String(n - 1).padStart(2, '0')}b-rang`)
      await s.page.evaluate(() => window.scrollTo(0, 0))
      if (/phase=abpfiff/.test(s.page.url())) break
    }
    log.push(`[${v}] Live-Serie: ${n} Ereignisse, Fehler ${s.fehler.length}, DB ${s.db()}`)
    await s.ctx.close()
  }
  if (TEIL.includes('elf')) {
    const s = await seite(v, 'vor')
    await s.page.locator('.tp-elf').scrollIntoViewIfNeeded()
    await s.page.waitForTimeout(600)
    await bild(s.page, `elf-${v}`)
    // ANG-Platz leeren und neu wählen → Auswahl mit Zweitposition + nicht verfügbar
    const ang = s.page.locator('.tp-platz__reihe').first().locator('.sk').first()
    await ang.click().catch(() => {})
    await s.page.waitForTimeout(900)
    await bild(s.page, `elf-aktion-${v}`)
    await s.page.getByRole('button', { name: 'Austauschen' }).click().catch(() => {})
    await s.page.waitForTimeout(800)
    await bild(s.page, `elf-auswahl-ang-${v}`)
    await s.page.locator('.al-sheet__body').evaluate((el) => (el.parentElement.parentElement.scrollTop = 9999)).catch(() => {})
    await s.page.waitForTimeout(400)
    await bild(s.page, `elf-auswahl-ang-unten-${v}`)
    await s.page.keyboard.press('Escape')
    // Kapitän wechseln
    await s.page.locator('.tp-binde-knopf').nth(1).click().catch(() => {})
    await s.page.waitForTimeout(600)
    await s.page.locator('.tp-elf').scrollIntoViewIfNeeded()
    await bild(s.page, `elf-kapitaen-${v}`)
    // abgeben
    await s.page.getByRole('button', { name: /Tipp abgeben|Änderungen speichern/ }).click().catch(() => {})
    await s.page.waitForTimeout(1600)
    await bild(s.page, `belohnung-${v}`)
    log.push(`[${v}] Elf: Fehler ${s.fehler.length}, DB ${s.db()}`)
    await s.ctx.close()
  }
}
await browser.close()
fs.writeFileSync(`${OUT}/_vorfuehrung.txt`, log.join('\n'))
console.log(log.join('\n'))
