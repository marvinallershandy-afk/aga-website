// Prerender: rendert nach dem Build den Inhalts-DOM (Sections +
// Brandbar) in dist/index.html hinein. Crawler & View-Source sehen
// die komplette Kern-Copy ohne JS; React ersetzt den #root-Inhalt
// beim Mount (createRoot), daher kein Hydration-Konflikt.
// Trick: reduced-motion-Kontext → Fallback-Pfad, kein WebGL nötig.
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'

const DIST = 'dist'
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
await page.waitForSelector('.scroll-root', { timeout: 30000 })
await page.waitForTimeout(1200)

const html = await page.evaluate(() => {
  // Nur statischen Inhalt prerendern (kein Gate, keine Overlays)
  const main = document.querySelector('.scroll-root')
  return main ? main.outerHTML : ''
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
console.log(`Prerender ok: ${(html.length / 1024).toFixed(1)} kB Inhalts-DOM in dist/index.html`)
