#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// v16-W: Walkout-Pipeline. DJI-Dolly-Clips → freigestellte, nahtlos
// loopende Spieler-Videos für Website-Karten und die 3D-Aufstellung.
// Alles lokal (ffmpeg-static, sharp, Apple Vision per JXA) — kein Upload.
//
//   node scripts/walkout/build.mjs                 # alle aus walkout.config.json
//   node scripts/walkout/build.mjs --only malte-pils,elias-pejas
//   node scripts/walkout/build.mjs --atlas-only    # nur Atlas + walkout.ts neu
//   node scripts/walkout/build.mjs --src ~/Desktop/Dolly --work /tmp/sva-walkout
//
// Ausgaben (public/players/walkout/):
//   <slug>.mp4   Stacked-Alpha H.264 (oben Farbe, unten Alpha) — WebGL
//   <slug>.webm  VP9 mit Alpha — DOM (Chrome/Firefox/Edge)
//   <slug>.mov   HEVC mit Alpha — DOM (Safari/iOS)
//   <slug>.webp  Poster (erstes Frame, mit Alpha)
//   atlas.mp4    alle Spieler in einem Raster, stacked alpha — 3D-Aufstellung
// und src/data/walkout.ts (generiert; nur confirmed=true).
// Doku: docs/WALKOUT.md
// ─────────────────────────────────────────────────────────────
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const run = promisify(execFile)
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const require = createRequire(ROOT + '/package.json')
const sharp = require('sharp')
const FF = require('ffmpeg-static')
const SEG = path.join(ROOT, 'scripts/walkout/segment.js')
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/walkout/walkout.config.json'), 'utf8'))

const args = process.argv.slice(2)
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const has = (k) => args.includes(k)
const home = (p) => p.replace(/^~(?=\/)/, os.homedir())
const SRC = home(arg('--src', CFG.src))
const WORK = home(arg('--work', process.env.WALKOUT_WORK || path.join(os.tmpdir(), 'sva-walkout')))
const OUT = path.join(ROOT, 'public/players/walkout')
const ONLY = arg('--only', '')?.split(',').filter(Boolean)
const FPS = 30000 / 1001
const SECONDS = CFG.seconds ?? 2.2
const [CW, CH] = CFG.cell ?? [360, 720]
const MAX_AW = (CFG.atlasCell ?? [192])[0]
// Spieler-Geometrie im Ausgabebild: Scheitel bei 5 %, Sohle bei 96 % der Höhe.
const HEAD_Y = 0.05, FEET_Y = 0.96

fs.mkdirSync(WORK, { recursive: true }); fs.mkdirSync(OUT, { recursive: true })
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
// Wiederholen: Clips auf iCloud-Desktop melden beim ersten Lesen gern „Operation timed out“.
async function ff(a, tries = 4) {
  for (let i = 1; ; i++) {
    try { return await run(FF, ['-v', 'error', '-y', ...a], { maxBuffer: 1 << 26 }) } catch (e) {
      if (i >= tries || !/timed out|Resource temporarily/i.test(String(e.stderr ?? e.message))) throw e
      await new Promise((r) => setTimeout(r, 1500 * i))
    }
  }
}
const osa = (a) => run('osascript', ['-l', 'JavaScript', SEG, ...a], { maxBuffer: 1 << 26 }).then((r) => r.stdout.trim())
const clipFile = (id) => {
  const f = fs.readdirSync(SRC).find((n) => n.includes(`_${id}_`) && /\.mov$/i.test(n))
  if (!f) throw new Error(`Clip ${id} nicht in ${SRC}`)
  return path.join(SRC, f)
}
async function duration(file) {
  for (let i = 1; i <= 5; i++) {
    const r = await run(FF, ['-hide_banner', '-i', file]).catch((e) => e)
    const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(r.stderr ?? '')
    if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3]
    await new Promise((res) => setTimeout(res, 1500 * i)) // iCloud-Desktop: Datei wird erst geladen
  }
  throw new Error(`Dauer von ${file} nicht lesbar`)
}
async function pool(items, n, fn) {
  const out = []; let i = 0
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k) } }))
  return out
}

// ── Maskenwerkzeuge ───────────────────────────────────────────
/** Größte Zusammenhangskomponente (Schwelle 50 %), bevorzugt nahe der
 *  Bildmitte. Liefert bbox + Binärmaske nur dieser Komponente. */
