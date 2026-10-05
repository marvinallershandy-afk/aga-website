// ─────────────────────────────────────────────────────────────
// v16-K: Poster-Standbilder der Vereinsgelände-Karte erzeugen.
//
// Rendert die fertige 3D-Karten-Totale (Dev-Server, echte GPU) je
// Bildklasse ohne DOM-Overlays, speichert sie als WebP in public/map/
// und schreibt die projizierten Marker-Positionen + Kamera nach
// src/map/posterData.ts. Poster und Live-Karte sind damit deckungsgleich.
//
//   npx vite --port 5190 --strictPort   (in einem zweiten Terminal)
//   node scripts/map-poster.mjs          [BASE=http://localhost:5190/]
//
// Kamera ändern: CAM_WIDE / CAM_TALL unten anpassen, Skript neu laufen lassen.
// ─────────────────────────────────────────────────────────────
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import ffmpeg from 'ffmpeg-static'

const BASE = process.env.BASE || 'http://localhost:5190/'
const OUT_DIR = 'public/map'

// Kamera der Totale je Klasse (Quelle der Wahrheit → posterData.ts)
const CAM_WIDE = { pos: [4.6, 21.5, 21.2], look: [1.5, 0, 0.9], fov: 30 }
const CAM_TALL = { pos: [-27.5, 36.5, 7.1], look: [2.2, 0, 0.6], fov: 34 }

const CLASSES = [
  // 16:9 — Desktop/Tablet quer (Cover schneidet seitlich bzw. oben/unten)
  { key: 'wide', cam: CAM_WIDE, ctx: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 }, quality: 80 },
  // 9:19.5 — Telefone hochkant (mobile Kette ohne Bloom wie auf dem Handy)
  {
    key: 'tall',
    cam: CAM_TALL,
    ctx: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: false, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
    quality: 78,
  },
]

const HIDE_DOM = `.kmap, .kpanel, .audio-toggle, .mday, .kmap__poster { display: none !important; }`

const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const result = {}
mkdirSync(OUT_DIR, { recursive: true })

for (const c of CLASSES) {
  const ctx = await browser.newContext(c.ctx)
  const page = await ctx.newPage()
  await page.goto(BASE)
  await page.waitForFunction(() => window.useStore?.getState().stageLive, null, { timeout: 120000 })
  const { width: W, height: H } = c.ctx.viewport
  await page.evaluate(({ cam, key }) => {
    const d = window.__mapDev
    d.mapWorld.still = true
    const o = d.OVERVIEW[key]
    o.pos.set(...cam.pos)
    o.look.set(...cam.look)
    o.fov = cam.fov
  }, { cam: c.cam, key: c.key })
  await page.addStyleTag({ content: HIDE_DOM })
  // Flutlicht, Schatten-Bake, Wald-Fades und Fans eingeschwungen
  await page.waitForTimeout(5000)
  const markers = await page.evaluate(({ W, H }) => {
    const out = {}
    for (const [id, s] of window.__mapDev.markerSlots) out[id] = [+(s.x / W).toFixed(4), +(s.y / H).toFixed(4)]
    return out
  }, { W, H })
  const png = join(OUT_DIR, `poster-${c.key}.png`)
  const webp = join(OUT_DIR, `poster-${c.key}.webp`)
  await page.screenshot({ path: png })
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', png, '-c:v', 'libwebp', '-quality', String(c.quality), '-compression_level', '6', webp])
  rmSync(png)
  result[c.key] = { aspect: W / H, cam: c.cam, markers }
  console.log(c.key, JSON.stringify(markers))
  await ctx.close()
}
await browser.close()

const fmt = (v) => `[${v.join(', ')}]`
const cls = (k, aspectExpr) => {
  const r = result[k]
  const m = Object.entries(r.markers)
    .map(([id, v]) => `      ${id}: ${fmt(v)},`)
    .join('\n')
  return `  ${k}: {
    aspect: ${aspectExpr},
    src: '/map/poster-${k}.webp',
    cam: { pos: ${fmt(r.cam.pos)}, look: ${fmt(r.cam.look)}, fov: ${r.cam.fov} },
    markers: {
${m}
    },
  },`
}

writeFileSync(
  'src/map/posterData.ts',
  `// ─────────────────────────────────────────────────────────────
// v16-K: Poster-Standbilder der Karten-Totale (public/map/poster-*.webp)
// und die dazu passenden Marker-Positionen (Anteil 0..1 der Bildfläche).
// Kamera-Zahlen = Quelle der Wahrheit für die Live-Totale (mapCamera.ts).
// AUTO-GENERIERT von scripts/map-poster.mjs — nicht von Hand pflegen.
// ─────────────────────────────────────────────────────────────

import type { PlaceId } from './places'

export interface PosterClass {
  aspect: number
  src: string
  cam: { pos: [number, number, number]; look: [number, number, number]; fov: number }
  markers: Record<PlaceId, [number, number]>
}

export const MAP_POSTER: Record<'wide' | 'tall', PosterClass> = {
${cls('wide', '16 / 9')}
${cls('tall', '9 / 19.5')}
}
`,
)
console.log('posterData.ts geschrieben')
