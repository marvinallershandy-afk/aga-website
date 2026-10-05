// Prerender: rendert nach dem Build den Inhalts-DOM (Sections +
// Brandbar) in dist/index.html hinein. Crawler & View-Source sehen
// die komplette Kern-Copy ohne JS; React ersetzt den #root-Inhalt
// beim Mount (createRoot), daher kein Hydration-Konflikt.
// Trick: reduced-motion-Kontext → Fallback-Pfad, kein WebGL nötig.
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_ORIGIN, SITE_ORIGIN, sportsEventsScript } from './site.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
// v16-K: Zielordner per DIST=… (z. B. Mess-Builds außerhalb von dist/)
const DIST = process.env.DIST || 'dist'
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.xml': 'application/xml', '.txt': 'text/plain', '.woff2': 'font/woff2', '.woff': 'font/woff' }

const server = createServer((req, res) => {
  const url = (req.url || '/').split('?')[0]
  const file = join(DIST, url === '/' ? 'index.html' : url)
  if (existsSync(file) && !file.endsWith('/')) {
    res.setHeader('content-type', MIME[extname(file)] || 'application/octet-stream')
    res.end(readFileSync(file))
  } else {
    res.setHeader('content-type', 'text/html')
    res.end(readFileSync(join(DIST, 'index.html')))
  }
})
await new Promise((r) => server.listen(45733, r))

const browser = await chromium.launch()
const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()
await page.goto('http://localhost:45733/', { waitUntil: 'load', timeout: 60000 })
// v16-K: Startseite ist die Vereinsgelände-Karte. Vorgerendert werden
// Poster + Marker (echte Links /#ort, schon vor dem JS klickbar), Kopf und
// der SEO-Block mit dem Kerninhalt jedes Ortes (visuell verborgen).
await page.waitForSelector('.kmap .kmark', { state: 'attached', timeout: 30000 })
await page.waitForTimeout(1200)

const html = await page.evaluate(() => {
  // Nur statischen Inhalt prerendern (keine Panels, keine Overlays)
  const poster = document.querySelector('.kmap__poster')
  const map = document.querySelector('.kmap')
  return poster && map ? poster.outerHTML + map.outerHTML : ''
})
await browser.close()
server.close()

if (!html || html.length < 2000) {
  console.error('Prerender: Inhalt zu kurz — abgebrochen, dist bleibt unverändert.')
  process.exit(1)
}

const indexPath = join(DIST, 'index.html')
const index = readFileSync(indexPath, 'utf8')
const out = index.replace('<!--app-html-->', html)
if (out === index) {
  console.error('Prerender: Marker <!--app-html--> nicht gefunden.')
  process.exit(1)
}
writeFileSync(indexPath, out)
console.log(`Prerender ok: ${(html.length / 1024).toFixed(1)} kB Inhalts-DOM in ${indexPath}`)

// ── v19-K (Audit B §2.8.3): SportsEvent-JSON-LD der nächsten Heimspiele in
//    dist/index.html + dist/live.html injizieren (vor </head>). Quelle:
//    scripts/.seo-events.json (von fetch-content.mjs, leer = nichts). ─────────
function injectSeo(fileName) {
  const p = join(DIST, fileName)
  if (!existsSync(p)) return
  let doc = readFileSync(p, 'utf8')
  if (doc.includes('"SportsEvent"')) return // schon vorhanden (idempotent)
  const script = sportsEventsScript(seoEvents)
  if (!script) return
  const next = doc.replace('</head>', `    ${script}\n  </head>`)
  if (next !== doc) {
    writeFileSync(p, next)
    console.log(`SEO: SportsEvent-JSON-LD (${seoEvents.length}) in ${p}`)
  }
}
let seoEvents = []
try {
  const sp = join(__dirname, '.seo-events.json')
  if (existsSync(sp)) seoEvents = JSON.parse(readFileSync(sp, 'utf8'))
} catch { seoEvents = [] }
if (Array.isArray(seoEvents) && seoEvents.length) {
  injectSeo('index.html')
  injectSeo('live.html')
} else {
  console.log('SEO: keine kommenden Heimspiele → kein SportsEvent-JSON-LD (nichts erfunden).')
}

// ── v19-K (Audit B §2.8): Domain-Tausch an EINER Stelle. Ist SITE_ORIGIN per
//    ENV gesetzt (≠ Default-Netlify-Domain), wird die Default-Domain im
//    gebauten dist/ überall ersetzt — HTML-Köpfe (canonical/og/JSON-LD),
//    sitemap.xml und robots.txt. Ohne ENV: No-op (identische Werte). ─────────
if (SITE_ORIGIN !== DEFAULT_ORIGIN) {
  const dateien = ['index.html', 'live.html', 'partner.html', 'album.html', 'galerie.html', 'impressum.html', 'datenschutz.html', '404.html', 'sitemap.xml', 'robots.txt']
  let geaendert = 0
  for (const f of dateien) {
    const p = join(DIST, f)
    if (!existsSync(p)) continue
    const doc = readFileSync(p, 'utf8')
    if (!doc.includes(DEFAULT_ORIGIN)) continue
    writeFileSync(p, doc.split(DEFAULT_ORIGIN).join(SITE_ORIGIN))
    geaendert++
  }
  console.log(`SITE_ORIGIN: ${DEFAULT_ORIGIN} → ${SITE_ORIGIN} in ${geaendert} Datei(en) ersetzt.`)
}