function mainComponent(mask, w, h) {
  const lab = new Int32Array(w * h).fill(-1), comps = []
  const stack = new Int32Array(w * h)
  for (let s = 0; s < w * h; s++) {
    if (mask[s] < 128 || lab[s] >= 0) continue
    const id = comps.length; let sp = 0, area = 0, x0 = w, y0 = h, x1 = 0, y1 = 0, sx = 0
    stack[sp++] = s; lab[s] = id
    while (sp) {
      const p = stack[--sp], x = p % w, y = (p / w) | 0
      area++; sx += x; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]
      for (const q of nb) if (q >= 0 && lab[q] < 0 && mask[q] >= 128) { lab[q] = id; stack[sp++] = q }
    }
    comps.push({ id, area, x0, y0, x1, y1, cx: sx / area })
  }
  if (!comps.length) return null
  const score = (c) => c.area * (1 - 0.8 * Math.min(1, Math.abs(c.cx / w - 0.5) * 2))
  const best = comps.sort((a, b) => score(b) - score(a))[0]
  const bin = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) if (lab[i] === best.id) bin[i] = 255
  return { ...best, bin }
}
async function readGrey(file, w, h) {
  let s = sharp(file).greyscale()
  if (w) s = s.resize(w, h, { fit: 'fill' })
  const { data, info } = await s.raw().toBuffer({ resolveWithObject: true })
  return { data: data.length === info.width * info.height ? data : extractChannel(data, info.channels), w: info.width, h: info.height }
}
/** Ausschnitt aus Rohpuffer; außerhalb liegende Pixel = 0 (Kante bleibt erhalten). */
function cropRaw(buf, w, h, ch, r) {
  const out = Buffer.alloc(r.width * r.height * ch)
  const x0 = Math.max(0, r.left), x1 = Math.min(w, r.left + r.width)
  if (x1 <= x0) return out
  for (let y = 0; y < r.height; y++) {
    const sy = r.top + y
    if (sy < 0 || sy >= h) continue
    buf.copy(out, (y * r.width + (x0 - r.left)) * ch, (sy * w + x0) * ch, (sy * w + x1) * ch)
  }
  return out
}
function extractChannel(buf, ch) { const o = Buffer.alloc(buf.length / ch); for (let i = 0; i < o.length; i++) o[i] = buf[i * ch]; return o }
const movAvg = (arr, r) => arr.map((_, i) => { let s = 0, n = 0; for (let j = Math.max(0, i - r); j <= Math.min(arr.length - 1, i + r); j++) { s += arr[j]; n++ } return s / n })

const ANA_VERSION = 2
// ── 1. Analyse: welcher Clip, welches Fenster ist am ruhigsten? ──
async function analyzeClip(clipId) {
  const dir = path.join(WORK, 'ana', clipId), cache = path.join(dir, 'ana.json')
  if (fs.existsSync(cache)) { const c = JSON.parse(fs.readFileSync(cache, 'utf8')); if (c.v === ANA_VERSION) return c }
  fs.mkdirSync(path.join(dir, 'f'), { recursive: true }); fs.mkdirSync(path.join(dir, 'm'), { recursive: true })
  const file = clipFile(clipId), dur = await duration(file)
  await ff(['-i', file, '-map', '0:v:0', '-vf', 'fps=10,scale=960:540', '-q:v', '3', path.join(dir, 'f/%04d.jpg')])
  await osa(['fg', path.join(dir, 'f'), path.join(dir, 'm')])
  const frames = []
  for (const f of fs.readdirSync(path.join(dir, 'f')).sort()) {
    const mf = path.join(dir, 'm', f.replace('.jpg', '.png'))
    if (!fs.existsSync(mf)) { frames.push(null); continue }
    const m = await readGrey(mf, 960, 540), c = mainComponent(m.data, m.w, m.h)
    if (!c || c.area < 2000) { frames.push(null); continue }
    // Kontrast der Person (Luma-Streuung) — Gegenlicht/Dunst senkt ihn
    const st = await sharp(path.join(dir, 'f', f)).extract({ left: c.x0, top: c.y0, width: c.x1 - c.x0 + 1, height: c.y1 - c.y0 + 1 }).greyscale().stats()
    frames.push({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1, lm: st.channels[0].mean, ls: st.channels[0].stdev })
  }
  const res = { v: ANA_VERSION, clipId, file, dur, frames }
  fs.writeFileSync(cache, JSON.stringify(res))
  return res
}
/** Fenster mit der geringsten Bewegung (Mitte, Größe, Fußpunkt), Person
 *  vollständig im Bild (nicht am Rand abgeschnitten). */
