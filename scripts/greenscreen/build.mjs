#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// v17-G: Greenscreen-Pipeline. Training-Dreh (docs/GREENSCREEN_DREHPLAN.md)
// → freigestellte Spieler-Assets für Karten, Album, Aufstellung, Tor-Videos.
// Alles lokal (ffmpeg-static, sharp, Apple Vision per JXA) — kein Upload.
//
//   node scripts/greenscreen/build.mjs                    # alles aus ~/Desktop/Greenscreen
//   node scripts/greenscreen/build.mjs --dry              # nur Zuordnung + Take-Erkennung
//   node scripts/greenscreen/build.mjs --only IMG_0101.MOV,p-helck
//   node scripts/greenscreen/build.mjs --src /Volumes/SD --work ~/gs-work --jobs 2
//   node scripts/greenscreen/build.mjs --registry-only    # nur src/data/greenscreen.ts neu
//
// Ablauf je Clip: Analyse (10 fps, klein) → Rückennummer (Vision-OCR, Finger
// als Rückfall) → Spieler → 7 Takes (Bewegungsenergie/Silhouette, DP über die
// Reihenfolge des Drehplans) → je Take Frames in Arbeitsauflösung → Key:
//   ffmpeg-chromakey (Hintergrund-Klassifikation) + eigener Ratio-Key gegen
//   eine lokale Hintergrund-Platte (Lichtverlauf, Schatten) + Vision-Personen-
//   maske als Plausibilität (außen weg: Stativ/Tuchkanten; innen voll: keine
//   Löcher bei grünlichen Stellen) + zeitliche Glättung + Kanten-Entmischung +
//   Spill-Unterdrückung → WebM-VP9-Alpha, HEVC-Alpha (.mov), Stacked-MP4, Poster.
// Ausgaben: public/players/gs/<slug>/ + src/data/greenscreen.ts (generiert).
// Doku: docs/GREENSCREEN.md · Zuordnung: docs/GREENSCREEN_ZUORDNUNG.md
// ─────────────────────────────────────────────────────────────
import { execFile, spawn } from 'node:child_process'
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
const VISION = path.join(ROOT, 'scripts/greenscreen/vision.js')
const OVERRIDE_FILE = path.join(ROOT, 'scripts/greenscreen/zuordnung.json')
const DOC_ZUORDNUNG = path.join(ROOT, 'docs/GREENSCREEN_ZUORDNUNG.md')
const OUT = path.join(ROOT, 'public/players/gs')
const REGISTRY = path.join(ROOT, 'src/data/greenscreen.ts')

const args = process.argv.slice(2)
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const has = (k) => args.includes(k)
const home = (p) => p.replace(/^~(?=\/|$)/, os.homedir())
const SRC = path.resolve(home(arg('--src', '~/Desktop/Greenscreen')))
const WORK = path.resolve(home(arg('--work', process.env.GS_WORK || path.join(os.tmpdir(), 'sva-greenscreen'))))
const ONLY = (arg('--only', '') || '').split(',').filter(Boolean)
const JOBS = +arg('--jobs', '1')
const DRY = has('--dry')
const KEEP = has('--keep')
const COMPARE = !has('--no-compare')

// Ausgabe-Geometrie (Karten-kompatibel zu WALKOUT_SIZE: 1:2, Scheitel 5 %, Sohle 96 %)
export const GS = { w: 720, h: 1440, headY: 0.05, feetY: 0.96, fps: 30 }
const WORK_SCALE = 1.5 // Key in 1,5-facher Ausgabeauflösung, dann premultipliziert verkleinern
const STORY = { w: 1080, h: 1920 } // Jubel (Tor-Videos) im Story-Format
const CARD = { w: 800, h: 1200, head: 0.185, bottom: 0.815 } // wie public/players/cutout/*
// Takes laut Drehplan (Sollдauer s)
const TAKES = [
  { n: 1, key: 'stand', soll: 5, art: 'still' },
  { n: 2, key: 'kopf', soll: 4, art: 'nick' },
  { n: 3, key: 'walkout', soll: 5, art: 'gehen' },
  { n: 4, key: 'jubel', soll: 5, art: 'jubel' },
  { n: 5, key: 'zeigen', soll: 3, art: 'still' },
  { n: 6, key: 'ball', soll: 3, art: 'ball' },
  { n: 7, key: 'seite', soll: 3, art: 'seite' },
]

fs.mkdirSync(WORK, { recursive: true })
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

// ── Werkzeuge ─────────────────────────────────────────────────
async function ff(a) {
  return run(FF, ['-v', 'error', '-y', ...a], { maxBuffer: 1 << 26 })
}
const vision = (a) => run('osascript', ['-l', 'JavaScript', VISION, ...a], { maxBuffer: 1 << 28 }).then((r) => r.stdout.trim())
async function pool(items, n, fn) {
  const out = []; let i = 0
  await Promise.all(Array.from({ length: Math.max(1, n) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k) } }))
  return out
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smoothstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t) }
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0 }
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0 }
const even = (v) => Math.max(2, Math.round(v / 2) * 2)

/** Stream-Infos (nach Auto-Rotation: Hochkant-Clips kommen hochkant an). */
async function probe(file) {
  const r = await run(FF, ['-hide_banner', '-i', file]).catch((e) => e)
  const s = String(r.stderr ?? '')
  const dur = /Duration: (\d+):(\d+):([\d.]+)/.exec(s)
  const v = /Stream #\d+:\d+[^:]*: Video: ([^\n]+)/.exec(s)?.[1] ?? ''
  const wh = /, (\d{2,5})x(\d{2,5})[ ,]/.exec(v)
  const fps = /([\d.]+) fps/.exec(v)
  const rot = /rotation of (-?[\d.]+)|rotate\s*:\s*(-?\d+)/.exec(s)
  const deg = rot ? Math.abs(Math.round(+(rot[1] ?? rot[2]))) % 180 : 0
  let w = wh ? +wh[1] : 0, h = wh ? +wh[2] : 0
  if (deg === 90) [w, h] = [h, w]
  const hdr = /arib-std-b67|smpte2084|bt2020/.test(v)
  const created = /com\.apple\.quicktime\.creationdate\s*:\s*(\S+)/.exec(s)?.[1] ?? /creation_time\s*:\s*(\S+)/.exec(s)?.[1] ?? null
  return { dur: dur ? +dur[1] * 3600 + +dur[2] * 60 + +dur[3] : 0, w, h, fps: fps ? +fps[1] : 30, hdr, created }
}
/** HLG/PQ (iPhone-HDR) → SDR BT.709 (Referenzweiß 203 nits nach BT.2408; Spitzlichter
 *  clippen — für Greenscreen im Schatten unkritisch). Getestet mit synthetischem HLG-Clip. */
const tonemap = (on) => (on ? ['zscale=t=bt709:p=bt709:m=bt709:r=tv:npl=203'] : [])

/** Rohframes (rgb24) aus ffmpeg lesen, je Frame Callback. */
function rawFrames(argv, fw, fh, onFrame) {
  return new Promise((resolve, reject) => {
    const p = spawn(FF, ['-v', 'error', ...argv, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'])
    const size = fw * fh * 3
    let buf = Buffer.alloc(0), n = 0, err = ''
    p.stdout.on('data', (d) => {
      buf = buf.length ? Buffer.concat([buf, d]) : d
      while (buf.length >= size) { onFrame(buf.subarray(0, size), n++); buf = buf.subarray(size) }
    })
    p.stderr.on('data', (d) => { err += d })
    p.on('close', (c) => (c === 0 ? resolve(n) : reject(new Error(err || `ffmpeg ${c}`))))
  })
}

// ── Spieler aus src/data/players.ts ───────────────────────────
function loadRoster() {
  const src = fs.readFileSync(path.join(ROOT, 'src/data/players.ts'), 'utf8')
  const out = []
  for (const m of src.matchAll(/\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)'([^\n]*)/g)) {
    const rest = m[3]
    const num = /number:\s*(\d+|null)/.exec(rest)?.[1]
    const cut = /cutoutUrl:\s*'\/players\/cutout\/([^.']+)\.webp'/.exec(rest)?.[1]
    out.push({ id: m[1], name: m[2], number: num && num !== 'null' ? +num : null, staff: m[1].startsWith('s-'), slug: cut ?? slugify(m[2]) })
  }
  return out
}
function slugify(s) {
  return s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-')
}
function loadOverrides() {
  try { return JSON.parse(fs.readFileSync(OVERRIDE_FILE, 'utf8')) } catch { return { clips: {}, fotos: {} } }
}

