#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// v17-G: Vorher/Nachher-Kantenvergleich der Greenscreen-Pipeline.
//   Vorher  = reiner ffmpeg-Key (chromakey + despill, eine Key-Farbe)
//   Nachher = Pipeline (Ratio-Key gegen Platte + Vision-Plausibilität +
//             zeitliche Glättung + Entmischung + Spill-Unterdrückung)
// Eingabe: <work>/p/<slug>/cmp (quelle-*.jpg + nachher-*.png, von build.mjs)
//
//   node scripts/greenscreen/compare.mjs <cmp-ordner> <ausgabe.png> [x,y,w,h ...]
// Ohne Regionen: Haar-Oberkante, Schulter/Arm-Kante, Rumpfmitte, Stativ-Seite
// (automatisch aus der Alpha-Box). Zoom 3× auf grauem + dunkelrotem Grund.
// ─────────────────────────────────────────────────────────────
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const run = promisify(execFile)
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const require = createRequire(ROOT + '/package.json')
const sharp = require('sharp')
const FF = require('ffmpeg-static')

const [dir, out, ...regArgs] = process.argv.slice(2)
if (!dir || !out) throw new Error('Aufruf: compare.mjs <cmp-ordner> <ausgabe.png> [x,y,w,h ...]')
const q = fs.readdirSync(dir).filter((f) => f.startsWith('quelle-')).sort()[0]
const n = fs.readdirSync(dir).filter((f) => f.startsWith('nachher-')).sort()[0]
const src = path.join(dir, q), after = path.join(dir, n)
const { data: rgb, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const W = info.width, H = info.height

// Key-Farbe = Median der linken/rechten oberen Ecke
const sam = [[], [], []]
for (let y = 0; y < H * 0.06; y++) for (const x of [4, 10, W - 10, W - 4]) for (let c = 0; c < 3; c++) sam[c].push(rgb[(y * W + x) * 3 + c])
const med = (a) => a.sort((x, y) => x - y)[a.length >> 1]
const hex = '0x' + sam.map(med).map((v) => v.toString(16).padStart(2, '0')).join('')
const before = path.join(dir, 'vorher-ffmpeg.png')
await run(FF, ['-v', 'error', '-y', '-i', src, '-vf', `format=yuva444p,chromakey=${hex}:0.11:0.07,despill=type=green,format=rgba`, '-frames:v', '1', before])

// Regionen automatisch aus der Alpha-Box (Nachher)
const { data: A } = await sharp(after).extractChannel(3).raw().toBuffer({ resolveWithObject: true })
let x0 = W, x1 = 0, y0 = H
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A[y * W + x] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y }
const S = Math.round(W * 0.2)
let regs = regArgs.map((r) => { const [x, y, w, h] = r.split(',').map(Number); return { x, y, w, h } })
if (!regs.length) {
  const cx = (x0 + x1) >> 1
  // Kontur links auf halber Höhe
  const ym = Math.round(y0 + (H - y0) * 0.42)
  let xl = 0; while (xl < W - 1 && A[ym * W + xl] <= 128) xl++
  // Artefakt-Zelle: meiste NICHT-grüne Quellpixel, die die Pipeline entfernt (Stativ, Tuchkante, Wand)
  let art = null
  for (let gy = 0; gy + S <= H; gy += S >> 1) for (let gx = 0; gx + S <= W; gx += S >> 1) {
    let c = 0
    for (let y = gy; y < gy + S; y += 3) for (let x = gx; x < gx + S; x += 3) {
      const i = y * W + x, r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2]
      if (A[i] === 0 && (g - Math.max(r, b)) / (g + 20) < 0.1) c++
    }
    if (!art || c > art.c) art = { c, x: gx, y: gy }
  }
  // Hinweis-Region (grünliche Stelle): grünster Pixelhaufen INNERHALB der Person
  let gp = null
  for (let gy = 0; gy + S <= H; gy += S >> 2) for (let gx = 0; gx + S <= W; gx += S >> 2) {
    let c = 0
    for (let y = gy; y < gy + S; y += 3) for (let x = gx; x < gx + S; x += 3) {
      const i = y * W + x, r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2]
      if (A[i] > 200 && g > Math.max(r, b) + 25) c++
    }
    if (!gp || c > gp.c) gp = { c, x: gx, y: gy }
  }
  regs = [
    { x: cx - S / 2, y: y0 - S * 0.25, w: S, h: S, l: 'Haar / Scheitel' },
    { x: xl - S / 2, y: ym - S / 2, w: S, h: S, l: 'Körperkontur' },
  ]
  if (gp && gp.c > 20) regs.push({ x: gp.x, y: gp.y, w: S, h: S, l: 'grünliche Stelle im Trikot (darf kein Loch werden)' })
  if (art && art.c > 20) regs.push({ x: art.x, y: art.y, w: S, h: S, l: 'Stativ / Tuchkante (muss weg)' })
}
regs = regs.map((r) => ({ ...r, x: Math.max(0, Math.min(W - r.w, Math.round(r.x))), y: Math.max(0, Math.min(H - r.h, Math.round(r.y))), w: Math.round(r.w), h: Math.round(r.h) }))

const Z = 3, T = S * Z, pad = 12, head = 44
async function tile(file, r, bg) {
  const crop = await sharp(file).extract({ left: r.x, top: r.y, width: r.w, height: r.h }).resize(T, T, { kernel: 'nearest' }).png().toBuffer()
  return sharp({ create: { width: T, height: T, channels: 3, background: bg } }).composite([{ input: crop }]).png().toBuffer()
}
const cols = [['Quelle', src, null], ['Vorher: ffmpeg chromakey+despill', before, '#808080'], ['Nachher: Pipeline', after, '#808080'], ['Vorher auf Dunkelrot', before, '#5a0d12'], ['Nachher auf Dunkelrot', after, '#5a0d12']]
const comp = []
const WW = pad + cols.length * (T + pad), HH = head + regs.length * (T + pad + 26) + pad
for (const [ci, [label]] of cols.entries()) comp.push({ input: Buffer.from(`<svg width="${T}" height="${head}" xmlns="http://www.w3.org/2000/svg"><text x="0" y="30" font-family="Helvetica" font-weight="700" font-size="22" fill="#fff">${label}</text></svg>`), left: pad + ci * (T + pad), top: 4 })
for (const [ri, r] of regs.entries()) {
  const top = head + ri * (T + pad + 26)
  comp.push({ input: Buffer.from(`<svg width="${WW}" height="24" xmlns="http://www.w3.org/2000/svg"><text x="${pad}" y="18" font-family="Helvetica" font-size="18" fill="#bbb">${r.l ?? `Region ${ri + 1}`} (${r.x},${r.y} ${r.w}×${r.h}, ${Z}×)</text></svg>`), left: 0, top })
  for (const [ci, [, file, bg]] of cols.entries()) {
    comp.push({ input: bg ? await tile(file, r, bg) : await sharp(file).extract({ left: r.x, top: r.y, width: r.w, height: r.h }).resize(T, T, { kernel: 'nearest' }).png().toBuffer(), left: pad + ci * (T + pad), top: top + 26 })
  }
}
await sharp({ create: { width: WW, height: HH, channels: 3, background: '#141212' } }).composite(comp).png().toFile(out)
console.log('→', out, `(${regs.length} Regionen, Key ${hex})`)