function bestWindow(ana) {
  const n = Math.round(SECONDS * 10), fr = ana.frames
  let best = null
  for (let s = 1; s + n < fr.length - 1; s++) {
    const win = fr.slice(s, s + n)
    if (win.some((b) => !b || b.y0 < 4 || b.y1 > 535 || b.x0 < 4 || b.x1 > 955)) continue
    const hgt = win.map((b) => b.y1 - b.y0), H = hgt.reduce((a, b) => a + b) / n
    const sd = (a) => { const m = a.reduce((x, y) => x + y) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) }
    const cx = win.map((b) => (b.x0 + b.x1) / 2), foot = win.map((b) => b.y1), wid = win.map((b) => b.x1 - b.x0)
    let jit = 0; for (let i = 1; i < n; i++) jit += Math.abs(hgt[i] - hgt[i - 1]) + Math.abs(cx[i] - cx[i - 1]) + Math.abs(wid[i] - wid[i - 1])
    // + Helligkeits-/Dunstschwankung (pumpt im Loop) und geringer Kontrast
    const lm = win.map((b) => b.lm ?? 0), ls = win.map((b) => b.ls ?? 1), mls = ls.reduce((a, b) => a + b) / n
    const score = (sd(hgt) + sd(cx) + sd(foot) + sd(wid) + jit / n) / H + (sd(lm) + sd(ls)) / 255 * 0.5 + Math.max(0, 40 - mls) / 255 * 0.3
    if (!best || score < best.score) best = { start: s / 10, score, H }
  }
  return best
}

