// v15-L: Spieltag-Leiste im Onepager prüfen (Screenshots + Request-Zählung).
// Schreibt dafür VORÜBERGEHEND das Build-Overlay (src/data/generated/…) mit
// einem nächsten Spiel — und stellt es am Ende wieder her. web_live gemockt.
//   BASE=http://localhost:5186 node scripts/matchday-bar-audit.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
import { liveFixture } from './live-fixtures.mjs'

const BASE = process.env.BASE || 'http://localhost:5186'
const OUT = process.env.OUT || './shots-live/onepager'
const FILE = 'src/data/generated/website-content.generated.ts'
fs.mkdirSync(OUT, { recursive: true })
const original = fs.readFileSync(FILE, 'utf8')
const checks = []
const errors = []

function overlay(kickoffIso) {
  const nm = { opponent: 'TuS Fischbek', date: 'Sonntag', home: true, kickoff: kickoffIso }
  return `import type { WebsiteContentOverlay } from '../content-overlay'\nexport const WEBSITE_CONTENT_OVERLAY: WebsiteContentOverlay | null = ${JSON.stringify({ source: 'db', generatedAt: new Date().toISOString(), nextMatch: nm })}\n`
}

const FAELLE = [
  ['ausserhalb', Date.now() + 5 * 864e5, 'keins', false, false],
  ['vorher', Date.now() + 20 * 3600e3, 'vorher', true, false],
  ['live', Date.now() - 69 * 60e3, 'live', true, true],
]
const VIEWS = [
  ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
  ['mobil', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
]

const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
try {
  for (const [fall, kickoff, state, sichtbar, requests] of FAELLE) {
    fs.writeFileSync(FILE, overlay(new Date(kickoff).toISOString()))
    await new Promise((r) => setTimeout(r, 1200))
    for (const [vname, vopts] of VIEWS) {
      if (fall === 'ausserhalb' && vname === 'mobil') continue
      const ctx = await browser.newContext(vopts)
      let rpc = 0
      const extern = []
      await ctx.route('**/rest/v1/rpc/web_live', (r) => {
        rpc++
        const fx = liveFixture(state)
        return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(fx) })
      })
      const page = await ctx.newPage()
      page.on('pageerror', (e) => errors.push(`[${fall}/${vname}] ${e.message}`))
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${fall}/${vname}] console ${m.text().slice(0, 160)}`) })
      page.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) extern.push(u) })
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
      await page.locator('[data-testid=gate]').waitFor({ state: 'detached', timeout: 90000 }).catch(() => {})
      await page.waitForTimeout(2500)
      const bar = await page.locator('a.mday').count()
      checks.push(`${(bar > 0) === sichtbar ? 'OK ' : 'FEHLER'}  [${fall}/${vname}] Leiste ${sichtbar ? 'sichtbar' : 'nicht da'}${bar ? ': ' + (await page.locator('a.mday').innerText()).replace(/\s+/g, ' ') : ''}`)
      checks.push(`${(rpc > 0) === requests ? 'OK ' : 'FEHLER'}  [${fall}/${vname}] web_live-Abrufe: ${rpc} · externe Requests: ${extern.length}`)
      await page.screenshot({ path: `${OUT}/${vname}-${fall}.png` })
      if (fall === 'live' && vname === 'desktop') {
        // LED-Tafel an der Tabelle-Station
        await page.evaluate(() => { const el = document.getElementById('tabelle'); if (el) window.scrollTo(0, el.offsetTop + el.offsetHeight / 2 - innerHeight / 2) })
        await page.waitForTimeout(3500)
        await page.screenshot({ path: `${OUT}/${vname}-live-led-tafel.png` })
      }
      await ctx.close()
    }
  }
} finally {
  fs.writeFileSync(FILE, original)
  await browser.close()
}
console.log(checks.join('\n'))
console.log('\n--- FEHLER ---\n' + (errors.length ? [...new Set(errors)].join('\n') : 'keine'))