// ── Masken-Werkzeuge ──────────────────────────────────────────
/** Größte Zusammenhangskomponente (≥ thr), bevorzugt mittig. */
function mainComponent(mask, w, h, thr = 128) {
  const lab = new Int32Array(w * h).fill(-1), comps = [], stack = new Int32Array(w * h)
  for (let s = 0; s < w * h; s++) {
    if (mask[s] < thr || lab[s] >= 0) continue
    const id = comps.length; let sp = 0, area = 0, x0 = w, y0 = h, x1 = 0, y1 = 0, sx = 0
    stack[sp++] = s; lab[s] = id
    while (sp) {
      const p = stack[--sp], x = p % w, y = (p / w) | 0
      area++; sx += x; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      if (x > 0 && lab[p - 1] < 0 && mask[p - 1] >= thr) { lab[p - 1] = id; stack[sp++] = p - 1 }
      if (x < w - 1 && lab[p + 1] < 0 && mask[p + 1] >= thr) { lab[p + 1] = id; stack[sp++] = p + 1 }
      if (y > 0 && lab[p - w] < 0 && mask[p - w] >= thr) { lab[p - w] = id; stack[sp++] = p - w }
      if (y < h - 1 && lab[p + w] < 0 && mask[p + w] >= thr) { lab[p + w] = id; stack[sp++] = p + w }
    }
    comps.push({ id, area, x0, y0, x1, y1, cx: sx / area })
  }
  if (!comps.length) return null
  const score = (c) => c.area * (1 - 0.7 * Math.min(1, Math.abs(c.cx / w - 0.5) * 2))
  const best = comps.sort((a, b) => score(b) - score(a))[0]
  const bin = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) if (lab[i] === best.id) bin[i] = 255
  return { ...best, bin }
}
/** Box-Unschärfe (getrennt, gleitende Summe) auf Float32-Feld, Radius r. */
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), d = 2 * r + 1
  for (let y = 0; y < h; y++) {
    let s = 0; const o = y * w
    for (let x = -r; x <= r; x++) s += src[o + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      tmp[o + x] = s / d
      s += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)]
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = s / d
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]
    }
  }
  return out
}

/** Binär-Erosion (Quadrat 2r+1), getrennt in x/y. */
function erode(m, w, h, r) {
  const t = new Uint8Array(w * h), o = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 255
    for (let d = -r; d <= r && v; d++) { const xx = x + d; if (xx < 0 || xx >= w || !m[y * w + xx]) v = 0 }
    t[y * w + x] = v
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 255
    for (let d = -r; d <= r && v; d++) { const yy = y + d; if (yy >= 0 && yy < h && !t[yy * w + x]) v = 0 }
    o[y * w + x] = v
  }
  return o
}

// ── 1. Analyse (10 fps, 1/8 Auflösung) ───────────────────────
const ANA_VERSION = 4
async function analyze(file, info) {
  const key = path.basename(file).replace(/\W+/g, '_')
  const dir = path.join(WORK, 'ana', key)
  const cache = path.join(dir, 'ana.json')
  fs.mkdirSync(dir, { recursive: true })
  if (fs.existsSync(cache)) { const c = JSON.parse(fs.readFileSync(cache, 'utf8')); if (c.v === ANA_VERSION && c.size === fs.statSync(file).size) return c }
  const aw = even(info.w / 8), ah = even(info.h / 8), px = aw * ah
  const frames = []
  let prevY = null, prevM = null
  const bgS = [[], [], []]
  const thumbs = path.join(dir, 'thumbs'); fs.mkdirSync(thumbs, { recursive: true })
  const pending = []
  await rawFrames(['-hwaccel', 'videotoolbox', '-i', file, '-map', '0:v:0', '-vf', [...tonemap(info.hdr), `fps=10,scale=${aw}:${ah}`].join(','), '-an'], aw, ah, (rgb, n) => {
    // Grün-Klassifikation (grob): Hintergrund = deutlich grün dominiert
    const m = new Uint8Array(px), Y = new Float32Array(px)
    for (let i = 0; i < px; i++) {
      const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2], mx = r > b ? r : b
      Y[i] = 0.3 * r + 0.59 * g + 0.11 * b
      const gn = (g - mx) / (g + 20)
      m[i] = gn > 0.18 ? 0 : 255
      if (n % 10 === 0 && gn > 0.3 && (i % aw < aw * 0.12 || i % aw > aw * 0.88)) { bgS[0].push(r); bgS[1].push(g); bgS[2].push(b) }
    }
    // Öffnen (Erosion r=2): dünne Stative/Lampenstangen/Tuchkanten fallen weg
    const c = mainComponent(erode(m, aw, ah, 2), aw, ah)
    if (c) { c.x0 = Math.max(0, c.x0 - 2); c.y0 = Math.max(0, c.y0 - 2); c.x1 = Math.min(aw - 1, c.x1 + 2); c.y1 = Math.min(ah - 1, c.y1 + 2) }
    let f = null
    if (c && c.area > px * 0.01) {
      const hgt = c.y1 - c.y0 + 1
      const row = Math.min(ah - 1, Math.round(c.y0 + hgt * 0.24)), rowH = Math.min(ah - 1, Math.round(c.y0 + hgt * 0.08))
      let sw = 0, hw = 0
      for (let x = 0; x < aw; x++) { if (c.bin[row * aw + x]) sw++; if (c.bin[rowH * aw + x]) hw++ }
      // Bewegung: mittlere Luma-Änderung in der Vereinigung beider Silhouetten, getrennt Kopf (oberes Fünftel) / Körper
      let mv = 0, mn = 0, hv = 0, hn = 0
      if (prevY) {
        const headLim = c.y0 + hgt * 0.2
        for (let i = 0; i < px; i++) {
          if (!c.bin[i] && !prevM[i]) continue
          const d = Math.abs(Y[i] - prevY[i]) + (c.bin[i] !== prevM[i] ? 40 : 0)
          if ((i / aw | 0) < headLim) { hv += d; hn++ } else { mv += d; mn++ }
        }
      }
      f = { t: n / 10, x0: c.x0 / aw, x1: (c.x1 + 1) / aw, y0: c.y0 / ah, y1: (c.y1 + 1) / ah, area: c.area / px, sw: sw / aw, hw: hw / aw, mv: mn ? mv / mn : 0, hv: hn ? hv / hn : 0 }
      prevM = c.bin
    } else prevM = new Uint8Array(px)
    prevY = Y
    frames.push(f)
    if (n % 5 === 0) pending.push(sharp(Buffer.from(rgb), { raw: { width: aw, height: ah, channels: 3 } }).jpeg({ quality: 80 }).toFile(path.join(thumbs, `${String(n).padStart(5, '0')}.jpg`)))
  })
  await Promise.all(pending)
  const keyColor = bgS[0].length ? bgS.map(median) : [40, 170, 70]
  const res = { v: ANA_VERSION, size: fs.statSync(file).size, file, info, aw, ah, frames, keyColor }
  fs.writeFileSync(cache, JSON.stringify(res))
  return res
}