// ── 2. Spieler bauen ──────────────────────────────────────────
async function buildPlayer(p) {
  const anas = await Promise.all(p.clips.map(analyzeClip))
  let pick = null
  for (const a of anas) {
    const w = p.clip === a.clipId && p.start != null ? { start: p.start, score: 0 } : bestWindow(a)
    if (!w) continue
    // kleiner Bonus für größere Darstellung (mehr Pixel am Spieler)
    const sc = w.score - (w.H ?? 0) / 540 * 0.002
    if (p.clip && p.clip !== a.clipId) continue
    if (!pick || sc < pick.sc) pick = { ...w, sc, ana: a }
  }
  if (!pick) throw new Error(`${p.slug}: kein brauchbares Fenster`)
  const { ana, start } = pick
  log(p.slug, `Clip ${ana.clipId} ab ${start.toFixed(1)} s (Unruhe ${pick.score.toFixed(4)})`)

  // Arbeitsausschnitt in 4K: Vereinigung der Boxen im Fenster + Rand
  const win = ana.frames.slice(Math.round(start * 10), Math.round((start + SECONDS) * 10)).filter(Boolean)
  const k = 4 // 960 → 3840
  const ux0 = Math.min(...win.map((b) => b.x0)) * k, ux1 = Math.max(...win.map((b) => b.x1)) * k
  const uy0 = Math.min(...win.map((b) => b.y0)) * k, uy1 = Math.max(...win.map((b) => b.y1)) * k
  const padY = (uy1 - uy0) * 0.12, padX = Math.max((uy1 - uy0) * 0.3, (ux1 - ux0) * 0.25)
  const R = { x: Math.max(0, Math.floor(ux0 - padX)), y: Math.max(0, Math.floor(uy0 - padY)) }
  R.w = Math.min(3840, Math.ceil(ux1 + padX)) - R.x; R.h = Math.min(2160, Math.ceil(uy1 + padY)) - R.y
  R.w -= R.w % 2; R.h -= R.h % 2

  const dir = path.join(WORK, 'p', p.slug)
  fs.rmSync(dir, { recursive: true, force: true })
  for (const d of ['src', 'mask', 'rgba', 'stack', 'seq']) fs.mkdirSync(path.join(dir, d), { recursive: true })
  const N = Math.round(SECONDS * FPS)
  await ff(['-ss', String(start), '-i', ana.file, '-map', '0:v:0', '-frames:v', String(N), '-vf', `crop=${R.w}:${R.h}:${R.x}:${R.y}`, path.join(dir, 'src/%04d.png')])
  const out = await osa(['fg', path.join(dir, 'src'), path.join(dir, 'mask')])
  if (!out.startsWith('ok')) log(p.slug, 'Vision:', out.split('\n').slice(0, 3).join(' | '))
  const files = fs.readdirSync(path.join(dir, 'src')).sort()

  // Maske je Frame → Hauptkomponente, bbox
  const per = []
  for (const f of files) {
    const m = await readGrey(path.join(dir, 'mask', f), R.w, R.h)
    const c = mainComponent(m.data, m.w, m.h)
    if (!c) throw new Error(`${p.slug}: leere Maske in ${f}`)
    // weiche Maske nur innerhalb der (leicht geweiteten) Hauptkomponente
    const grow = await sharp(Buffer.from(c.bin), { raw: { width: m.w, height: m.h, channels: 1 } }).blur(3).extractChannel(0).raw().toBuffer()
    const soft = Buffer.alloc(m.w * m.h)
    for (let i = 0; i < soft.length; i++) soft[i] = grow[i] > 8 ? m.data[i] : 0
    per.push({ f, soft, x0: c.x0, x1: c.x1, y0: c.y0, y1: c.y1 })
  }
  // Glätten: Größe stark (kein Pumpen), Lage leicht (kein Zittern)
  const hS = movAvg(per.map((q) => q.y1 - q.y0), 12)
  const cxS = movAvg(per.map((q) => (q.x0 + q.x1) / 2), 4)
  const ftS = movAvg(per.map((q) => q.y1), 4)

  // Je Frame auf einheitliche Spielerhöhe in CW×CH ausrichten
  const alphas = [], colors = []
  for (const [i, q] of per.entries()) {
    const scale = (CH * (FEET_Y - HEAD_Y)) / hS[i]
    const sw = CW / scale, sh = CH / scale
    const rect = { left: Math.round(cxS[i] - sw / 2), top: Math.round(ftS[i] - FEET_Y * sh), width: Math.round(sw), height: Math.round(sh) }
    const src = await sharp(path.join(dir, 'src', q.f)).removeAlpha().raw().toBuffer()
    const rgb = await sharp(cropRaw(src, R.w, R.h, 3, rect), { raw: { width: rect.width, height: rect.height, channels: 3 } })
      .resize(CW, CH, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer()
    const a = await sharp(cropRaw(q.soft, R.w, R.h, 1, rect), { raw: { width: rect.width, height: rect.height, channels: 1 } })
      .resize(CW, CH, { fit: 'fill' }).extractChannel(0).raw().toBuffer()
    colors.push(rgb); alphas.push(a)
  }

  // Helligkeit/Kontrast je Frame auf das kontrastreichste Frame angleichen
  // (Gegenlicht-Dunst wechselt beim Drohnenflug → sonst pumpt der Loop)
  {
    const px0 = CW * CH
    const stats = colors.map((C, i) => {
      const A = alphas[i]; const m = [0, 0, 0], q = [0, 0, 0]; let n = 0
      for (let j = 0; j < px0; j++) if (A[j] > 200) { n++; for (let c = 0; c < 3; c++) { const v = C[j * 3 + c]; m[c] += v; q[c] += v * v } }
      const mean = m.map((v) => v / Math.max(1, n)), sdv = q.map((v, c) => Math.sqrt(Math.max(1, v / Math.max(1, n) - mean[c] ** 2)))
      return { mean, sd: sdv, contrast: sdv.reduce((a, b) => a + b) }
    })
    const ref = stats.reduce((a, b) => (b.contrast > a.contrast ? b : a))
    // Ziel = kontrastreichstes Frame; Korrektur geglättet (kein Springen)
    const gain = [0, 1, 2].map((c) => movAvg(stats.map((st) => ref.sd[c] / st.sd[c]), 3))
    const off = [0, 1, 2].map((c) => movAvg(stats.map((st) => st.mean[c]), 3))
    colors.forEach((C, i) => {
      for (let j = 0; j < px0; j++) for (let c = 0; c < 3; c++) {
        const v = (C[j * 3 + c] - off[c][i]) * gain[c][i] + ref.mean[c]
        C[j * 3 + c] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v)
      }
    })
  }

  // Zeitliche Glättung der Alpha-Kanten (gegen Flackern) + Kantenkurve
  const Wt = [1, 2, 4, 2, 1], px = CW * CH
  const smooth = (v) => { const t = Math.min(1, Math.max(0, (v - 0.3) / 0.45)); return t * t * (3 - 2 * t) }
  const spill = p.spill !== false
  for (let i = 0; i < per.length; i++) {
    const A = Buffer.alloc(px)
    for (let j = 0; j < px; j++) {
      let s = 0, n = 0
      for (let d = -2; d <= 2; d++) { const k2 = i + d; if (k2 < 0 || k2 >= per.length) continue; s += alphas[k2][j] * Wt[d + 2]; n += Wt[d + 2] }
      A[j] = Math.round(smooth(s / n / 255) * 255)
    }
    const C = Buffer.from(colors[i])
    // Grünstich (Rasen) an halbtransparenten Kanten entfernen
    if (spill) for (let j = 0; j < px; j++) {
      if (A[j] > 0 && A[j] < 250) { const r = C[j * 3], g = C[j * 3 + 1], b = C[j * 3 + 2], lim = Math.max(r, b); if (g > lim) C[j * 3 + 1] = lim }
    }
    // Hintergrund mit ausgedehnter Randfarbe füllen (kein dunkler Saum beim Sampeln)
    const pre = Buffer.alloc(px * 3)
    for (let j = 0; j < px; j++) for (let c = 0; c < 3; c++) pre[j * 3 + c] = Math.round(C[j * 3 + c] * A[j] / 255)
    const bp = await sharp(pre, { raw: { width: CW, height: CH, channels: 3 } }).blur(14).raw().toBuffer()
    const ba = await sharp(A, { raw: { width: CW, height: CH, channels: 1 } }).blur(14).extractChannel(0).raw().toBuffer()
    for (let j = 0; j < px; j++) if (A[j] < 8) for (let c = 0; c < 3; c++) C[j * 3 + c] = ba[j] > 0 ? Math.min(255, Math.round(bp[j * 3 + c] * 255 / ba[j])) : 40
    const nm = String(i + 1).padStart(4, '0')
    const rgba = Buffer.alloc(px * 4)
    for (let j = 0; j < px; j++) { rgba[j * 4] = C[j * 3]; rgba[j * 4 + 1] = C[j * 3 + 1]; rgba[j * 4 + 2] = C[j * 3 + 2]; rgba[j * 4 + 3] = A[j] }
    await sharp(rgba, { raw: { width: CW, height: CH, channels: 4 } }).png({ compressionLevel: 3 }).toFile(path.join(dir, 'rgba', nm + '.png'))
    const st = Buffer.alloc(px * 6)
    C.copy(st, 0); for (let j = 0; j < px; j++) st.fill(A[j], px * 3 + j * 3, px * 3 + j * 3 + 3)
    await sharp(st, { raw: { width: CW, height: CH * 2, channels: 3 } }).png({ compressionLevel: 3 }).toFile(path.join(dir, 'stack', nm + '.png'))
  }

  // Ping-Pong-Reihenfolge (0…N-1, N-2…1) → nahtloser Loop
  const order = [...files.keys(), ...[...files.keys()].reverse().slice(1, -1)]
  for (const sub of ['rgba', 'stack']) {
    const sd = path.join(dir, 'seq', sub); fs.mkdirSync(sd, { recursive: true })
    order.forEach((src, i) => fs.symlinkSync(path.join(dir, sub, String(src + 1).padStart(4, '0') + '.png'), path.join(sd, String(i + 1).padStart(4, '0') + '.png')))
  }
  await encodePlayer(p, dir)
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ clip: ana.clipId, start, frames: order.length, score: pick.score }))
  return { clip: ana.clipId, start, frames: order.length }
}

