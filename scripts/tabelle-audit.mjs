// v15-T: Audit „Tabelle per Screenshot" — OHNE echten API-Key, OHNE DB-Schreiben.
//  1. erzeugt Beispiel-Tabellenbilder (heller Desktop-Look + dunkler Handy-Look)
//     → shots-tab/test-tabelle-*.png (für den späteren Live-Test mit echtem Key)
//  2. klickt den Admin (DEV-?preview-Bypass) desktop + 390 px durch:
//     Start → Datei wählen → Ladezustand → Vorschau mit Diff/Warnungen →
//     Zelle korrigieren → Übernehmen (Schreibzugriffe gemockt, nur im Speicher)
//     → Fehlerfall „Kein API-Key" → Einfügen (Strg+V) und Drag & Drop.
// Die Function-Antwort wird mit der ECHTEN Server-Logik (logik.ts → verarbeite)
// aus einer simulierten Claude-Antwort gebaut.
//   npx vite --port 5187 --strictPort   (vorher)
//   node scripts/tabelle-audit.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { verarbeite } from '../supabase/functions/tabelle-aus-bild/logik.ts'

const BASE = process.env.BASE || 'http://localhost:5187'
const OUT = process.env.OUT || './shots-tab'
fs.mkdirSync(OUT, { recursive: true })

// ── Wahrheit: Tabelle nach dem 9. Spieltag (so steht sie auf den Testbildern) ──
const SPIELTAG_9 = [
  [1, 'TuS Fischbek', 9, 7, 1, 1, 28, 9, 22],
  [2, 'SV Agathenburg/Dollern', 9, 6, 2, 1, 24, 11, 20],
  [3, 'VfL Horneburg', 9, 5, 2, 2, 19, 12, 17],
  [4, 'TSV Apensen', 9, 5, 1, 3, 17, 14, 16],
  [5, 'TuS Harsefeld II', 9, 4, 2, 3, 15, 15, 14],
  [6, 'SG Estetal', 9, 3, 3, 3, 14, 16, 12],
  [7, 'VfL Güldenstern Stade III', 9, 3, 1, 5, 12, 18, 10],
  [8, 'FC Mulsum/Kutenholz', 9, 2, 2, 5, 10, 19, 8],
  [9, 'TSV Wiepenkathen', 9, 2, 1, 6, 9, 20, 7],
  [10, 'SV Ahlerstedt/Ottendorf II', 9, 1, 1, 7, 8, 26, 4],
  [11, 'TuS Hammah', 9, 0, 2, 7, 5, 25, 2],
  [12, 'TSV Bargstedt', 9, 0, 1, 8, 4, 28, 1],
].map(([platz, team, spiele, siege, unentschieden, niederlagen, tore, gegentore, punkte]) => ({
  platz, team, spiele, siege, unentschieden, niederlagen, tore, gegentore, punkte,
}))

// ── Gespeichert in sm_tabelle: Stand nach dem 8. Spieltag ──
const T = (d) => new Date(Date.now() + d * 864e5).toISOString()
const GESPEICHERT_8 = [
  [1, 'SV Agathenburg-Dollern', 8, 6, 1, 1, 22, 10, 19, true],
  [2, 'TuS Fischbek', 8, 6, 1, 1, 25, 8, 19],
  [3, 'VfL Horneburg', 8, 5, 1, 2, 18, 11, 16],
  [4, 'TSV Apensen', 8, 4, 1, 3, 15, 13, 13],
  [5, 'TuS Harsefeld II', 8, 4, 1, 3, 14, 14, 13],
  [6, 'SG Estetal', 8, 3, 2, 3, 12, 14, 11],
  [7, 'VfL Güldenstern Stade III', 8, 2, 1, 5, 10, 17, 7],
  [8, 'FC Mulsum/Kutenholz', 8, 2, 1, 5, 9, 18, 7],
  [9, 'TSV Wiepenkathen', 8, 2, 1, 5, 9, 18, 7],
  [10, 'SV Ahlerstedt/Ottendorf II', 8, 1, 1, 6, 7, 23, 4],
  [11, 'TuS Hammah', 8, 0, 1, 7, 4, 24, 1],
  [12, 'TSV Bargstedt', 8, 0, 1, 7, 3, 25, 1],
].map(([platz, team, spiele, siege, unentschieden, niederlagen, tore, gegentore, punkte, self], i) => ({
  id: `t${i}`, saison: '2026/27', platz, team, spiele, siege, unentschieden, niederlagen, tore, gegentore,
  diff: tore - gegentore, punkte, self: !!self, created_at: T(-9), updated_at: T(-7),
}))