// ── 2. Rückennummer (OCR, Rückfall: Finger) ───────────────────
async function readNumber(file, info) {
  const dir = path.join(WORK, 'ocr', path.basename(file).replace(/\W+/g, '_'))
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true })
  const secs = Math.min(3.2, info.dur)
  await ff(['-i', file, '-t', String(secs), '-map', '0:v:0', '-vf', [...tonemap(info.hdr), `fps=4,scale=-2:1920`].join(','), '-q:v', '2', path.join(dir, '%03d.jpg')])
  const ocr = JSON.parse(await vision(['ocr', dir]) || '{}')
  const votes = new Map()
  for (const [f, lines] of Object.entries(ocr)) {
    const seen = new Set()
    for (const l of lines) {
      const s = l.t.replace(/[#№.\s]/g, '').replace(/[Oo]/g, '0').replace(/[Il|]/g, '1')
      if (!/^\d{1,2}$/.test(s) || l.t.length > 4) continue
      const n = +s; if (seen.has(n)) continue
      seen.add(n)
      // große Ziffern (Zettel) zählen mehr als kleine (Hosennummer, Hintergrund)
      const w = l.c * Math.min(1, l.h / 0.05) * (l.k === 0 ? 1 : 0.4)
      const v = votes.get(n) ?? { n, w: 0, frames: 0, files: [] }
      v.w += w; v.frames++; v.files.push(f); votes.set(n, v)
    }
  }
  const ranked = [...votes.values()].sort((a, b) => b.w - a.w)
  if (ranked.length) {
    const [a, b] = ranked
    const sicher = a.frames >= 2 && (!b || b.w < a.w * 0.34)
    return { method: 'ocr', number: a.n, frames: a.frames, weight: +a.w.toFixed(2), sicher, alt: ranked.slice(1, 3).map((v) => v.n), lastT: Math.max(...a.files.map((f) => (+f.slice(0, 3) - 1) / 4)) }
  }
  // Rückfall: ausgestreckte Finger (ein bis zwei Hände)
  const hands = JSON.parse(await vision(['hands', dir]) || '{}')
  const counts = Object.values(hands).map((hs) => hs.filter((h) => h.seen >= 4).reduce((s, h) => s + h.ext, 0)).filter((n) => n > 0)
  if (counts.length >= 3) {
    const n = median(counts), agree = counts.filter((c) => c === n).length
    return { method: 'finger', number: n, frames: agree, weight: agree / counts.length, sicher: false, alt: [], lastT: secs }
  }
  return { method: 'keine', number: null, frames: 0, weight: 0, sicher: false, alt: [], lastT: 0 }
}

// ── 3. Takes (DP über die Reihenfolge des Drehplans) ──────────
function detectTakes(ana, introEnd) {
  const F = ana.frames, T = F.length, fps = 10
  const ok = F.map((f) => !!f)
  const mv = F.map((f) => (f ? f.mv : 0)), hv = F.map((f) => (f ? f.hv : 0))
  const sm = (a, r) => a.map((_, i) => { let s = 0, n = 0; for (let j = Math.max(0, i - r); j <= Math.min(a.length - 1, i + r); j++) { s += a[j]; n++ } return s / n })
  const mvS = sm(mv, 2), hvS = sm(hv, 2)
  const mref = Math.max(0.5, pct(mvS.filter((_, i) => ok[i]), 0.6))
  const hgt = F.map((f) => (f ? f.y1 - f.y0 : 0)), cx = F.map((f) => (f ? (f.x0 + f.x1) / 2 : 0.5))
  // Präfixsummen für schnelle Fenster-Mittelwerte
  const pre = (a) => { const p = new Float64Array(a.length + 1); a.forEach((v, i) => { p[i + 1] = p[i] + v }); return p }
  const Pm = pre(mvS), Ph = pre(hvS), Pok = pre(ok.map(Number)), Psw = pre(F.map((f) => (f ? f.sw : 0))), Par = pre(F.map((f) => (f ? f.area : 0)))
  const mean = (P, a, b) => (P[b] - P[a]) / Math.max(1, b - a)
  const start0 = Math.min(T - 1, Math.round((introEnd + 0.4) * fps))
  // Referenz „frontal“: breiteste Schulter in ruhigen Phasen
  const calm = F.map((f, i) => (f && mvS[i] < mref ? f.sw : 0)).filter(Boolean)
  const swRef = Math.max(0.05, pct(calm, 0.75)), arRef = Math.max(0.01, pct(F.filter(Boolean).map((f) => f.area), 0.5))
  function cost(k, a, b) {
    const d = (b - a) / fps, tk = TAKES[k]
    if (mean(Pok, a, b) < 0.9) return 1e9
    const M = mean(Pm, a, b) / mref, Hm = mean(Ph, a, b) / mref
    let c = 0.6 * Math.abs(Math.log(d / tk.soll))
    if (tk.art !== 'gehen' && tk.art !== 'jubel') {
      // Abstand zur Kamera bleibt gleich (kein Vor-/Zurückgehen im Take)
      let lo = 9, hi = 0; for (let i = a; i < b; i++) if (ok[i]) { lo = Math.min(lo, hgt[i]); hi = Math.max(hi, hgt[i]) }
      c += 6 * (hi - lo) / Math.max(0.05, hi)
    }
    if (tk.art === 'still') c += 1.2 * M
    else if (tk.art === 'nick') c += 0.8 * M - 0.6 * Math.min(1.5, Hm - M * 0.6) + 0.3
    else if (tk.art === 'gehen') {
      const g = (hgt[b - 1] - hgt[a]) / Math.max(0.05, hgt[a])
      c += 1.6 - 9 * Math.min(0.25, g) + (g < 0.03 ? 2 : 0)
    } else if (tk.art === 'jubel') {
      let lo = 1, hi = 0; for (let i = a; i < b; i++) if (ok[i]) { lo = Math.min(lo, cx[i]); hi = Math.max(hi, cx[i]) }
      c += 1.5 - 0.7 * Math.min(2.5, M) - 4 * Math.min(0.2, hi - lo)
      // Jubel beginnt mit Bewegung, nicht mit Stehen
      c += 0.8 * (1 - Math.min(1, mean(Pm, a, Math.min(b, a + fps)) / mref / 2))
    } else if (tk.art === 'ball') c += 0.8 * M - 2.5 * Math.min(0.3, mean(Par, a, b) / arRef - 1) + 0.3
    else if (tk.art === 'seite') c += 0.8 * M + 3 * Math.max(0, mean(Psw, a, b) / swRef - 0.55)
    return c
  }
  // DP: best[k][e] = min Kosten, Take k endet bei Frame e (exklusiv)
  const K = TAKES.length, INF = 1e18
  const best = Array.from({ length: K }, () => new Float64Array(T + 1).fill(INF))
  const from = Array.from({ length: K }, () => new Int32Array(T + 1).fill(-1))
  const GAP = 0.02 // Kosten je Sekunde Pause zwischen Takes
  for (let k = 0; k < K; k++) {
    const dmin = Math.round(TAKES[k].soll * 0.6 * fps), dmax = Math.round(TAKES[k].soll * 1.5 * fps)
    // prefMin[s] = min über e' ≤ s von best[k-1][e'] + Pausenkosten
    let prefMin = null, prefArg = null
    if (k > 0) {
      prefMin = new Float64Array(T + 1).fill(INF); prefArg = new Int32Array(T + 1).fill(-1)
      for (let s = 0; s <= T; s++) {
        const v = best[k - 1][s] - GAP * s / fps
        if (s > 0 && prefMin[s - 1] <= v) { prefMin[s] = prefMin[s - 1]; prefArg[s] = prefArg[s - 1] } else { prefMin[s] = v; prefArg[s] = s }
      }
    }
    for (let a = start0; a < T; a++) {
      let base, arg
      if (k === 0) { base = GAP * (a - start0) / fps; arg = -1 } else {
        const s = a - 3 // min. 0,3 s Pause
        if (s < 0 || prefMin[s] >= INF / 2) continue
        base = prefMin[s] + GAP * a / fps; arg = prefArg[s]
      }
      for (let d = dmin; d <= dmax && a + d <= T; d++) {
        const e = a + d, v = base + cost(k, a, e)
        if (v < best[k][e]) { best[k][e] = v; from[k][e] = k === 0 ? a : a * 100000 + arg }
      }
    }
  }
  let e = -1, bv = INF
  for (let i = 0; i <= T; i++) if (best[K - 1][i] < bv) { bv = best[K - 1][i]; e = i }
  if (e < 0) return null
  const out = []
  for (let k = K - 1; k >= 0; k--) {
    const f = from[k][e]
    const a = k === 0 ? f : Math.floor(f / 100000)
    out.unshift({ n: TAKES[k].n, key: TAKES[k].key, start: a / fps, end: e / fps, cost: +cost(k, a, e).toFixed(2) })
    if (k > 0) e = f % 100000
  }
  return { takes: out, total: +bv.toFixed(2) }
}

/** Kontaktbogen: je Take Anfang/Mitte/Ende (Analyse-Vorschauen). */
async function contactSheet(ana, takes, file) {
  const dir = path.join(WORK, 'ana', path.basename(ana.file).replace(/\W+/g, '_'), 'thumbs')
  const tw = ana.aw, th = ana.ah, pad = 8, lab = 150
  const comp = []
  const W = lab + 3 * (tw + pad) + pad, H = takes.length * (th + pad) + pad
  for (const [r, t] of takes.entries()) {
    const ts = [t.start + 0.2, (t.start + t.end) / 2, t.end - 0.2]
    for (const [c, s] of ts.entries()) {
      const n = Math.round(s * 2) * 5
      const f = path.join(dir, `${String(n).padStart(5, '0')}.jpg`)
      if (fs.existsSync(f)) comp.push({ input: f, left: lab + pad + c * (tw + pad), top: pad + r * (th + pad) })
    }
    const svg = `<svg width="${lab}" height="${th}" xmlns="http://www.w3.org/2000/svg"><text x="8" y="34" font-family="Helvetica" font-weight="700" font-size="26" fill="#fff">Take ${t.n}</text><text x="8" y="64" font-family="Helvetica" font-size="18" fill="#bbb">${t.key}</text><text x="8" y="92" font-family="Helvetica" font-size="18" fill="#bbb">${t.start.toFixed(1)}–${t.end.toFixed(1)} s</text></svg>`
    comp.push({ input: Buffer.from(svg), left: 0, top: pad + r * (th + pad) })
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await sharp({ create: { width: W, height: H, channels: 3, background: '#161414' } }).composite(comp).jpeg({ quality: 82 }).toFile(file)
  return file
}

// ── 4. Keyer ──────────────────────────────────────────────────
/**
 * Ein Take (oder Einzelbild) freistellen.
 *  src:   Frames (JPG, 4:4:4) in Arbeitsauflösung, k*.png = ffmpeg-chromakey-Alpha
 *  masks: Vision-Masken (gleiche Namen, PNG)
 * Liefert RGBA-Frames (PNG) in Ausgabegröße nach outDir.
 */
async function keyFrames({ dir, outW, outH, keyColor, personH, still = false, compareDir = null }) {
  const files = fs.readdirSync(path.join(dir, 'src')).filter((f) => f.endsWith('.jpg')).sort()
  const outDir = path.join(dir, 'rgba'); fs.mkdirSync(outDir, { recursive: true })
  if (!files.length) throw new Error('keine Frames')
  const meta = await sharp(path.join(dir, 'src', files[0])).metadata()
  const W = meta.width, H = meta.height, N = W * H
  const ph = Math.max(200, personH ?? H * 0.8)
  const rDil = Math.max(6, Math.round(ph * 0.022)), rEro = Math.max(4, Math.round(ph * 0.014))
  const plateK = 8, pw = Math.ceil(W / plateK), phh = Math.ceil(H / plateK)
  let plate = null // Float32 pw*phh*3, zeitlich geglättet

  const load = async (f) => {
    const rgb = await sharp(path.join(dir, 'src', f)).removeAlpha().raw().toBuffer()
    const mf = path.join(dir, 'mask', f.replace('.jpg', '.png'))
    const vm = fs.existsSync(mf) ? await sharp(mf).greyscale().resize(W, H, { fit: 'fill' }).raw().toBuffer() : null
    const kf = path.join(dir, 'key', f.replace('.jpg', '.png'))
    const fk = fs.existsSync(kf) ? await sharp(kf).greyscale().resize(W, H, { fit: 'fill' }).raw().toBuffer() : null
    return { f, rgb, vm, fk }
  }

  // Vision-Maske: Hauptkomponente, zeitlich über ±2 Frames gemittelt (Vision flackert)
  const visionRaw = []
  for (const f of files) {
    const mf = path.join(dir, 'mask', f.replace('.jpg', '.png'))
    if (!fs.existsSync(mf)) { visionRaw.push(null); continue }
    const lw = Math.round(W / 4), lh = Math.round(H / 4)
    const m = await sharp(mf).greyscale().resize(lw, lh, { fit: 'fill' }).raw().toBuffer()
    const c = mainComponent(m, lw, lh, 110)
    visionRaw.push(c ? { lw, lh, bin: c.bin } : null)
  }
  const visionSoft = (i) => {
    const Wt = [1, 2, 4, 2, 1]; let acc = null, n = 0, lw = 0, lh = 0
    for (let d = -2; d <= 2; d++) {
      const v = visionRaw[i + d]; if (!v) continue
      lw = v.lw; lh = v.lh
      if (!acc) acc = new Float32Array(lw * lh)
      for (let j = 0; j < acc.length; j++) acc[j] += v.bin[j] / 255 * Wt[d + 2]
      n += Wt[d + 2]
    }
    if (!acc) return null
    for (let j = 0; j < acc.length; j++) acc[j] /= n
    return { lw, lh, a: acc }
  }
  /** Vision → erlaubter Bereich (geweitet, weich) + Kern (geschrumpft), in voller Größe. */
  async function regions(i) {
    const v = visionSoft(i)
    if (!v) return { allow: null, core: null }
    const { lw, lh, a } = v
    const rd = Math.max(1, Math.round(rDil / 4)), re = Math.max(1, Math.round(rEro / 4))
    const dil = boxBlur(a, lw, lh, rd), ero = boxBlur(a, lw, lh, re)
    const al = new Uint8Array(lw * lh), co = new Uint8Array(lw * lh)
    for (let j = 0; j < lw * lh; j++) {
      al[j] = Math.round(smoothstep(0.02, 0.2, dil[j]) * 255)
      co[j] = Math.round(smoothstep(0.93, 0.995, ero[j]) * 255)
    }
    const up = (b) => sharp(Buffer.from(b), { raw: { width: lw, height: lh, channels: 1 } }).resize(W, H, { fit: 'fill', kernel: 'linear' }).extractChannel(0).raw().toBuffer()
    const [allow, core] = await Promise.all([up(al), up(co)])
    return { allow, core }
  }

  /** Hintergrund-Platte aus sicheren Hintergrundpixeln (ffmpeg-Key + Grün + außerhalb Vision), Push-Pull-Füllung. */
  function updatePlate(fr, allow) {
    const s = new Float32Array(pw * phh * 3), n = new Float32Array(pw * phh)
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      const i = y * W + x
      if (allow && allow[i] > 10) continue
      if (fr.fk && fr.fk[i] > 40) continue
      const r = fr.rgb[i * 3], g = fr.rgb[i * 3 + 1], b = fr.rgb[i * 3 + 2], mx = r > b ? r : b
      if ((g - mx) / (g + 20) < 0.2) continue
      const c = ((y / plateK) | 0) * pw + ((x / plateK) | 0)
      s[c * 3] += r; s[c * 3 + 1] += g; s[c * 3 + 2] += b; n[c]++
    }
    // Push-Pull: Lücken aus gröberen Stufen füllen
    let levels = [{ w: pw, h: phh, s, n }]
    while (levels[levels.length - 1].w > 2 && levels[levels.length - 1].h > 2) {
      const L = levels[levels.length - 1], w2 = Math.ceil(L.w / 2), h2 = Math.ceil(L.h / 2)
      const s2 = new Float32Array(w2 * h2 * 3), n2 = new Float32Array(w2 * h2)
      for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
        const a = y * L.w + x, b = (y >> 1) * w2 + (x >> 1)
        n2[b] += L.n[a]; for (let c = 0; c < 3; c++) s2[b * 3 + c] += L.s[a * 3 + c]
      }
      levels.push({ w: w2, h: h2, s: s2, n: n2 })
    }
    for (let l = levels.length - 2; l >= 0; l--) {
      const L = levels[l], U = levels[l + 1]
      for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
        const a = y * L.w + x, b = (y >> 1) * U.w + (x >> 1)
        if (L.n[a] >= 4) continue
        const wgt = 4 - L.n[a], un = Math.max(1e-6, U.n[b])
        for (let c = 0; c < 3; c++) L.s[a * 3 + c] += (U.s[b * 3 + c] / un) * wgt
        L.n[a] += wgt
      }
    }
    const fresh = new Float32Array(pw * phh * 3)
    const L0 = levels[0]
    for (let c = 0; c < pw * phh; c++) for (let k = 0; k < 3; k++) fresh[c * 3 + k] = L0.n[c] > 1e-3 ? L0.s[c * 3 + k] / L0.n[c] : keyColor[k]
    if (!plate) plate = fresh
    else for (let j = 0; j < plate.length; j++) plate[j] = plate[j] * 0.7 + fresh[j] * 0.3
  }
  const plateAt = (x, y, out) => {
    const fx = Math.min(pw - 1.001, Math.max(0, x / plateK - 0.5)), fy = Math.min(phh - 1.001, Math.max(0, y / plateK - 0.5))
    const x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0
    for (let c = 0; c < 3; c++) {
      const p00 = plate[(y0 * pw + x0) * 3 + c], p10 = plate[(y0 * pw + x0 + 1) * 3 + c], p01 = plate[((y0 + 1) * pw + x0) * 3 + c], p11 = plate[((y0 + 1) * pw + x0 + 1) * 3 + c]
      out[c] = (p00 * (1 - ax) + p10 * ax) * (1 - ay) + (p01 * (1 - ax) + p11 * ax) * ay
    }
  }

  /** Roh-Alpha eines Frames: Ratio-Key gegen die Platte, Vision-Plausibilität. */
  function rawAlpha(fr, reg) {
    const A = new Float32Array(N), Bc = [0, 0, 0]
    const { allow, core } = reg
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x
      if (allow && allow[i] === 0) { A[i] = 0; continue }
      const r = fr.rgb[i * 3], g = fr.rgb[i * 3 + 1], b = fr.rgb[i * 3 + 2]
      plateAt(x, y, Bc)
      const gnC = (g - Math.max(r, b)) / (g + 20)
      const gnB = Math.max(0.08, (Bc[1] - Math.max(Bc[0], Bc[2])) / (Bc[1] + 20))
      // Ratio-Key: Schatten (gleicher Farbton, dunkler) bleiben Hintergrund
      let a = 1 - clamp01(gnC / gnB)
      a = smoothstep(0.1, 0.9, a)
      if (core && core[i] > 0) {
        // Kern der Person: Loch nur, wenn der Pixel wirklich Platten-Farbe hat
        const lumC = 0.3 * r + 0.59 * g + 0.11 * b, lumB = 0.3 * Bc[0] + 0.59 * Bc[1] + 0.11 * Bc[2]
        const bgLike = smoothstep(0.85, 0.97, gnC / gnB) * (1 - smoothstep(0.1, 0.25, Math.abs(lumC - lumB) / Math.max(30, lumB)))
        const fill = (1 - bgLike) * (core[i] / 255)
        if (fill > a) a = fill
      }
      if (allow) a *= allow[i] / 255
      A[i] = a
    }
    return A
  }

  // Gleitendes Fenster: Frame i wird mit i−1/i+1 zeitlich geglättet (bewegungsabhängig)
  const raw = []
  const getRaw = async (i) => {
    if (raw[i]) return raw[i]
    const fr = await load(files[i])
    const reg = await regions(i)
    updatePlate(fr, reg.allow)
    raw[i] = { fr, A: rawAlpha(fr, reg) }
    return raw[i]
  }
  const stats = { holesFilled: 0 }
  for (let i = 0; i < files.length; i++) {
    const cur = await getRaw(i)
    const nb = still ? [] : [i > 0 ? await getRaw(i - 1) : null, i + 1 < files.length ? await getRaw(i + 1) : null].filter(Boolean)
    if (i >= 2) raw[i - 2] = null // Speicher
    const A = new Float32Array(N)
    const C = cur.fr.rgb
    for (let j = 0; j < N; j++) {
      let s = cur.A[j] * 2, w = 2
      for (const o of nb) {
        // Gewicht nach Farbabstand (Bewegung → kaum Mischung, kein Geisterbild)
        const d = Math.abs(C[j * 3] - o.fr.rgb[j * 3]) + Math.abs(C[j * 3 + 1] - o.fr.rgb[j * 3 + 1]) + Math.abs(C[j * 3 + 2] - o.fr.rgb[j * 3 + 2])
        const ww = Math.exp(-(d * d) / 450)
        s += o.A[j] * ww; w += ww
      }
      A[j] = s / w
    }
    // Kantenverfeinerung: geführter Filter (Luma als Führung) nur im Unsicherheitsband
    const I = new Float32Array(N)
    for (let j = 0; j < N; j++) I[j] = (0.3 * C[j * 3] + 0.59 * C[j * 3 + 1] + 0.11 * C[j * 3 + 2]) / 255
    const r = 3, eps = 2e-3
    const mI = boxBlur(I, W, H, r), mA = boxBlur(A, W, H, r)
    const II = new Float32Array(N), IA = new Float32Array(N)
    for (let j = 0; j < N; j++) { II[j] = I[j] * I[j]; IA[j] = I[j] * A[j] }
    const mII = boxBlur(II, W, H, r), mIA = boxBlur(IA, W, H, r)
    const ca = new Float32Array(N), cb = new Float32Array(N)
    for (let j = 0; j < N; j++) { const v = mII[j] - mI[j] * mI[j], cv = mIA[j] - mI[j] * mA[j]; ca[j] = cv / (v + eps); cb[j] = mA[j] - ca[j] * mI[j] }
    const ma = boxBlur(ca, W, H, r), mb = boxBlur(cb, W, H, r)
    const out = Buffer.alloc(N * 4), Bc = [0, 0, 0]
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const j = y * W + x
      let a = A[j]
      if (a > 0.01 && a < 0.99) a = clamp01(0.35 * a + 0.65 * (ma[j] * I[j] + mb[j]))
      a = smoothstep(0.03, 0.97, a)
      let R = C[j * 3], G = C[j * 3 + 1], B = C[j * 3 + 2]
      if (a > 0.004) {
        // Entmischen: beobachtet = a·F + (1−a)·Platte → F
        if (a < 0.985) {
          plateAt(x, y, Bc)
          // begrenzt: sehr transparente Pixel nicht überverstärken (sonst heller Saum)
          const k = 1 / Math.max(0.5, a), w = (1 - a) * 0.75
          R = R * (1 - w) + clamp01((Bc[0] + (R - Bc[0]) * k) / 255) * 255 * w
          G = G * (1 - w) + clamp01((Bc[1] + (G - Bc[1]) * k) / 255) * 255 * w
          B = B * (1 - w) + clamp01((Bc[2] + (B - Bc[2]) * k) / 255) * 255 * w
        }
        // Spill: G ≤ max(R,B) (Haut, Blond, Weiß bleiben unverändert; kein Grün im
        // Vereinsdress). Nur sehr transparente Kanten zusätzlich Richtung (R+B)/2.
        const edge = 1 - smoothstep(0.35, 0.7, a)
        const lim = Math.max(R, B) * (1 - edge) + ((R + B) / 2) * edge
        if (G > lim) { const d = G - lim; G = lim + d * 0.1; R += d * 0.08; B += d * 0.08 }
      }
      out[j * 4] = R > 255 ? 255 : R; out[j * 4 + 1] = G > 255 ? 255 : G; out[j * 4 + 2] = B > 255 ? 255 : B
      out[j * 4 + 3] = Math.round(a * 255)
    }
    // Hintergrund unter Alpha 0 mit ausgedehnter Randfarbe füllen (kein Saum beim Skalieren/Kodieren)
    const pre = Buffer.alloc(N * 3), al = Buffer.alloc(N)
    for (let j = 0; j < N; j++) { al[j] = out[j * 4 + 3]; for (let c = 0; c < 3; c++) pre[j * 3 + c] = Math.round(out[j * 4 + c] * al[j] / 255) }
    const bp = await sharp(pre, { raw: { width: W, height: H, channels: 3 } }).blur(10).raw().toBuffer()
    const ba = await sharp(al, { raw: { width: W, height: H, channels: 1 } }).blur(10).extractChannel(0).raw().toBuffer()
    for (let j = 0; j < N; j++) if (al[j] < 6) for (let c = 0; c < 3; c++) out[j * 4 + c] = ba[j] > 0 ? Math.min(255, Math.round(bp[j * 3 + c] * 255 / ba[j])) : 60
    const nm = files[i].replace('.jpg', '.png')
    await sharp(out, { raw: { width: W, height: H, channels: 4 } }).resize(outW, outH, { kernel: 'lanczos3', fit: 'fill' }).png({ compressionLevel: 3 }).toFile(path.join(outDir, nm))
    if (compareDir && (i === 0 || i === (files.length >> 1))) {
      fs.mkdirSync(compareDir, { recursive: true })
      await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(path.join(compareDir, `nachher-${nm}`))
      fs.copyFileSync(path.join(dir, 'src', files[i]), path.join(compareDir, `quelle-${files[i]}`))
    }
  }
  return { frames: files.length, W, H, stats }
}