async function encodePlayer(p, dir) {
  const rate = ['-framerate', '30000/1001']
  // Unbestätigte Zuordnungen landen NICHT in public/ (sonst stünde ein evtl.
  // falscher Name im Dateinamen online) — sondern im Arbeitsordner zur Ansicht.
  const dest = p.confirmed ? OUT : path.join(WORK, 'unbestaetigt')
  fs.mkdirSync(dest, { recursive: true })
  const o = (ext) => path.join(dest, `${p.slug}.${ext}`)
  // Stacked-Alpha H.264 (WebGL). Graustufen-Alpha in der unteren Hälfte.
  await ff([...rate, '-i', path.join(dir, 'seq/stack/%04d.png'), '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '27', '-tune', 'film',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-g', '260', '-movflags', '+faststart', '-an', o('mp4')])
  // VP9 mit Alpha (DOM: Chrome/Firefox/Edge)
  await ff([...rate, '-i', path.join(dir, 'seq/rgba/%04d.png'), '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', String(CFG.vp9Crf ?? 44),
    '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-auto-alt-ref', '0', '-g', '260', '-an', o('webm')])
  // HEVC mit Alpha (DOM: Safari/iOS): ProRes 4444 → avconvert
  const prores = path.join(dir, 'master4444.mov')
  await ff([...rate, '-i', path.join(dir, 'seq/rgba/%04d.png'), '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-an', prores])
  await hevcAlpha(prores, o('mov'))
  // Poster (erstes Frame, Alpha)
  await sharp(path.join(dir, 'rgba/0001.png')).webp({ quality: 82, alphaQuality: 90 }).toFile(o('webp'))
}

