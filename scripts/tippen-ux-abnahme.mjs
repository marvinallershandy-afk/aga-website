// v22-T: Abnahme-Checkliste aus UX_PRUEFUNG_V21.md (+ v22-Feedback) automatisch prüfen.
// Nur lokal/gemockt: Vorführung (rein im Browser) bzw. gemockte RPCs — NIE echte DB.
//   VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 5193 --strictPort
//   BASE=http://localhost:5193 OUT=./shots-v22-tipp/abnahme node scripts/tippen-ux-abnahme.mjs   (ENG=webkit)
import { chromium, webkit } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5193'
const OUT = process.env.OUT || './shots-v22-tipp/abnahme'
const ENG = process.env.ENG === 'webkit' ? 'webkit' : 'chromium'
fs.mkdirSync(OUT, { recursive: true })
const browser = await (ENG === 'webkit' ? webkit : chromium).launch(ENG === 'webkit' ? {} : { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const M = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
const D = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
const ergebnis = []
const ok = (cond, id, msg) => {
  ergebnis.push(`${cond ? 'OK    ' : 'FEHLER'} [${id}] ${msg}`)
  console.log(`${cond ? 'OK    ' : 'FEHLER'} [${id}] ${msg}`)
}
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }

async function seite(view, pfad, { einfuehrung = false, reduced = false } = {}) {
  const ctx = await browser.newContext({ ...view, reducedMotion: reduced ? 'reduce' : 'no-preference', acceptDownloads: true })
  await ctx.route(/mock\.supabase\.co\//, (r) => (r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: CORS }) : r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: 'null' })))
  if (!einfuehrung) await ctx.addInitScript(() => { try { localStorage.setItem('sva-tipp-einfuehrung', '1'); localStorage.setItem('sva-tipp-einfuehrung-vorfuehrung', '1') } catch { /* */ } })
  const page = await ctx.newPage()
  const fehler = []
  page.on('pageerror', (e) => fehler.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|status of 4\d\d/.test(m.text()) && fehler.push(m.text()))
  await page.goto(BASE + pfad, { waitUntil: 'networkidle' })
  return { ctx, page, fehler }
}
const bild = (page, n) => page.screenshot({ path: `${OUT}/${n}-${ENG}.png` })

// ── A. Erstkontakt ─────────────────────────────────────────
for (const [v, view] of [['m', M], ['d', D]]) {
  const { ctx, page, fehler } = await seite(view, '/')
  await page.waitForTimeout(6000)
  const links = await page.evaluate(() => [...document.querySelectorAll('a[href^="/tippen"]')].filter((a) => { const r = a.getBoundingClientRect(); const s = getComputedStyle(a); return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && s.visibility !== 'hidden' && Number(s.opacity) > 0.5 }).map((a) => a.textContent.trim().replace(/\s+/g, ' ')))
  ok(links.some((t) => /tipp/i.test(t)), `A-${v}`, `Startseite ${v === 'm' ? 'mobil' : 'Desktop'} ohne Scroll: sichtbarer Tipp-Einstieg → /tippen (${links.length}: ${links.map((t) => t.slice(0, 24)).join(' | ')})`)
  if (v === 'm') ok(await page.locator('.kdock a[href="/tippen"]', { hasText: 'Tippen' }).isVisible(), 'A-dock', 'mobile Fußleiste enthält „Tippen“')
  const album = await page.locator('.kmap__ecke .alb-t--karte:not(.tip-t)').isVisible()
  ok(album, `A-album-${v}`, 'Album-Teaser weiter sichtbar (neben dem Tipp-Teaser)')
  ok(fehler.length === 0, `D-fehler-start-${v}`, `Startseite ohne Seitenfehler ${fehler.slice(0, 1)}`)
  await bild(page, `a-start-${v}`)
  await ctx.close()
}

// ── B. Tipp-Flow (Vorführung, mobil) ───────────────────────
{
  const { ctx, page, fehler } = await seite(M, '/tippen?vorfuehrung=1')
  await page.waitForSelector('.tp-formular')
  const haken = await page.locator('.tp-abgabe__status li.is-ok').count()
  ok(haken === 0, 'B1', `frisch: keine Haken an den Chips (${haken}), Ergebnis neutral „${(await page.locator('.tp-abgabe__status li').first().textContent())?.trim()}“`)
  const leer = await page.locator('.tp-slot__leer').count()
  ok(leer >= 1, 'B1-elf', `Vorführung startet mit leerer Elf (${leer} freie Plätze) + „Startelf übernehmen“ ${await page.getByRole('button', { name: /Startelf übernehmen/ }).count() ? 'da' : 'FEHLT'}`)
  // ANG-Platz antippen → Auswahl mit Zweitposition + nicht verfügbar
  await page.locator('.tp-slot__leer').first().scrollIntoViewIfNeeded()
  await page.locator('.tp-slot__leer').first().click()
  await page.waitForTimeout(500)
  const zweit = await page.locator('.tp-wahl .tp-tag--zweit').count()
  const weg = await page.locator('.tp-wahl .is-weg').count()
  ok(zweit >= 1 && weg >= 1, 'B1-wahl', `Auswahl ANG: Zweitpositions-Spieler (${zweit}) + ausgegraut „nicht verfügbar“ (${weg})`)
  await bild(page, 'b1-auswahl')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  // Unberührtes Ergebnis → Rückfrage
  await page.locator('.tp-abgabe__los').click()
  await page.waitForTimeout(300)
  const frage = await page.locator('.tp-abgabe__frage').isVisible()
  ok(frage, 'B2', `unberührtes Ergebnis → Rückfrage „${(await page.locator('.tp-abgabe__frage p').textContent().catch(() => ''))?.trim().slice(0, 70)}…“`)
  await bild(page, 'b2-rueckfrage')
  await page.getByRole('button', { name: 'Ergebnis wählen' }).click()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: 'SVA: ein Tor mehr' }).click()
  await page.getByRole('button', { name: 'SVA: ein Tor mehr' }).click()
  await page.getByRole('button', { name: /ein Tor mehr/ }).nth(1).click()
  // B3: Bonusfrage im Bild → Antworten nicht verdeckt
  // wie ein Mensch: Frage in die Bildmitte scrollen (WebKit ignoriert bei
  // scrollIntoViewIfNeeded den scroll-margin)
  await page.evaluate(() => document.querySelector('.tp-frage')?.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(400)
  const box = await page.evaluate(() => {
    const opt = [...document.querySelectorAll('.tp-frage .tp-option')].map((o) => o.getBoundingClientRect().bottom)
    const abg = document.querySelector('.tp-abgabe').getBoundingClientRect().top
    return { unten: Math.max(...opt), abgabe: abg, stapel: innerHeight - abg, anteil: (innerHeight - abg) / innerHeight }
  })
  ok(box.unten <= box.abgabe, 'B3', `Bonus-Antworten vollständig sichtbar (unten ${Math.round(box.unten)} ≤ Abgabe ${Math.round(box.abgabe)})`)
  ok(box.anteil <= 0.2, 'B3-stapel', `mobiler Fußstapel ${Math.round(box.stapel)} px = ${(box.anteil * 100).toFixed(1)} % der Höhe (≤ 20 %)`)
  await bild(page, 'b3-bonus')
  // Antwort 1 (3 Optionen) antippen, dann Wisch auf 2er-Frage
  await page.locator('.tp-frage .tp-option').first().click()
  await page.waitForTimeout(700)
  await page.evaluate(() => document.querySelector('.tp-frage')?.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(300)
  const vor = await page.locator('.tp-deck__punkte i.is-an').count()
  const f = await page.locator('.tp-frage').first().boundingBox()
  if (f) {
    await page.mouse.move(f.x + f.width / 2, f.y + 40)
    await page.mouse.down()
    for (let k = 1; k <= 10; k++) await page.mouse.move(f.x + f.width / 2 + k * 22, f.y + 40)
    await page.mouse.up()
  }
  await page.waitForTimeout(800)
  const nach = await page.locator('.tp-deck__punkte i.is-an').count()
  ok(nach === vor + 1, 'B4', `Wisch auf 2er-Bonusfrage beantwortet sie (${vor}/3 → ${nach}/3)`)
  // C1: schnelle Taps → keine Textselektion
  for (const sel of ['.tp-abgabe__status li', '.tp-stepper__zahl', '.tp-deck__punkte']) {
    const el = page.locator(sel).first()
    for (let k = 0; k < 5; k++) await el.click({ delay: 10 }).catch(() => {})
  }
  await page.locator('.tp-abgabe__status').dblclick().catch(() => {})
  const sel = await page.evaluate(() => window.getSelection()?.toString() ?? '')
  ok(sel.trim() === '', 'C1', `5× schnell tippen / Doppeltipp: keine Textselektion („${sel.slice(0, 20)}“)`)
  // C3: Kontext im Sticky-Panel
  const fuer = (await page.locator('.tp-abgabe__fuer').textContent())?.trim()
  ok(/FIS/.test(fuer ?? ''), 'C3', `Abgabe-Knopf nennt das Spiel: „${fuer}“`)
  // C7: Steuerleiste klappt beim Scrollen ein
  await page.evaluate(() => window.scrollTo(0, 900))
  await page.waitForTimeout(300)
  ok(await page.locator('.tp-steuer.is-kompakt').count() === 1, 'C7', 'Vorführung mobil: Steuer-Kopf klappt beim Scrollen ein')
  // Abgabe → Belohnung
  await page.locator('.tp-abgabe__los').click()
  await page.waitForTimeout(900)
  ok(await page.locator('.tp-belohnung').isVisible(), 'B2-ab', 'mit gewähltem Ergebnis: direkt abgegeben (kein Zwischenschritt), Belohnung „Tipp-Pack · 2 Karten“')
  ok(fehler.length === 0, 'D-fehler-tippen', `/tippen ohne Seitenfehler ${fehler.slice(0, 1)}`)
  await ctx.close()
}

// ── v22: Ein Fokus, Live-Leiste, TOR!, Legende ─────────────
{
  const { ctx, page, fehler } = await seite(M, '/tippen?vorfuehrung=1&phase=live&minute=20')
  await page.waitForSelector('.tp-live')
  ok((await page.locator('.tp-formular').count()) === 0 && (await page.locator('.tp-vorschau-spiel').count()) === 1, 'F1', `live: KEIN Tippschein, nächster Spieltag nur als Vorschau („${(await page.locator('.tp-vorschau-spiel').textContent())?.replace(/\s+/g, ' ').trim()}“)`)
  ok(await page.locator('.tp-bonuslive__legende').isVisible(), 'C2', `Legende für „?“: „${(await page.locator('.tp-bonuslive__legende').textContent())?.trim()}“`)
  await page.evaluate(() => window.scrollTo(0, 2000))
  await page.waitForTimeout(300)
  ok(await page.locator('.ll[data-aus="false"]').isVisible(), 'F2', 'Live-Leiste beim Scrollen sichtbar (Stand, Minute, deine Punkte)')
  await page.locator('.tp-tabs--unten a', { hasText: 'Rangliste' }).click()
  await page.waitForTimeout(400)
  ok(await page.locator('.ll').isVisible(), 'F2-tab', 'Live-Leiste auch im Bereich „Rangliste“ sichtbar')
  await page.getByRole('button', { name: /Nächstes Ereignis/ }).click()
  await page.waitForTimeout(1300)
  const tj = page.locator('.tj--tor')
  ok(await tj.isVisible(), 'F3', `TOR!-Einblendung über allem (auch in einem anderen Bereich): „${(await page.locator('.tj__wer b').textContent())?.trim()}“, ${(await page.locator('.tj__stand').textContent())?.replace(/\s+/g, '')}`)
  await bild(page, 'f3-tor')
  await tj.click()
  await page.waitForTimeout(500)
  ok((await page.locator('.tj').count()) === 0, 'F3-zu', 'antippen schließt die Einblendung')
  ok(fehler.length === 0, 'D-fehler-live', `Vorführung live ohne Seitenfehler ${fehler.slice(0, 1)}`)
  await ctx.close()
}
// Abpfiff → Wertung folgt → Wertung → nächstes Spiel offen; Count-up nur bei echter Änderung
{
  const { ctx, page, fehler } = await seite(M, '/tippen?vorfuehrung=1&phase=live&minute=20')
  await page.locator('.tp-steuer__phasen button', { hasText: 'Abpfiff' }).click()
  await page.waitForTimeout(600)
  ok(await page.locator('.tp-wertungfolgt').isVisible() && (await page.locator('.tp-formular').count()) === 0, 'F4', 'nach Abpfiff: „Wertung folgt“, nächstes Spiel noch gesperrt')
  await bild(page, 'f4-wertung-folgt')
  await page.getByRole('button', { name: /Jetzt werten/ }).click()
  await page.waitForTimeout(800)
  ok(await page.locator('.tp-aufl').first().isVisible() && (await page.locator('.tp-formular').count()) === 1, 'F5', 'nach der Wertung: Auflösung + SG Lühe öffnet zum Tippen')
  await page.waitForTimeout(6500)
  const ziel = (await page.locator('.tp-aufl__zahl').first().textContent())?.trim()
  await page.locator('.tp-steuer__phasen button', { hasText: 'Montag' }).click()
  await page.waitForTimeout(6500)
  await page.locator('.tp-steuer__phasen button', { hasText: 'Abpfiff' }).click()
  await page.getByRole('button', { name: /Jetzt werten/ }).click()
  await page.waitForTimeout(250)
  await page.locator('.tp-aufl').first().scrollIntoViewIfNeeded()
  await page.waitForTimeout(150)
  const sofort = (await page.locator('.tp-aufl__zahl').first().textContent())?.trim()
  ok(sofort === ziel, 'C4', `Abpfiff → Montag → Abpfiff: Punktzahl steht beim 2. Besuch sofort (${sofort} = ${ziel})`)
  ok(fehler.length === 0, 'D-fehler-phasen', `Phasenwechsel ohne Seitenfehler ${fehler.slice(0, 1)}`)
  await ctx.close()
}
// Legenden Rangliste/Montag, Preise
{
  const { ctx, page } = await seite(M, '/tippen?vorfuehrung=1&phase=montag')
  await page.waitForTimeout(7000)
  const tie = await page.locator('.tp-fussnote', { hasText: 'Punktgleichheit' }).count()
  ok(tie >= 1, 'C5-tie', 'Spieltagssieger-Block erklärt den Tiebreak')
  await page.locator('.tp-tabs--unten a', { hasText: 'Rangliste' }).click()
  await page.waitForTimeout(900)
  ok((await page.locator('.tp-fussnote', { hasText: 'K = Kabine' }).count()) === 1, 'C5-k', 'Rangliste: „K = Kabine“ erklärt')
  ok((await page.locator('.tp-preise .tp-preis').count()) >= 5, 'P1', `„Das kannst du gewinnen“ (Saison 1–5 + Monat): ${await page.locator('.tp-preise .tp-preis').count()} Preise, Hinweis Teilnahmebedingungen ${(await page.locator('.tp-preise a[href="/teilnahmebedingungen"]').count()) ? 'da' : 'FEHLT'}`)
  await page.locator('.tp-preise').scrollIntoViewIfNeeded()
  await bild(page, 'p1-preise')
  await ctx.close()
}
// C6: Desktop teilen → Rückmeldung
{
  const { ctx, page } = await seite(D, '/tippen?vorfuehrung=1')
  await page.getByRole('button', { name: 'SVA: ein Tor mehr' }).click()
  await page.locator('.tp-abgabe__los').click()
  await page.waitForTimeout(900)
  const webShare = await page.evaluate(() => typeof navigator.share === 'function' && typeof navigator.canShare === 'function')
  const dl = webShare ? Promise.resolve(null) : page.waitForEvent('download', { timeout: 8000 }).catch(() => null)
  await page.locator('.tp-belohnung').getByRole('button', { name: /Story/ }).click()
  const d = await dl
  await page.waitForTimeout(400)
  if (webShare) ok(true, 'C6', 'Browser hat Web-Share (Systemdialog = Rückmeldung) — Download-Weg nur ohne Web-Share')
  else ok(!!d && (await page.locator('.tp-toast.is-da').count()) === 1, 'C6', `Desktop „Tipp in die Story“: Bild geladen (${d?.suggestedFilename() ?? '–'}) + sichtbare Bestätigung „${(await page.locator('.tp-toast').textContent().catch(() => ''))?.trim()}“`)
  await bild(page, 'c6-toast')
  await ctx.close()
}
// Einführung: Trailer, überspringbar, ≤ 20 s
{
  const { ctx, page } = await seite(M, '/tippen?vorfuehrung=1', { einfuehrung: true })
  await page.waitForSelector('.ti__buehne', { timeout: 6000 })
  ok((await page.locator('.ti__balken i').count()) === 5, 'E1', 'Einführung: 5 animierte Szenen mit Fortschritt (5 × 3,6 s = 18 s)')
  await page.getByRole('button', { name: 'Überspringen' }).click()
  await page.waitForTimeout(500)
  ok((await page.locator('.ti__buehne').count()) === 0, 'E2', 'überspringbar')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  ok((await page.locator('.ti__buehne').count()) === 0, 'E3', 'nur einmal (nach Überspringen nicht erneut)')
  await page.locator('.tp-fuss__hilfe').click()
  await page.waitForTimeout(500)
  ok((await page.locator('.ti__buehne').count()) === 1, 'E4', 'jederzeit über „So funktioniert’s“')
  await ctx.close()
}
// D: reduced-motion → Endstand sofort
{
  const { ctx, page } = await seite(M, '/tippen?vorfuehrung=1&phase=abpfiff', { reduced: true })
  await page.waitForTimeout(800)
  await page.locator('.tp-aufl').first().scrollIntoViewIfNeeded()
  const z = (await page.locator('.tp-aufl__zahl').first().textContent())?.trim()
  ok(Number(z) > 20, 'D-rm', `reduced-motion: Auflösung ohne Count-up, Endstand sofort (${z})`)
  await ctx.close()
}
// D: keine Seitenfehler auf /live, /album, /partner
for (const pfad of ['/live', '/album', '/partner']) {
  const { ctx, page, fehler } = await seite(M, pfad)
  await page.waitForTimeout(1500)
  ok(fehler.length === 0, `D-fehler${pfad}`, `${pfad} ohne Seitenfehler ${fehler.slice(0, 1)}`)
  await ctx.close()
}

await browser.close()
fs.writeFileSync(`${OUT}/ergebnis-${ENG}.txt`, ergebnis.join('\n') + '\n')
const n = ergebnis.filter((x) => x.startsWith('FEHLER')).length
console.log(n ? `\n${n} FEHLER` : '\nalles grün')
process.exit(n ? 1 : 0)