// ── 5. Frames eines Takes holen (fester Ausschnitt, Stativ) ───
/** Quell-Ausschnitt (Pixel) so, dass die Person mit Scheitel/Sohle an headY/feetY sitzt. */
function cropFor(info, box, ow, oh, headY = GS.headY, feetY = GS.feetY) {
  const sh = (box.y1 - box.y0) * info.h / (feetY - headY)
  const sw = sh * ow / oh
  const cx = (box.x0 + box.x1) / 2 * info.w
  return { x: cx - sw / 2, y: box.y0 * info.h - headY * sh, w: sw, h: sh }
}
async function extractTake(file, info, { t0, dur, crop, ww, wh, keyColor, dir, single = false }) {
  fs.rmSync(dir, { recursive: true, force: true })
  for (const d of ['src', 'mask', 'key']) fs.mkdirSync(path.join(dir, d), { recursive: true })
  // Ausschnitt ∩ Bild, Rest mit Key-Farbe auffüllen (wird weggekeyt)
  const ix0 = Math.max(0, Math.floor(crop.x)), iy0 = Math.max(0, Math.floor(crop.y))
  const ix1 = Math.min(info.w, Math.ceil(crop.x + crop.w)), iy1 = Math.min(info.h, Math.ceil(crop.y + crop.h))
  const s = ww / crop.w
  const sw = Math.min(ww, Math.max(2, Math.floor((ix1 - ix0) * s / 2) * 2)), sh = Math.min(wh, Math.max(2, Math.floor((iy1 - iy0) * s / 2) * 2))
  const px = Math.max(0, Math.min(ww - sw, Math.round((ix0 - crop.x) * s))), py = Math.max(0, Math.min(wh - sh, Math.round((iy0 - crop.y) * s)))
  const hex = '0x' + keyColor.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
  const chain = [
    ...(single ? [] : [`fps=${GS.fps}`]),
    `crop=${even(ix1 - ix0)}:${even(iy1 - iy0)}:${ix0}:${iy0}`,
    ...tonemap(info.hdr),
    `scale=${sw}:${sh}:flags=lanczos`,
    `pad=${ww}:${wh}:${px}:${py}:color=${hex}`,
    'format=yuv444p',
  ].join(',')
  // eine Dekodierung → zwei Ausgaben: Farbe (JPG 4:4:4) + ffmpeg-chromakey-Alpha
  const fc = `[0:v]${chain},split[a][b];[a]format=yuvj444p[rgb];[b]format=yuva444p,chromakey=${hex}:0.11:0.07,alphaextract,format=gray[k]`
  await ff(['-ss', String(t0), ...(single ? [] : ['-t', String(dur)]), '-i', file, '-filter_complex', fc,
    '-map', '[rgb]', ...(single ? ['-frames:v', '1'] : []), '-q:v', '1', path.join(dir, 'src/%04d.jpg'),
    '-map', '[k]', ...(single ? ['-frames:v', '1'] : []), path.join(dir, 'key/%04d.png')])
  const v = await vision(['fg', path.join(dir, 'src'), path.join(dir, 'mask')])
  if (!v.startsWith('ok')) log('  Vision:', v.split('\n').slice(0, 2).join(' | '))
}