// ── Simulierte Claude-Antwort mit typischen Lesefehlern ──
const CLAUDE_ROH = {
  liga: 'Kreisliga Stade',
  spieltag: 9,
  konfidenz: 'mittel',
  warnungen: ['Bei SG Estetal ist die Spalte „V“ (Niederlagen) vom Werbebanner verdeckt.'],
  rows: SPIELTAG_9.map((r) => {
    const x = { ...r, tordifferenz: r.tore - r.gegentore }
    if (r.team === 'TSV Apensen') x.punkte = 13 // 16 als 13 gelesen
    if (r.team === 'SG Estetal') x.niederlagen = null // verdeckt
    if (r.team === 'VfL Horneburg') x.tordifferenz = 9 // TD falsch gelesen
    if (r.team === 'FC Mulsum/Kutenholz') x.team = 'FC Mulsum/Kutenh.' // Handy kürzt Namen ab
    return x
  }),
}
const FUNCTION_ANTWORT = verarbeite(structuredClone(CLAUDE_ROH))

// ═════════════════════════════════════════════════════════════
// 1) Beispiel-Tabellenbilder erzeugen
// ═════════════════════════════════════════════════════════════
function tabelleHtml({ dunkel, mobil }) {
  const c = dunkel
    ? { bg: '#121417', card: '#1c1f24', text: '#e8eaed', mute: '#9aa0a6', line: '#2c3036', head: '#23272d', accent: '#3ddc84' }
    : { bg: '#eef0f2', card: '#ffffff', text: '#2b2b2b', mute: '#6b6b6b', line: '#e3e3e3', head: '#f5f5f5', accent: '#d6001c' }
  const kopf = mobil
    ? ['#', 'Mannschaft', 'Sp', 'S', 'U', 'N', 'Tore', 'Diff', 'Pkt']
    : ['Pl.', 'Mannschaft', 'Sp.', 'G', 'U', 'V', 'Tore', 'TD', 'Pkt.']
  const zeilen = SPIELTAG_9.map((r) => {
    const td = r.tore - r.gegentore
    const zone = r.platz <= 1 ? c.accent : r.platz >= 11 ? '#c0392b' : 'transparent'
    return `<tr>
      <td class="pl" style="border-left:3px solid ${zone}">${r.platz}.</td>
      <td class="team"><span class="wappen"></span>${r.team}</td>
      <td>${r.spiele}</td><td>${r.siege}</td><td>${r.unentschieden}</td><td>${r.niederlagen}</td>
      <td>${r.tore}:${r.gegentore}</td><td>${td > 0 ? '+' : ''}${td}</td><td class="pkt">${r.punkte}</td></tr>`
  }).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:${c.bg};font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:${c.text}}
    .bar{background:${dunkel ? '#0b0c0e' : '#3c3c3c'};color:#fff;padding:${mobil ? '14px 16px' : '12px 24px'};font-weight:600;font-size:${mobil ? 17 : 15}px}
    .wrap{padding:${mobil ? '12px 8px' : '24px'}}
    .card{background:${c.card};border-radius:${mobil ? 12 : 4}px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.12)}
    h1{font-size:${mobil ? 18 : 20}px;margin:0;padding:${mobil ? '14px 12px 4px' : '18px 20px 4px'}}
    .sub{color:${c.mute};font-size:13px;padding:${mobil ? '0 12px 10px' : '0 20px 12px'}}
    .tabs{display:flex;gap:18px;padding:${mobil ? '0 12px' : '0 20px'};border-bottom:1px solid ${c.line};font-size:13px;color:${c.mute}}
    .tabs span{padding:8px 0}.tabs .on{color:${c.text};border-bottom:2px solid ${c.accent};font-weight:600}
    table{width:100%;border-collapse:collapse;font-size:${mobil ? 13 : 14}px}
    th{background:${c.head};color:${c.mute};font-weight:600;font-size:12px;padding:8px 6px;text-align:center}
    td{padding:${mobil ? '9px 4px' : '10px 6px'};border-top:1px solid ${c.line};text-align:center;font-variant-numeric:tabular-nums}
    th:nth-child(2),td.team{text-align:left}
    td.team{white-space:nowrap;${mobil ? 'max-width:118px;overflow:hidden;text-overflow:ellipsis;' : ''}}
    .wappen{display:inline-block;width:16px;height:16px;border-radius:50%;background:${c.line};margin-right:8px;vertical-align:-3px}
    td.pl{color:${c.mute};width:34px}td.pkt{font-weight:700}
    .ad{margin:${mobil ? '12px 0 0' : '16px 0 0'};height:${mobil ? 60 : 90}px;border:1px dashed ${c.mute};color:${c.mute};display:flex;align-items:center;justify-content:center;font-size:12px;border-radius:6px}
  </style></head><body>
    <div class="bar">${mobil ? '‹  Tabelle' : 'Testbild · Ligatabelle (kein Original-Layout)'}</div>
    <div class="wrap"><div class="card">
      <h1>Kreisliga Stade</h1><div class="sub">Herren · Saison 2026/27 · 9. Spieltag</div>
      <div class="tabs"><span class="on">Gesamt</span><span>Heim</span><span>Auswärts</span></div>
      <table><thead><tr>${kopf.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${zeilen}</tbody></table>
    </div><div class="ad">Werbung</div></div>
  </body></html>`
}

async function testbilder(browser) {
  const varianten = [
    { name: 'test-tabelle-hell-desktop.png', dunkel: false, mobil: false, viewport: { width: 980, height: 700 }, dpr: 1 },
    { name: 'test-tabelle-dunkel-handy.png', dunkel: true, mobil: true, viewport: { width: 390, height: 844 }, dpr: 3 },
  ]
  for (const v of varianten) {
    const ctx = await browser.newContext({ viewport: v.viewport, deviceScaleFactor: v.dpr })
    const page = await ctx.newPage()
    await page.setContent(tabelleHtml(v))
    await page.screenshot({ path: path.join(OUT, v.name), fullPage: !v.mobil })
    await ctx.close()
    console.log('Testbild:', path.join(OUT, v.name))
  }
  fs.writeFileSync(path.join(OUT, 'test-tabelle-erwartet.json'), JSON.stringify(SPIELTAG_9, null, 2))
}

// ═════════════════════════════════════════════════════════════
// 2) Admin-Durchlauf
// ═════════════════════════════════════════════════════════════
const errors = []
const checks = []
const check = (ok, desc) => checks.push(`${ok ? 'OK    ' : 'FEHLER'}  ${desc}`)

async function setupRoutes(ctx, state) {
  await ctx.route('**/rest/v1/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const table = url.pathname.split('/rest/v1/')[1]?.split('?')[0]
    const method = req.method()
    const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
    const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (table === 'sm_tabelle') {
      if (method === 'GET') return send(single ? state.tabelle[0] ?? null : [...state.tabelle].sort((a, b) => a.platz - b.platz))
      const idEq = url.searchParams.get('id')?.replace(/^eq\./, '')
      if (method === 'POST') {
        const b = req.postDataJSON()
        const row = { id: `neu${++state.zaehler}`, created_at: T(0), updated_at: T(0), ...b, diff: b.tore - b.gegentore }
        state.tabelle.push(row)
        state.writes.push(`POST ${row.platz} ${row.team}`)
        return send(single ? row : [row], 201)
      }
      if (method === 'PATCH') {
        const b = req.postDataJSON()
        const i = state.tabelle.findIndex((r) => r.id === idEq)
        if (i < 0) return send({ message: 'not found' }, 404)
        state.tabelle[i] = { ...state.tabelle[i], ...b, diff: (b.tore ?? state.tabelle[i].tore) - (b.gegentore ?? state.tabelle[i].gegentore) }
        state.writes.push(`PATCH ${state.tabelle[i].platz} ${state.tabelle[i].team}`)
        return send(single ? state.tabelle[i] : [state.tabelle[i]])
      }
      if (method === 'DELETE') {
        state.tabelle = state.tabelle.filter((r) => r.id !== idEq)
        state.writes.push(`DELETE ${idEq}`)
        return route.fulfill({ status: 204, body: '' })
      }
    }
    if (method === 'GET') {
      if (table === 'sva_settings') {
        const s = { id: 1, fussball_de_team_id: '00ES8GN7SS00004CVV0AG08LVUPGND5I', fupa_url: null, instagram: 'sva_fussball', whatsapp: null, email: null, training: null, adresse: null, saison: '2026/27', rechtstexte_ok: false, updated_at: T(-4), updated_by: null }
        return send(single ? s : [s])
      }
      if (table === 'sm_admins') return send([{ email: 'preview@audit.local' }])
      return send(single ? null : [])
    }
    return send({ message: 'audit: write blocked' }, 403)
  })
  await ctx.route('**/functions/v1/tabelle-aus-bild', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }, body: 'ok' })
    let body = {}
    try { body = req.postDataJSON() ?? {} } catch { /* leer */ }
    state.functionCalls.push((body.bilder ?? []).map((b) => `${b.mediaType} ${Math.round((b.data?.length ?? 0) * 0.75 / 1024)} KB`))
    await new Promise((r) => setTimeout(r, state.delay))
    const h = { 'Access-Control-Allow-Origin': '*' }
    if (state.modus === 'kein_key') {
      return route.fulfill({ status: 503, contentType: 'application/json', headers: h, body: JSON.stringify({ error: 'Kein API-Key hinterlegt. Die Bilderkennung ist noch nicht eingerichtet — bitte Marvin Bescheid geben (Secret ANTHROPIC_API_KEY).', code: 'kein_key' }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify(FUNCTION_ANTWORT) })
  })
  await ctx.route('**/functions/v1/publish-site', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ configured: false }) }))
  await ctx.route('**/storage/v1/**', (route) => route.fulfill({ status: 403, contentType: 'application/json', body: '{}' }))
  await ctx.route('**/auth/v1/**', (route) => route.fulfill({ status: 403, contentType: 'application/json', body: '{}' }))
}

async function run(browser, label, viewport, bild) {
  const state = { tabelle: structuredClone(GESPEICHERT_8), writes: [], functionCalls: [], zaehler: 0, delay: 1800, modus: 'ok' }
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, ...(viewport.width < 500 ? { isMobile: true, hasTouch: true } : {}) })
  await setupRoutes(ctx, state)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/status of 503/.test(t) && state.modus === 'kein_key') return // erwarteter Fehlerfall
    errors.push(`[${label}] console: ${t.slice(0, 300)}`)
  })
  let n = 0
  const shot = async (name, full = false) => {
    await page.waitForTimeout(300)
    const file = `${label}-${String(n++).padStart(2, '0')}-${name}.png`
    await page.screenshot({ path: path.join(OUT, file), fullPage: full })
    console.log(file)
  }

  await page.goto(`${BASE}/admin/tabelle?preview`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await shot('start')
  check(await page.getByText('Tabelle per Screenshot aktualisieren').first().isVisible(), `[${label}] Import-Karte sichtbar`)
  check(await page.getByText('Gespeicherte Tabelle').first().isVisible(), `[${label}] Handeingabe bleibt darunter`)

  // Datei wählen → Ladezustand → Vorschau
  await page.locator('input[type=file][multiple]').setInputFiles(bild)
  await page.getByText('Tabelle wird gelesen').waitFor({ timeout: 5000 })
  await shot('analyse')
  await page.getByTestId('tabelle-vorschau').waitFor({ timeout: 10000 })
  await shot('vorschau', true)
  // Mitten in der Vorschau: Übernehmen-Leiste muss sichtbar bleiben (mobil über der Tab-Leiste)
  await page.evaluate(() => window.scrollTo(0, 900))
  await shot('vorschau-mitte')
  const leiste = await page.getByRole('button', { name: /Übernehmen/ }).boundingBox()
  const nav = await page.locator('nav[aria-label=Schnellnavigation]').boundingBox().catch(() => null)
  const navTop = nav && (await page.locator('nav[aria-label=Schnellnavigation]').isVisible()) ? nav.y : viewport.height
  check(!!leiste && leiste.y >= 0 && leiste.y + leiste.height <= navTop + 1, `[${label}] Übernehmen-Knopf beim Scrollen sichtbar (nicht unter der Tab-Leiste)`)
  check(state.functionCalls.length === 1 && state.functionCalls[0].length >= 1, `[${label}] Function aufgerufen mit ${JSON.stringify(state.functionCalls[0])}`)
  const vorschauText = await page.getByTestId('tabelle-vorschau').innerText()
  check(/Kreisliga Stade · 9\. Spieltag/.test(vorschauText), `[${label}] Liga + Spieltag angezeigt`)
  check(/Bitte prüfen/.test(vorschauText) && /verdeckt/.test(vorschauText), `[${label}] Hinweise (gelb) angezeigt`)
  check(/Punkte 13 passen nicht/.test(vorschauText), `[${label}] Zeilenwarnung Punkte (Apensen)`)
  check(/Tordifferenz \+9/.test(vorschauText), `[${label}] Zeilenwarnung Tordifferenz (Horneburg)`)
  check(/entfällt/.test(vorschauText) && /FC Mulsum\/Kutenholz/.test(vorschauText), `[${label}] abgekürzter Name → neu + entfällt`)
  const selfPressed = await page.locator('button[aria-pressed=true]:visible').count()
  check(selfPressed === 1, `[${label}] genau eine eigene Mannschaft markiert (${selfPressed})`)

  // Zelle korrigieren: Apensen Punkte 13 → 16, Mulsum-Name ergänzen
  const punkte = page.locator('input[aria-label="Punkte TSV Apensen"]:visible')
  await punkte.fill('16')
  const mulsum = page.locator('input[aria-label="Mannschaft"]:visible').nth(7)
  await mulsum.fill('FC Mulsum/Kutenholz')
  await page.waitForTimeout(200)
  const nachher = await page.getByTestId('tabelle-vorschau').innerText()
  check(!/Punkte 13 passen nicht/.test(nachher), `[${label}] Warnung verschwindet nach Korrektur`)
  check(!/entfällt/.test(nachher), `[${label}] nach Namenskorrektur: nichts entfällt`)
  await shot('korrigiert', true)

  // Übernehmen
  await page.getByRole('button', { name: /Übernehmen/ }).click()
  await page.getByTestId('tabelle-import').waitFor({ timeout: 8000 })
  await page.waitForTimeout(800)
  await shot('uebernommen', true)
  const patches = state.writes.filter((w) => w.startsWith('PATCH')).length
  const posts = state.writes.filter((w) => w.startsWith('POST')).length
  const deletes = state.writes.filter((w) => w.startsWith('DELETE')).length
  check(patches === 12 && posts === 0 && deletes === 0, `[${label}] Speichern: ${patches} PATCH, ${posts} POST, ${deletes} DELETE`)
  const apensen = state.tabelle.find((r) => r.team === 'TSV Apensen')
  const estetal = state.tabelle.find((r) => r.team === 'SG Estetal')
  const self = state.tabelle.filter((r) => r.self)
  check(apensen?.punkte === 16 && estetal?.niederlagen === 3, `[${label}] Werte gespeichert (Apensen 16 Pkt, Estetal 3 N berechnet)`)
  check(self.length === 1 && self[0].team === 'SV Agathenburg/Dollern' && self[0].platz === 2, `[${label}] eigene Mannschaft gespeichert: ${self.map((r) => `${r.platz} ${r.team}`)}`)
  const wahrheit = SPIELTAG_9.every((w) => {
    const r = state.tabelle.find((x) => x.platz === w.platz)
    return r && ['team', 'spiele', 'siege', 'unentschieden', 'niederlagen', 'tore', 'gegentore', 'punkte'].every((f) => r[f] === w[f])
  })
  check(wahrheit, `[${label}] gespeicherte Tabelle == Testbild (Spieltag 9)`)

  // Fehlerfall: kein API-Key
  state.modus = 'kein_key'
  state.delay = 300
  await page.locator('input[type=file][multiple]').setInputFiles(bild)
  await page.getByRole('alert').waitFor({ timeout: 8000 })
  await page.getByTestId('tabelle-import').scrollIntoViewIfNeeded()
  await shot('fehler-kein-key')
  check(/Kein API-Key hinterlegt/.test(await page.getByRole('alert').innerText()), `[${label}] Fehlertext „Kein API-Key hinterlegt“`)

  // Einfügen per Strg+V (synthetisches paste-Event mit Bild)
  state.modus = 'ok'
  const b64 = fs.readFileSync(bild).toString('base64')
  const vorher = state.functionCalls.length
  await page.evaluate(async (data) => {
    const blob = await (await fetch(`data:image/png;base64,${data}`)).blob()
    const dt = new DataTransfer()
    dt.items.add(new File([blob], 'zwischenablage.png', { type: 'image/png' }))
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, b64)
  await page.getByTestId('tabelle-vorschau').waitFor({ timeout: 8000 })
  check(state.functionCalls.length === vorher + 1, `[${label}] Einfügen aus Zwischenablage startet Auslesen`)
  await page.getByRole('button', { name: /Verwerfen/ }).click()
  await page.getByTestId('tabelle-import').waitFor({ timeout: 3000 })
  check(true, `[${label}] Verwerfen → zurück zum Start`)

  // Drag & Drop
  const vorDrop = state.functionCalls.length
  await page.evaluate(async (data) => {
    const blob = await (await fetch(`data:image/png;base64,${data}`)).blob()
    const dt = new DataTransfer()
    dt.items.add(new File([blob], 'gezogen.png', { type: 'image/png' }))
    const ziel = document.querySelector('[data-testid=tabelle-import]')
    ziel.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }))
    ziel.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
  }, b64)
  await page.getByTestId('tabelle-vorschau').waitFor({ timeout: 8000 })
  check(state.functionCalls.length === vorDrop + 1, `[${label}] Drag & Drop startet Auslesen`)

  await ctx.close()
}

const browser = await chromium.launch()
await testbilder(browser)
await run(browser, 'desktop', { width: 1280, height: 900 }, path.join(OUT, 'test-tabelle-hell-desktop.png'))
await run(browser, 'mobil', { width: 390, height: 844 }, path.join(OUT, 'test-tabelle-dunkel-handy.png'))
await browser.close()

console.log('\n── Prüfungen ──')
checks.forEach((c) => console.log(c))
console.log('\n── Konsolenfehler ──')
console.log(errors.length ? errors.join('\n') : 'keine')
const fehlgeschlagen = checks.filter((c) => c.startsWith('FEHLER')).length
if (fehlgeschlagen || errors.length) process.exitCode = 1
