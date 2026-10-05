// v15-L: Live-Seite /live headless durchklicken + screenshotten (mobil + desktop)
// in allen Zuständen. web_live() wird gemockt (scripts/live-fixtures.mjs) —
// KEIN Zugriff auf die echte Datenbank. fussball.de wird geblockt.
//   npx vite --port 5186 --strictPort   (vorher starten)
//   BASE=http://localhost:5186 node scripts/live-audit.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
import { liveFixture } from './live-fixtures.mjs'

const BASE = process.env.BASE || 'http://localhost:5186'
const OUT = process.env.OUT || './shots-live/live'
fs.mkdirSync(OUT, { recursive: true })
const errors = []
const checks = []
const check = (ok, msg) => checks.push(`${ok ? 'OK ' : 'FEHLER'}  ${msg}`)

const VIEWS = [
  ['mobil', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
]
const STATES = (process.env.STATES || 'vorher,live,halbzeit,beendet,keins').split(',')

const browser = await chromium.launch()
for (const [vname, vopts] of VIEWS) {
  for (const state of STATES) {
    const ctx = await browser.newContext(vopts)
    let rpcCalls = 0
    const external = []
    await ctx.route('**/rest/v1/rpc/web_live', (r) => {
      rpcCalls++
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(liveFixture(state)) })
    })
    await ctx.route('https://www.fussball.de/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body style="font:16px system-ui;padding:20px">[fussball.de-Widget — im Test geblockt]</body></html>' }))
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[${vname}/${state}] pageerror ${e.message}`))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${vname}/${state}] console ${m.text().slice(0, 200)}`) })
    page.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:')) external.push(u) })
    const t0 = Date.now()
    await page.goto(`${BASE}/live`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.lv-hero', { timeout: 15000 })
    await page.waitForTimeout(700)
    if (vname === 'mobil' && state === 'live') checks.push(`INFO  /live bereit nach ${Date.now() - t0} ms (Dev-Server, unminifiziert)`)
    await page.screenshot({ path: `${OUT}/${vname}-${state}-1-kopf.png`, fullPage: vname === 'desktop' })
    const three = await page.evaluate(() => performance.getEntriesByType('resource').some((r) => /three|Stage|@react-three/.test(r.name)))
    check(!three, `[${vname}/${state}] kein three.js geladen`)
    check(rpcCalls >= 1, `[${vname}/${state}] web_live abgefragt (${rpcCalls}×)`)
    check(external.every((u) => /supabase\.co\/rest\/v1\/rpc\/web_live/.test(u)), `[${vname}/${state}] keine fremden Requests vor Klick (${external.filter((u) => !/web_live/.test(u)).length})`)
    if (vname === 'mobil' && state !== 'keins') {
      await page.mouse.wheel(0, 500)
      await page.waitForTimeout(300)
      await page.screenshot({ path: `${OUT}/${vname}-${state}-2-ticker.png` })
      await page.getByRole('button', { name: 'Aufstellung', exact: true }).click()
      await page.waitForTimeout(400)
      await page.screenshot({ path: `${OUT}/${vname}-${state}-3-aufstellung.png` })
      await page.getByRole('button', { name: 'Tabelle', exact: true }).click()
      await page.waitForTimeout(300)
      await page.screenshot({ path: `${OUT}/${vname}-${state}-4-tabelle.png` })
      if (state === 'live') {
        await page.getByRole('button', { name: /Aktuelle Tabelle von fussball.de laden/ }).click()
        await page.waitForTimeout(600)
        const fde = external.some((u) => u.includes('fussball.de/widget2/-/schluessel/'))
        check(fde, `[${vname}/${state}] fussball.de-Widget erst nach Klick geladen`)
        await page.screenshot({ path: `${OUT}/${vname}-${state}-5-tabelle-geladen.png` })
      }
    }
    if (state === 'live') {
      const txt = await page.locator('.lv-hero').innerText()
      check(/2\s*:\s*1/.test(txt) && /LIVE/.test(txt), `[${vname}] Kopf zeigt LIVE 2:1 (${txt.replace(/\s+/g, ' ').slice(0, 80)})`)
    }
    await ctx.close()
  }
}
await browser.close()
console.log(checks.join('\n'))
console.log('\n--- FEHLER ---\n' + (errors.length ? [...new Set(errors)].join('\n') : 'keine'))
console.log('FERTIG →', OUT)