// ── 6. Kodieren ───────────────────────────────────────────────
async function encodeClip(dir, base, { loop = false, budgetKB = 600 } = {}) {
  const seq = path.join(dir, loop ? 'loop' : 'rgba')
  const rate = ['-framerate', String(GS.fps)]
  const files = fs.readdirSync(seq).filter((f) => f.endsWith('.png')).sort()
  // fortlaufend nummerieren (ffmpeg-Muster)
  const lin = path.join(dir, 'lin'); fs.rmSync(lin, { recursive: true, force: true }); fs.mkdirSync(lin)
  files.forEach((f, i) => fs.symlinkSync(path.join(seq, f), path.join(lin, String(i + 1).padStart(4, '0') + '.png')))
  const pat = path.join(lin, '%04d.png')
  const meta = await sharp(path.join(lin, '0001.png')).metadata()
  // Stacked Alpha (oben Farbe, unten Alpha) — H.264 für WebGL/alle Browser
  const stackFc = `[0:v]format=rgba,split[c][a];[a]alphaextract,format=rgb24[al];[c]format=rgb24[co];[co][al]vstack,format=yuv420p[v]`
  // VP9-Alpha: Qualität absteigend probieren, bis das Budget passt (nur Loops)
  let crf = loop ? 34 : 36
  for (;;) {
    await ff([...rate, '-i', pat, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', String(crf), '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-auto-alt-ref', '0', '-g', '300', '-an', base + '.webm'])
    if (!loop || fs.statSync(base + '.webm').size <= budgetKB * 1024 || crf >= 48) break
    crf += 3
  }
  await ff([...rate, '-i', pat, '-filter_complex', stackFc, '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', loop ? '24' : '23', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-g', '300', '-movflags', '+faststart', '-an', base + '.mp4'])
  const prores = path.join(dir, 'master4444.mov')
  await ff([...rate, '-i', pat, '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-an', prores])
  const px = meta.width * meta.height, sec = files.length / GS.fps
  // HEVC-Alpha: Bitrate aus dem Budget (Loops) bzw. pixelproportional
  const kbps = loop ? Math.min(Math.round(budgetKB * 8 * 0.62 / sec), Math.round(px / 1000 * 2.2)) : Math.round(px / 1000 * 1.8)
  try {
    await ff(['-i', prores, '-c:v', 'hevc_videotoolbox', '-alpha_quality', '0.5', '-b:v', `${kbps}k`, '-pix_fmt', 'bgra', '-tag:v', 'hvc1', '-movflags', '+faststart', '-an', base + '.mov'])
  } catch (e) {
    log('  hevc_videotoolbox nicht nutzbar → avconvert:', String(e.message).split('\n')[0])
    await run('avconvert', ['--source', prores, '--preset', 'PresetHEVCHighestQualityWithAlpha', '--output', base + '.mov', '--replace'])
  }
  fs.rmSync(prores, { force: true })
  await sharp(path.join(lin, '0001.png')).webp({ quality: 86, alphaQuality: 95 }).toFile(base + '.webp')
  const kb = (e) => Math.round(fs.statSync(base + e).size / 1024)
  return { frames: files.length, w: meta.width, h: meta.height, kb: { webm: kb('.webm'), mov: kb('.mov'), mp4: kb('.mp4'), poster: kb('.webp') }, crf }
}

/** Nahtlose Schleife (2–3 s) aus einem Take: bestes Paar (i, j) mit kleinster
 *  Bild- und Bewegungsdifferenz, Überblendung der letzten K Frames. */
async function makeLoop(dir, minS = 2, maxS = 3) {
  const src = path.join(dir, 'rgba'), dst = path.join(dir, 'loop')
  fs.rmSync(dst, { recursive: true, force: true }); fs.mkdirSync(dst)
  const files = fs.readdirSync(src).filter((f) => f.endsWith('.png')).sort()
  const small = await Promise.all(files.map((f) => sharp(path.join(src, f)).resize(48, 96, { fit: 'fill' }).raw().toBuffer()))
  const diff = (a, b) => { let s = 0; for (let k = 0; k < a.length; k += 4) { const al = (a[k + 3] + b[k + 3]) / 510; s += (Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2])) * al + Math.abs(a[k + 3] - b[k + 3]) * 2 } return s / (a.length / 4) }
  const K = 8, lo = Math.round(minS * GS.fps), hi = Math.round(maxS * GS.fps)
  let best = null
  for (let i = K; i < files.length; i++) for (let j = i + lo; j <= Math.min(files.length - 1, i + hi); j++) {
    const d = diff(small[i], small[j]) + 0.5 * diff(small[i - 1], small[j - 1])
    if (!best || d < best.d) best = { i, j, d }
  }
  if (!best) {
    // zu kurz → Ping-Pong
    const order = [...files.keys(), ...[...files.keys()].reverse().slice(1, -1)].slice(0, hi * 2)
    order.forEach((k, n) => fs.copyFileSync(path.join(src, files[k]), path.join(dst, String(n + 1).padStart(4, '0') + '.png')))
    return { mode: 'pingpong', frames: order.length }
  }
  const { i, j } = best
  for (let n = i; n < j; n++) {
    const out = path.join(dst, String(n - i + 1).padStart(4, '0') + '.png')
    const m = n - (j - K) // Überblendung: letzte K Frames gleiten in die K Frames vor i
    if (m >= 0) {
      const t = (m + 1) / (K + 1)
      const [a, b] = await Promise.all([sharp(path.join(src, files[n])).raw().toBuffer({ resolveWithObject: true }), sharp(path.join(src, files[i - K + m])).raw().toBuffer()])
      const o = Buffer.alloc(a.data.length)
      // premultipliziert mischen
      for (let k = 0; k < o.length; k += 4) {
        const aa = a.data[k + 3] * (1 - t), ab = b[k + 3] * t, al = aa + ab
        for (let c = 0; c < 3; c++) o[k + c] = al > 0 ? Math.round((a.data[k + c] * aa + b[k + c] * ab) / al) : a.data[k + c]
        o[k + 3] = Math.round(al)
      }
      await sharp(o, { raw: { width: a.info.width, height: a.info.height, channels: 4 } }).png({ compressionLevel: 3 }).toFile(out)
    } else fs.copyFileSync(path.join(src, files[n]), out)
  }
  return { mode: 'crossfade', from: i, to: j, frames: j - i, score: +best.d.toFixed(2) }
}

// ── 7. Foto → card.webp ───────────────────────────────────────
async function heicToJpg(file) {
  if (!/\.hei[cf]$/i.test(file)) return file
  const dir = path.join(WORK, 'fotos'); fs.mkdirSync(dir, { recursive: true })
  const out = path.join(dir, path.basename(file).replace(/\.\w+$/, '.jpg'))
  if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(file).mtimeMs) await run('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '95', file, '--out', out])
  return out
}
async function photoTime(file, orig = file) {
  try {
    const exif = (await sharp(file).metadata()).exif
    const m = exif && /(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(exif.toString('latin1'))
    if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`).getTime()
  } catch { /* keine EXIF */ }
  return fs.statSync(orig).mtimeMs // Dateizeit des Originals (nicht der JPG-Kopie)
}
/** Freisteller aus einem Einzelbild (Foto oder Standbild aus Take). */
async function keyStill({ img, dir, frame = 'card', keyColor }) {
  fs.rmSync(dir, { recursive: true, force: true })
  for (const d of ['src', 'mask', 'key', 'full']) fs.mkdirSync(path.join(dir, d), { recursive: true })
  // 1. Person finden (Vision auf verkleinertem Gesamtbild)
  const m0 = await sharp(img).rotate().metadata()
  const fw = 1080, fh = Math.round(1080 * (m0.height / m0.width))
  await sharp(img).rotate().resize(fw, fh).jpeg({ quality: 92 }).toFile(path.join(dir, 'full/0001.jpg'))
  await vision(['fg', path.join(dir, 'full'), path.join(dir, 'full')])
  const mk = await sharp(path.join(dir, 'full/0001.png')).greyscale().resize(fw, fh, { fit: 'fill' }).raw().toBuffer()
  const c = mainComponent(mk, fw, fh, 110)
  if (!c) throw new Error('keine Person im Bild')
  const W0 = m0.width, H0 = m0.height, k = W0 / fw
  const head = c.y0 * k, feet = (c.y1 + 1) * k, cx = (c.x0 + c.x1 + 1) / 2 * k
  const feetVisible = c.y1 < fh - 3
  let cw, ch, cy
  if (frame === 'card') {
    // Kartenkonvention (wie public/players/cutout/*): Scheitel 18,5 %, unten ≈ Hüfte
    const body = feetVisible ? feet - head : null
    // sichtbarer Körperteil (Scheitel → Unterkante) ≈ 37 % der Körperhöhe = 81,5 % der Bildhöhe
    ch = Math.min(body ? body * 0.454 : Infinity, (H0 - head) / CARD.bottom)
    cy = head - CARD.head * ch; cw = ch * CARD.w / CARD.h
  } else {
    ch = (feet - head) / (GS.feetY - GS.headY); cy = head - GS.headY * ch; cw = ch * GS.w / GS.h
  }
  const crop = { x: cx - cw / 2, y: cy, w: cw, h: ch }
  const outW = frame === 'card' ? CARD.w : GS.w, outH = frame === 'card' ? CARD.h : GS.h
  const ww = even(outW * WORK_SCALE), wh = even(outH * WORK_SCALE)
  // 2. Ausschnitt in Arbeitsauflösung (Rand mit Key-Farbe), ffmpeg-Key, Vision
  const ix0 = Math.max(0, Math.floor(crop.x)), iy0 = Math.max(0, Math.floor(crop.y)), ix1 = Math.min(W0, Math.ceil(crop.x + crop.w)), iy1 = Math.min(H0, Math.ceil(crop.y + crop.h))
  const s = ww / crop.w
  const part = await sharp(img).rotate().extract({ left: ix0, top: iy0, width: ix1 - ix0, height: iy1 - iy0 }).resize(Math.min(ww, Math.round((ix1 - ix0) * s)), Math.min(wh, Math.round((iy1 - iy0) * s)), { kernel: 'lanczos3', fit: 'fill' }).toBuffer()
  const pm = await sharp(part).metadata()
  const left = Math.max(0, Math.min(ww - pm.width, Math.round((ix0 - crop.x) * s))), top = Math.max(0, Math.min(wh - pm.height, Math.round((iy0 - crop.y) * s)))
  const bg = { r: Math.round(keyColor[0]), g: Math.round(keyColor[1]), b: Math.round(keyColor[2]) }
  await sharp({ create: { width: ww, height: wh, channels: 3, background: bg } }).composite([{ input: part, left, top }]).jpeg({ quality: 97, chromaSubsampling: '4:4:4' }).toFile(path.join(dir, 'src/0001.jpg'))
  const hex = '0x' + keyColor.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
  await ff(['-i', path.join(dir, 'src/0001.jpg'), '-vf', `format=yuva444p,chromakey=${hex}:0.11:0.07,alphaextract,format=gray`, '-frames:v', '1', path.join(dir, 'key/0001.png')])
  await vision(['fg', path.join(dir, 'src'), path.join(dir, 'mask')])
  await keyFrames({ dir, outW, outH, keyColor, personH: (feetVisible ? feet - head : H0 - head) * s, still: true, compareDir: path.join(dir, 'cmp') })
  return path.join(dir, 'rgba/0001.png')
}

// ── 8. Ein Spieler ────────────────────────────────────────────
async function buildPlayer(job) {
  const { player, clip, photo, takes, ana, confirmed } = job
  const slug = player.slug
  const dest = confirmed ? path.join(OUT, slug) : path.join(WORK, 'unbestaetigt', slug)
  fs.mkdirSync(dest, { recursive: true })
  const pdir = path.join(WORK, 'p', slug)
  const info = ana.info, res = { slug, id: player.id, assets: {} }
  const T = Object.fromEntries(takes.map((t) => [t.n, t]))
  const fa = (t) => ana.frames.slice(Math.round(t.start * 10), Math.round(t.end * 10)).filter(Boolean)
  const medBox = (fr) => ({ x0: median(fr.map((f) => f.x0)), x1: median(fr.map((f) => f.x1)), y0: median(fr.map((f) => f.y0)), y1: median(fr.map((f) => f.y1)) })
  const pxH = (b) => (b.y1 - b.y0) * info.h

  // Video-Takes: Schleife (2), Walkout (3), Jubel (4), Zeigen (5)
  const videos = [
    { take: 2, name: 'pose-loop', loop: true },
    { take: 3, name: 'walkout' },
    { take: 4, name: 'jubel', story: true },
    { take: 5, name: 'zeigen' },
  ]
  for (const v of videos) {
    const t = T[v.take]; if (!t) continue
    const fr = fa(t); if (fr.length < 5) { log(`  ${slug}: Take ${v.take} ohne Person`); continue }
    let box, ow = GS.w, oh = GS.h, crop
    if (v.story) {
      // Vereinigung aller Boxen + Rand, 9:16
      const u = { x0: Math.min(...fr.map((f) => f.x0)), x1: Math.max(...fr.map((f) => f.x1)), y0: Math.min(...fr.map((f) => f.y0)), y1: Math.max(...fr.map((f) => f.y1)) }
      ow = STORY.w; oh = STORY.h
      let ch = (u.y1 - u.y0) * info.h * 1.12, cw = Math.max(ch * ow / oh, (u.x1 - u.x0) * info.w * 1.1); ch = cw * oh / ow
      crop = { x: (u.x0 + u.x1) / 2 * info.w - cw / 2, y: u.y0 * info.h - ch * 0.05, w: cw, h: ch }
      box = u
    } else {
      // Walkout: Rahmen nach der End-Pose (Spieler wächst ins Bild); sonst Median
      box = v.take === 3 ? medBox(fr.slice(-8)) : medBox(fr)
      crop = cropFor(info, box, ow, oh)
    }
    const ww = even(ow * (v.story ? 1.25 : WORK_SCALE)), wh = even(oh * (v.story ? 1.25 : WORK_SCALE))
    const dir = path.join(pdir, v.name)
    const t0 = Date.now()
    await extractTake(clip, info, { t0: t.start, dur: t.end - t.start, crop, ww, wh, keyColor: ana.keyColor, dir })
    const k = await keyFrames({ dir, outW: ow, outH: oh, keyColor: ana.keyColor, personH: pxH(box) * ww / crop.w, compareDir: v.take === 2 ? path.join(pdir, 'cmp') : v.take === 4 ? path.join(pdir, 'cmp-jubel') : null })
    let loopInfo = null
    if (v.loop) loopInfo = await makeLoop(dir)
    const enc = await encodeClip(dir, path.join(dest, v.name), { loop: !!v.loop })
    res.assets[v.name] = { ...enc, loop: loopInfo, take: [t.start, t.end] }
    log(`  ${slug}/${v.name}: ${k.frames} Frames, ${enc.w}×${enc.h}, webm ${enc.kb.webm} KB · mov ${enc.kb.mov} KB · mp4 ${enc.kb.mp4} KB (${((Date.now() - t0) / 1000).toFixed(0)} s)${loopInfo ? ` · Loop ${loopInfo.mode} ${loopInfo.frames} F` : ''}`)
    if (!KEEP) for (const d of ['src', 'mask', 'rgba', 'lin', 'loop']) fs.rmSync(path.join(dir, d), { recursive: true, force: true })
  }
  // Standbilder: Seite (7), Ball (6) — ruhigstes Frame des Takes
  for (const [n, name] of [[7, 'seite'], [6, 'ball']]) {
    const t = T[n]; if (!t) continue
    const fr = fa(t); if (fr.length < 3) continue
    const still = fr.reduce((a, b) => (b.mv < a.mv ? b : a))
    const box = medBox(fr)
    const crop = cropFor(info, box, GS.w, GS.h)
    const dir = path.join(pdir, name)
    await extractTake(clip, info, { t0: still.t, crop, ww: even(GS.w * WORK_SCALE), wh: even(GS.h * WORK_SCALE), keyColor: ana.keyColor, dir, single: true })
    await keyFrames({ dir, outW: GS.w, outH: GS.h, keyColor: ana.keyColor, personH: pxH(box) * WORK_SCALE * GS.w / crop.w, still: true })
    await sharp(path.join(dir, 'rgba/0001.png')).webp({ quality: 88, alphaQuality: 95 }).toFile(path.join(dest, `${name}.webp`))
    res.assets[name] = { kb: Math.round(fs.statSync(path.join(dest, `${name}.webp`)).size / 1024), t: still.t }
    log(`  ${slug}/${name}.webp: ${res.assets[name].kb} KB (Standbild bei ${still.t.toFixed(1)} s)`)
  }
  // Karte: Foto (volle Auflösung), sonst ruhigstes Frame aus Take 1
  let cardSrc = photo ? await heicToJpg(photo) : null
  if (!cardSrc && T[1]) {
    const fr = fa(T[1]), still = fr.reduce((a, b) => (b.mv < a.mv ? b : a))
    cardSrc = path.join(pdir, 'take1.png')
    fs.mkdirSync(pdir, { recursive: true })
    await ff(['-ss', String(still.t), '-i', clip, '-frames:v', '1', '-vf', ['format=yuv444p', ...tonemap(info.hdr)].join(','), cardSrc])
  }
  if (cardSrc) {
    const png = await keyStill({ img: cardSrc, dir: path.join(pdir, 'card'), frame: 'card', keyColor: ana.keyColor })
    await sharp(png).webp({ quality: 90, alphaQuality: 96, smartSubsample: true }).toFile(path.join(dest, 'card.webp'))
    res.assets.card = { kb: Math.round(fs.statSync(path.join(dest, 'card.webp')).size / 1024), from: photo ? path.basename(photo) : 'Take 1' }
    log(`  ${slug}/card.webp: ${res.assets.card.kb} KB aus ${res.assets.card.from}`)
  }
  res.confirmed = confirmed
  fs.writeFileSync(path.join(dest, 'meta.json'), JSON.stringify({ ...res, clip: path.basename(clip), takes, built: new Date().toISOString() }, null, 1))
  return res
}

// ── 9. Registry + Zuordnungs-Doku ─────────────────────────────
function writeRegistry() {
  const entries = []
  if (fs.existsSync(OUT)) {
    for (const slug of fs.readdirSync(OUT).sort()) {
      const mf = path.join(OUT, slug, 'meta.json')
      if (!fs.existsSync(mf)) continue
      const m = JSON.parse(fs.readFileSync(mf, 'utf8'))
      const a = (n) => fs.existsSync(path.join(OUT, slug, n))
      const flags = {
        card: a('card.webp'), loop: a('pose-loop.webm'), walkout: a('walkout.webm'), jubel: a('jubel.webm'),
        zeigen: a('zeigen.webm'), seite: a('seite.webp'), ball: a('ball.webp'),
      }
      const on = Object.entries(flags).filter(([, v]) => v).map(([k]) => `${k}: true`).join(', ')
      entries.push(`  '${m.id}': { slug: '${slug}', ${on} },`)
    }
  }
  const ver = Date.now().toString(36)
  const ts = `// ─────────────────────────────────────────────────────────────
// GENERIERT von scripts/greenscreen/build.mjs — nicht von Hand pflegen.
// v17-G: Greenscreen-Assets je Player-/Staff-id (nur bestätigte Zuordnungen).
// Nutzung NICHT direkt, sondern über src/data/playerMedia.ts (playerMedia(id)).
// Doku: docs/GREENSCREEN.md
// ─────────────────────────────────────────────────────────────

export interface GreenscreenAsset {
  slug: string
  /** card.webp — Foto-Freisteller 800×1200 (Kartenkonvention wie /players/cutout) */
  card?: boolean
  /** pose-loop.{webm,mov,mp4,webp} — Take 2 als nahtlose Schleife */
  loop?: boolean
  /** walkout.* — Take 3 (Aufstellungs-Reveal) */
  walkout?: boolean
  /** jubel.* — Take 4, 1080×1920 (Tor-Videos) */
  jubel?: boolean
  /** zeigen.* — Take 5 (Man of the Match) */
  zeigen?: boolean
  /** seite.webp — Take 7 Standbild */
  seite?: boolean
  /** ball.webp — Take 6 Standbild */
  ball?: boolean
}

export const GREENSCREEN_VERSION = '${ver}'
export const GREENSCREEN_BASE = '/players/gs/'
/** Video-Geometrie (pose-loop, walkout, zeigen, seite): gleich WALKOUT_SIZE-Konvention, doppelte Auflösung. */
export const GREENSCREEN_SIZE = { w: ${GS.w}, h: ${GS.h}, headY: ${GS.headY}, feetY: ${GS.feetY} } as const

export const GREENSCREEN: Record<string, GreenscreenAsset> = {
${entries.join('\n')}
}
`
  fs.writeFileSync(REGISTRY, ts)
  log(`src/data/greenscreen.ts: ${entries.length} Spieler`)
}

function writeZuordnungDoc(rows, photos) {
  const st = { sicher: 'sicher', manuell: 'manuell (zuordnung.json)', unsicher: '**unsicher → prüfen**', ignoriert: 'ignoriert' }
  const fmt = (t) => (t ? `${t.start.toFixed(1)}–${t.end.toFixed(1)}` : '—')
  const lines = [
    '# Greenscreen: Zuordnung Clip → Spieler',
    '',
    `Generiert von \`scripts/greenscreen/build.mjs\` am ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}. Quelle: \`${SRC.replace(os.homedir(), '~')}\`.`,
    '',
    'Zuordnung über die Rückennummer, die der Spieler am Clip-Anfang in die Kamera hält (Apple-Vision-Texterkennung, je 4 Bilder/s in den ersten 3 s).',
    'Nur **sichere** oder **manuell bestätigte** Zuordnungen landen in `public/players/gs/` und auf der Website; unsichere Fälle werden im',
    'Arbeitsordner (`unbestaetigt/`) gebaut. Korrektur/Bestätigung: `scripts/greenscreen/zuordnung.json` (siehe docs/GREENSCREEN.md), dann erneut bauen.',
    '',
    '| Clip | Dauer | erkannt | Methode | Spieler | Status | Foto | Takes 1–7 (s) |',
    '|---|---|---|---|---|---|---|---|',
  ]
  for (const r of rows) {
    const tk = r.takes ? r.takes.map(fmt).join(' · ') : '—'
    const num = r.num?.number != null ? `**${r.num.number}**${r.num.alt?.length ? ` (alt. ${r.num.alt.join(', ')})` : ''}` : '—'
    lines.push(`| ${r.file} | ${r.dur.toFixed(0)} s | ${num} | ${r.num?.method ?? '—'}${r.num?.frames ? ` (${r.num.frames} Bilder)` : ''} | ${r.player ? `${r.player.name} (\`${r.player.id}\`)` : '—'} | ${st[r.status] ?? r.status}${r.note ? ` — ${r.note}` : ''} | ${r.photo ?? '—'} | ${tk} |`)
  }
  const lost = photos.filter((p) => !p.used)
  if (lost.length) {
    lines.push('', '## Fotos ohne Clip', '', 'Diese Fotos konnten keinem Clip zugeordnet werden (zeitlich zu weit weg). In `zuordnung.json` unter `fotos` eintragen:', '')
    for (const p of lost) lines.push(`- ${p.name} (${new Date(p.t).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })})`)
  }
  lines.push('', 'Kontaktbögen (Anfang/Mitte/Ende je Take) liegen im Arbeitsordner unter `kontakt/<clip>.jpg` — vor der Freigabe kurz ansehen.', '')
  fs.writeFileSync(DOC_ZUORDNUNG, lines.join('\n'))
}

// ── main ──────────────────────────────────────────────────────
async function main() {
  if (has('--registry-only')) { writeRegistry(); return }
  if (!fs.existsSync(SRC)) throw new Error(`Quellordner fehlt: ${SRC} (Option --src)`)
  const roster = loadRoster(), byNum = new Map(), byId = new Map(roster.map((p) => [p.id, p]))
  for (const p of roster) if (p.number != null && !p.staff) byNum.set(p.number, [...(byNum.get(p.number) ?? []), p])
  const ov = loadOverrides()
  const all = fs.readdirSync(SRC).filter((f) => !f.startsWith('.')).sort()
  const vids = all.filter((f) => /\.(mov|mp4|m4v)$/i.test(f))
  const pics = all.filter((f) => /\.(heic|heif|jpe?g|png)$/i.test(f))
  log(`${vids.length} Videos, ${pics.length} Fotos in ${SRC}`)

  // Fotos: Zeitpunkt (EXIF, sonst Dateizeit)
  const photos = []
  for (const f of pics) {
    const jpg = await heicToJpg(path.join(SRC, f))
    photos.push({ name: f, file: path.join(SRC, f), t: await photoTime(jpg, path.join(SRC, f)), used: false })
  }

  const rows = []
  await pool(vids, Math.max(1, JOBS), async (f) => {
    const file = path.join(SRC, f)
    const o = ov.clips?.[f] ?? {}
    const info = await probe(file)
    const row = { file: f, path: file, dur: info.dur, info }
    rows.push(row)
    if (o.ignore) { row.status = 'ignoriert'; return }
    log(`${f}: ${info.w}×${info.h}, ${info.fps} fps, ${info.dur.toFixed(1)} s${info.hdr ? ', HDR → SDR' : ''}`)
    const [ana, num] = await Promise.all([analyze(file, info), readNumber(file, info)])
    row.ana = ana; row.num = num
    if (o.id) {
      row.player = byId.get(o.id) ?? { id: o.id, name: o.id, slug: o.slug ?? o.id }
      row.status = 'manuell'
    } else if (num.number != null) {
      const cands = byNum.get(num.number) ?? []
      if (cands.length === 1) { row.player = cands[0]; row.status = num.sicher ? 'sicher' : 'unsicher' } else {
        row.status = 'unsicher'; row.note = cands.length ? `Nummer ${num.number} mehrfach vergeben` : `Nummer ${num.number} nicht im Kader`
      }
    } else { row.status = 'unsicher'; row.note = 'keine Nummer erkannt' }
    // Takes: manuell (Zeitmarken) oder automatisch
    const introEnd = num.number != null ? Math.min(6, num.lastT + 0.6) : 1
    const auto = detectTakes(ana, introEnd)
    const tk = auto?.takes ?? null
    if (tk && o.takes) for (const t of tk) if (o.takes[t.n]) { t.start = o.takes[t.n][0]; t.end = o.takes[t.n][1]; t.manuell = true }
    row.takes = tk
    if (tk) await contactSheet(ana, tk, path.join(WORK, 'kontakt', f.replace(/\W+/g, '_') + '.jpg')).catch((e) => log(`  Kontaktbogen ${f}: ${e.message}`))
    log(`${f}: Nummer ${num.number ?? '—'} (${num.method}) → ${row.player?.name ?? '?'} [${row.status}] · Takes ${tk ? tk.map((t) => `${t.n}:${t.start.toFixed(1)}–${t.end.toFixed(1)}`).join(' ') : '—'}`)
  })
  rows.sort((a, b) => a.file.localeCompare(b.file))

  // Foto → Clip: zeitlich nächster Clip davor (Foto direkt nach dem Video), max. 10 min
  const clipTimes = rows.filter((r) => r.player).map((r) => {
    const end = r.info.created ? new Date(r.info.created).getTime() + r.dur * 1000 : fs.statSync(r.path).mtimeMs
    return { r, start: end - r.dur * 1000, end }
  })
  for (const p of photos) {
    const manual = Object.entries(ov.fotos ?? {}).find(([n]) => n === p.name)
    if (manual) { const r = rows.find((x) => x.player?.id === manual[1]); if (r) { r.photo = p.name; r.photoFile = p.file; p.used = true } continue }
    const cand = clipTimes.filter((c) => c.start <= p.t && p.t - c.end < 10 * 60e3).sort((a, b) => b.start - a.start)[0]
    if (cand && !cand.r.photo) { cand.r.photo = p.name; cand.r.photoFile = p.file; p.used = true }
  }
  writeZuordnungDoc(rows, photos)
  if (DRY) { log('--dry: fertig (docs/GREENSCREEN_ZUORDNUNG.md, Kontaktbögen im Arbeitsordner)'); return }

  // Bauen
  const jobs = rows.filter((r) => r.player && r.takes && r.status !== 'ignoriert')
    .filter((r) => !ONLY.length || ONLY.includes(r.file) || ONLY.includes(r.player.id) || ONLY.includes(r.player.slug))
    .map((r) => ({ player: r.player, clip: r.path, photo: r.photoFile ?? null, takes: r.takes, ana: r.ana, confirmed: r.status === 'sicher' || r.status === 'manuell' }))
  const results = await pool(jobs, Math.max(1, JOBS), async (j) => {
    const t0 = Date.now()
    log(`▶ ${j.player.name} (${path.basename(j.clip)})${j.confirmed ? '' : ' — UNBESTÄTIGT, nur Arbeitsordner'}`)
    try { const r = await buildPlayer(j); log(`✓ ${j.player.name} in ${((Date.now() - t0) / 60000).toFixed(1)} min`); return r } catch (e) { log('FEHLER', j.player.name, e.stack ?? e.message); return null }
  })
  writeRegistry()
  const bad = results.filter((r) => !r).length
  log(`Fertig: ${results.length - bad} Spieler gebaut${bad ? `, ${bad} Fehler` : ''}. Arbeitsordner: ${WORK}`)
}

await main()
