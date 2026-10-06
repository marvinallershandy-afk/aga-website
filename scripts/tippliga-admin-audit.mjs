// v20-T: Admin „Tipp-Liga“ headless durchklicken + screenshotten (Handy 390×844 + Desktop 1440×900).
// KEINE echte Datenbank: tipp_admin_*-RPCs + sva_tipp_einstellungen gemockt
// (scripts/tippen-fixtures.mjs), Admin/Team über den DEV-?preview-Bypass.
//   VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 5193 --strictPort
//   BASE=http://localhost:5193 OUT=./shots-v20-tipp node scripts/tippliga-admin-audit.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
import { STORY, TEILNEHMER, adminSpieltage, berichtFixture } from './tippen-fixtures.mjs'

const BASE = process.env.BASE || 'http://localhost:5193'
const OUT = process.env.OUT || './shots-v20-tipp'
fs.mkdirSync(OUT, { recursive: true })
const checks = []
const errors = []
const check = (ok, msg) => checks.push(`${ok ? 'OK ' : 'FEHLER'}  ${msg}`)
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) })
const EINST = { id: 1, aktiv: true, partner_id: 's1', preise: 'Spieltagssieger: Döner bei Mr. Döner', story_code: 'AGA-SA7', elf_frei: true, winter_von: '11-15', winter_bis: '03-14' }
const SPONSOREN = [{ id: 's1', name: 'Mr. Döner', aktiv: true, logo_url: null, sortierung: 0 }, { id: 's2', name: 'Altstadtcafé', aktiv: true, logo_url: null, sortierung: 1 }]

const browser = await chromium.launch({ args: process.env.OHNE_GPU ? [] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
async function seite(label, v, rolle = 'admin') {
  const log = []
  const ctx = await browser.newContext(v === 'm' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } })
  await ctx.route('**/rest/v1/**', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    const pfad = u.pathname.split('/rest/v1/')[1]
    let args = {}
    try { args = req.postDataJSON() ?? {} } catch { /* leer */ }
    if (pfad.startsWith('rpc/')) {
      const n = pfad.slice(4)
      log.push([n, args])
      if (n === 'sva_meine_rolle') return json(route, rolle)
      if (n === 'tipp_admin_spieltage') return json(route, adminSpieltage())
      if (n === 'tipp_admin_bericht') return json(route, berichtFixture())
      if (n === 'tipp_admin_bericht_speichern') return json(route, { ok: true, zeilen: args.p_zeilen?.length ?? 0 })
      if (n === 'tipp_admin_werten') return json(route, { ok: true, teilnehmer: 52, schnitt: 21.4, max: 52, exakt: 6 })
      if (n === 'tipp_admin_spieltag_speichern') return json(route, { ok: true })
      if (n === 'tipp_admin_story') return json(route, STORY)
      if (n === 'tipp_admin_teilnehmer') return json(route, TEILNEHMER)
      if (n === 'tipp_admin_kabine') return json(route, { ok: true })
      return json(route, null)
    }
    if (pfad.startsWith('sva_tipp_einstellungen')) return json(route, req.method() === 'GET' ? ((req.headers().accept || '').includes('vnd.pgrst.object') ? EINST : [EINST]) : null)
    if (pfad.startsWith('sm_sponsoren')) return json(route, SPONSOREN)
    if (req.method() === 'GET') return json(route, [])
    return json(route, { message: 'audit: write blocked' }, 403)
  })
  await ctx.route('**/auth/v1/**', (r) => json(r, {}, 403))
  await ctx.route('**/functions/v1/**', (r) => json(r, { configured: false }))
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`[${label}/${v}] pageerror ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/403|status of 4/.test(m.text())) errors.push(`[${label}/${v}] ${m.text().slice(0, 200)}`) })
  return { ctx, page, log }
}
const shot = async (page, name, full = false) => { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }) }

process.on('exit', () => { if (errors.length) console.log('Konsole bisher:\n' + errors.join('\n')) })
for (const v of ['m', 'd']) {
  // Spielbericht (Team-Zugang, am Handy)
  {
    const { ctx, page, log } = await seite('bericht', v, 'team')
    await page.goto(`${BASE}/admin/spielbericht/sp-live?preview=team`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    await shot(page, `30-admin-spielbericht-${v}`)
    await shot(page, `30b-admin-spielbericht-ganz-${v}`, true)
    check(await page.getByText('Spieler · 13 eingesetzt').isVisible(), `[${v}] Spielbericht vorbefüllt (13 eingesetzt)`)
    check(!(await page.getByRole('tab', { name: 'Story' }).count()), `[${v}] Team sieht keine Story-/Kabine-Bereiche`)
    // Vorlage ergänzen + MOTM + werten
    await page.getByRole('button', { name: 'Marc Kevin Biedermann: Vorlagen mehr' }).click()
    await page.selectOption('#tp-motm', 'p-warkehr-a')
    check(await page.getByRole('button', { name: /MOTM-Karte veröffentlichen/ }).isDisabled(), `[${v}] MOTM-Karte: ohne Album-Modul deaktiviert („Album-Modul folgt“)`)
    await page.getByRole('button', { name: 'Werten', exact: true }).click()
    await page.waitForTimeout(800)
    await shot(page, `31-admin-gewertet-${v}`)
    const sp = log.find((l) => l[0] === 'tipp_admin_bericht_speichern')?.[1]
    check(sp && sp.p_motm === 'p-warkehr-a' && sp.p_zeilen.find((z) => z.id === 'p-biedermann').vorlagen === 2, `[${v}] Bericht gespeichert mit MOTM + ergänzter Vorlage`)
    check(log.some((l) => l[0] === 'tipp_admin_werten'), `[${v}] Werten aufgerufen`)
    await ctx.close()
  }
  // Spieltage, Story, Kabine (Admin)
  {
    const { ctx, page, log } = await seite('admin', v, 'admin')
    await page.goto(`${BASE}/admin/tippliga/spieltage?preview`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    await shot(page, `32-admin-spieltage-${v}`, true)
    await page.getByRole('switch', { name: /Testspiel tippbar machen/ }).click()
    await page.waitForTimeout(400)
    check(log.some((l) => l[0] === 'tipp_admin_spieltag_speichern' && l[1].p_tippbar === true), `[${v}] Testspiel → Winterwertung geschaltet`)
    await page.goto(`${BASE}/admin/tippliga/story?preview`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(4500)
    await shot(page, `33-admin-story-${v}`, true)
    check((await page.locator('figure img').count()) === 5, `[${v}] 5 Story-Grafiken erzeugt`)
    await page.goto(`${BASE}/admin/tippliga/kabine?preview`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    await shot(page, `34-admin-kabine-${v}`, true)
    await page.getByRole('button', { name: 'Als Kabine markieren' }).first().click()
    await page.waitForTimeout(400)
    check(log.some((l) => l[0] === 'tipp_admin_kabine' && l[1].p_kabine === true), `[${v}] Kabine markiert`)
    await ctx.close()
  }
}
await browser.close()
fs.writeFileSync(`${OUT}/_pruefung-admin.txt`, [...checks, '', ...errors].join('\n'))
console.log(checks.join('\n'))
if (errors.length) console.log('\nKonsole:\n' + errors.slice(0, 20).join('\n'))
console.log(`\n${checks.filter((c) => c.startsWith('FEHLER')).length} Fehler · ${errors.length} Konsolenfehler`)
