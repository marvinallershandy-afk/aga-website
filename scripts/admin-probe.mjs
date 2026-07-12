// Minimal-Probe: /admin ohne Interception laden, Fehler + fehlgeschlagene Requests loggen.
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 400)) })
page.on('requestfailed', (r) => console.log('REQFAILED:', r.url(), '→', r.failure()?.errorText))
page.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()) })

await page.goto('http://localhost:5199/admin/?preview', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
await page.screenshot({ path: './screenshots-review/admin-audit/probe.png' })
console.log('BODY-TEXT:', (await page.textContent('body'))?.slice(0, 300))
await browser.close()