async function hevcAlpha(prores, out) {
  // Bevorzugt: VideoToolbox über ffmpeg (steuerbare Bitrate). Rückfall: avconvert.
  try {
    await ff(['-i', prores, '-c:v', 'hevc_videotoolbox', '-alpha_quality', String(CFG.hevcAlphaQ ?? 0.3), '-b:v', CFG.hevcBitrate ?? '200k', '-pix_fmt', 'bgra',
      '-tag:v', 'hvc1', '-movflags', '+faststart', '-an', out])
    return
  } catch (e) { log('hevc_videotoolbox nicht nutzbar, nehme avconvert:', String(e.message).split('\n')[0]) }
  await run('avconvert', ['--source', prores, '--preset', 'PresetHEVCHighestQualityWithAlpha', '--output', out, '--replace'])
}

// ── 3. Atlas (ein Dekoder für die ganze Elf) ───────────────────
async function buildAtlas(list) {
  const ok = list.filter((p) => fs.existsSync(path.join(WORK, 'p', p.slug, 'meta.json')))
  if (!ok.length) return null
  // Raster so wählen, dass die Zellen (1:2) innerhalb 2048 px Kantenlänge
  // (Farbe + Alpha übereinander) möglichst groß werden; Obergrenze atlasCell.
  let cols = 1, AW = 0
  for (let c = 1; c <= 16; c++) {
    const r = Math.ceil(ok.length / c)
    const w = Math.min(MAX_AW, Math.floor(Math.min(2048 / c, 2048 / (r * 4)) / 16) * 16)
    if (w > AW) { AW = w; cols = c }
  }
  const AH = AW * 2, rows = Math.ceil(ok.length / cols)
  if (AW < 64) throw new Error(`Zu viele Spieler für einen Atlas (${ok.length}) — zweiten Atlas einführen`)
  const W = cols * AW, H = rows * AH
  const metas = ok.map((p) => JSON.parse(fs.readFileSync(path.join(WORK, 'p', p.slug, 'meta.json'), 'utf8')))
  const frames = Math.min(...metas.map((m) => m.frames))
  const dir = path.join(WORK, 'atlas'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true })
  log(`Atlas ${cols}×${rows} Zellen à ${AW}×${AH} → ${W}×${H * 2}, ${frames} Frames`)
  await pool([...Array(frames).keys()], 6, async (fi) => {
    const nm = String(fi + 1).padStart(4, '0'), comp = []
    for (const [i, p] of ok.entries()) {
      const src = path.join(WORK, 'p', p.slug, 'seq/stack', nm + '.png')
      const x = (i % cols) * AW, y = Math.floor(i / cols) * AH
      const col = await sharp(src).extract({ left: 0, top: 0, width: CW, height: CH }).resize(AW, AH, { kernel: 'lanczos3' }).toBuffer()
      const al = await sharp(src).extract({ left: 0, top: CH, width: CW, height: CH }).resize(AW, AH, { kernel: 'lanczos3' }).toBuffer()
      comp.push({ input: col, left: x, top: y }, { input: al, left: x, top: H + y })
    }
    await sharp({ create: { width: W, height: H * 2, channels: 3, background: { r: 0, g: 0, b: 0 } } }).composite(comp).png({ compressionLevel: 3 }).toFile(path.join(dir, nm + '.png'))
  })
  await ff(['-framerate', '30000/1001', '-i', path.join(dir, '%04d.png'), '-c:v', 'libx264', '-preset', 'veryslow', '-crf', String(CFG.atlasCrf ?? 26),
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-g', '260', '-movflags', '+faststart', '-an', path.join(OUT, 'atlas.mp4')])
  return { cols, rows, cellW: AW, cellH: AH, width: W, height: H * 2, frames, ids: ok.map((p) => p.id) }
}

// ── 4. src/data/walkout.ts schreiben ──────────────────────────
function writeManifest(atlas) {
  const ok = CFG.players.filter((p) => p.confirmed && fs.existsSync(path.join(OUT, `${p.slug}.mp4`)))
  const ver = Date.now().toString(36)
  const entries = ok.map((p) => `  '${p.id}': { slug: '${p.slug}' },`).join('\n')
  const atlasIds = atlas ? atlas.ids : []
  const ts = `// ─────────────────────────────────────────────────────────────
// GENERIERT von scripts/walkout/build.mjs — nicht von Hand pflegen.
// v16-W: Walkout-Videos (freigestellte Dolly-Clips). Nur bestätigte
// Zuordnungen (walkout.config.json → confirmed: true). Doku: docs/WALKOUT.md
// ─────────────────────────────────────────────────────────────

export interface WalkoutAsset {
  slug: string
}

/** v17-D: Walkout-Videos in Karten/Hover/Modal zeigen? Aus, bis die
 *  Greenscreen-Aufnahmen da sind (Dolly-Clips zu unscharf) — dann zeigen
 *  die Karten die scharfen Foto-Freisteller. Code + Assets bleiben.
 *  (Die 3D-Aufstellung auf /live nutzt den Atlas unabhängig davon.) */
export const WALKOUT_ENABLED = false

/** Cache-Buster der aktuellen Asset-Generation. */
export const WALKOUT_VERSION = '${ver}'
export const WALKOUT_BASE = '/players/walkout/'
/** Bildformat je Spieler-Video (Breite × Höhe; Spieler Scheitel ${HEAD_Y * 100} % … Sohle ${FEET_Y * 100} %). */
export const WALKOUT_SIZE = { w: ${CW}, h: ${CH}, headY: ${HEAD_Y}, feetY: ${FEET_Y} } as const

export const WALKOUT: Record<string, WalkoutAsset> = {
${entries}
}

/** Atlas für die 3D-Aufstellung: oben Farbe, unten Alpha; Zellen zeilenweise. */
export const WALKOUT_ATLAS = ${atlas ? `{
  src: '/players/walkout/atlas.mp4?v=${ver}',
  cols: ${atlas.cols},
  rows: ${atlas.rows},
  width: ${atlas.width},
  height: ${atlas.height},
  frames: ${atlas.frames},
  /** Player-/Staff-id → Zellindex (nur bestätigte). */
  cells: {
${atlasIds.map((id, i) => [id, i]).filter(([id]) => ok.some((p) => p.id === id)).map(([id, i]) => `    '${id}': ${i},`).join('\n')}
  } as Record<string, number>,
}` : 'null'}

export function walkoutSources(id: string): { mp4: string; webm: string; mov: string; poster: string } | null {
  const a = WALKOUT[id]
  if (!a) return null
  const b = WALKOUT_BASE + a.slug
  const v = '?v=' + WALKOUT_VERSION
  return { mp4: b + '.mp4' + v, webm: b + '.webm' + v, mov: b + '.mov' + v, poster: b + '.webp' + v }
}
`
  fs.writeFileSync(path.join(ROOT, 'src/data/walkout.ts'), ts)
  log(`src/data/walkout.ts: ${ok.length} Spieler`)
}

// ── main ──────────────────────────────────────────────────────
const list = CFG.players.filter((p) => !ONLY.length || ONLY.includes(p.slug))
if (!has('--atlas-only')) {
  // Analyse parallel (ffmpeg + Vision), Bau mit begrenzter Parallelität
  await pool([...new Set(list.flatMap((p) => p.clips))], 4, analyzeClip)
  await pool(list, 3, async (p) => { try { await buildPlayer(p) } catch (e) { log('FEHLER', p.slug, e.message) } })
}
const atlas = await buildAtlas(CFG.players.filter((p) => p.confirmed))
writeManifest(atlas)
const sizes = fs.readdirSync(OUT).map((f) => [f, fs.statSync(path.join(OUT, f)).size]).sort()
for (const [f, s] of sizes) console.log(`${(s / 1024).toFixed(0).padStart(6)} KB  ${f}`)
