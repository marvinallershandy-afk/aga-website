#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// v17-G: Synthetisches Testmaterial für die Greenscreen-Pipeline.
// Montiert einen vorhandenen Freisteller (public/players/cutout/*.webp) auf
// ein absichtlich „schwieriges“ Greenscreen-Grün und kodiert eine 4K60-
// Hochkant-Aufnahme im Ablauf des Drehplans (Nummer zeigen → 7 Takes).
//
// Absichtliche Störungen (die die Pipeline beheben muss):
//   · Lichtverlauf + Vignette auf dem Tuch, dunkleres Boden-Tuch, Falten
//   · Tuchkante oben (Wand sichtbar) + Stativ/Lampenstativ rechts im Bild
//   · Grünschimmer (Spill) an den Kanten und leicht auf dem ganzen Spieler
//   · grünliche Stelle auf dem Trikot (darf KEIN Loch werden)
//   · Sensorrauschen, leichtes Helligkeits-Flackern, Bewegung je Take
//
//   node scripts/greenscreen/synth-test.mjs --out <ordner> [--player tobias-helck --number 24 --name IMG_0001]
//        [--seconds 43] [--photo] [--nonumber]
// Ergebnis: <out>/<name>.MOV (HEVC 4K60, hvc1) und optional <name>_FOTO.HEIC.
// Nur für Tests — gehört nicht in public/.
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

const args = process.argv.slice(2)
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const has = (k) => args.includes(k)
const OUT = arg('--out')
if (!OUT) throw new Error('--out <ordner> fehlt')
const PLAYER = arg('--player', 'tobias-helck')
const NUMBER = arg('--number', '24')
const NAME = arg('--name', 'IMG_0001')
const SECONDS = +arg('--seconds', '43')
const NONUMBER = has('--nonumber')
const W = 2160, H = 3840
const tmp = path.join(OUT, `.synth-${NAME}`)
fs.mkdirSync(tmp, { recursive: true })

// ── 1. Hintergrund-Platte: Tuch mit Verlauf, Boden, Falten, Kante, Stativ ──
async function background() {
  const buf = Buffer.alloc(W * H * 3)
  const floorY = Math.round(H * 0.8)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W - 0.5, v = y / H - 0.42
      // Licht: oben-mitte heller, Ecken dunkler (±18 %)
      let L = 1.06 - 0.55 * (u * u + v * v * 0.7)
      // Falten: diagonale, niederfrequente Streifen
      L *= 1 - 0.05 * Math.max(0, Math.sin((x * 0.8 + y) / 140)) * Math.sin(y / 900 + 1)
      let r = 38, g = 168, b = 72
      if (y > floorY) { // Boden-Tuch: anders beleuchtet, gelblicher, dunkler
        const k = Math.min(1, (y - floorY) / 120)
        r += 10 * k; g -= 32 * k; b -= 14 * k; L *= 1 - 0.1 * k
        // weicher Schatten unter dem Spieler
        const sx = (x - W / 2) / 700, sy = (y - (H - 140)) / 160
        L *= 1 - 0.35 * Math.exp(-(sx * sx + sy * sy))
      }
      // Tuchkante: oben links/rechts sieht man die Wand (grau-beige)
      const edge = 110 + Math.max(0, 520 - y) * 0.45
      if (x < edge - 260 || x > W - edge + 220) { r = 128; g = 122; b = 112; L = 0.95 }
      const i = (y * W + x) * 3
      buf[i] = Math.min(255, r * L); buf[i + 1] = Math.min(255, g * L); buf[i + 2] = Math.min(255, b * L)
    }
  }
  // Lampenstativ rechts: Stange + Beine (dunkelgrau, matt)
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="1905" y="900" width="26" height="2700" fill="#2d2d30"/>
    <rect x="1860" y="860" width="120" height="70" rx="10" fill="#1c1c1f"/>
    <line x1="1918" y1="3550" x2="1780" y2="3830" stroke="#2a2a2d" stroke-width="20"/>
    <line x1="1918" y1="3550" x2="2080" y2="3830" stroke="#2a2a2d" stroke-width="20"/>
    <line x1="1918" y1="3550" x2="1930" y2="3840" stroke="#2a2a2d" stroke-width="18"/>
  </svg>`
  await sharp(buf, { raw: { width: W, height: H, channels: 3 } })
    .composite([{ input: Buffer.from(svg) }])
    .png({ compressionLevel: 2 }).toFile(path.join(tmp, 'bg.png'))
}

// ── 2. Spieler: hochskaliert, mit Grünschimmer + grünlicher Trikotstelle ──
async function subject() {
  const SW = 1800, SH = 2700
  const { data, info } = await sharp(path.join(ROOT, 'public/players/cutout', `${PLAYER}.webp`))
    .ensureAlpha().resize(SW, SH, { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true })
  // Kantennähe = 1 − weichgezeichnetes Alpha (innen)
  const a = Buffer.alloc(SW * SH)
  for (let i = 0; i < SW * SH; i++) a[i] = data[i * 4 + 3]
  const blur = await sharp(a, { raw: { width: SW, height: SH, channels: 1 } }).blur(18).extractChannel(0).raw().toBuffer()
  for (let i = 0; i < SW * SH; i++) {
    const al = data[i * 4 + 3]
    if (!al) continue
    const edge = Math.max(0, 1 - blur[i] / 255) * 2.2 // 0 innen … ~1 am Rand
    const s = Math.min(1, 0.06 + edge) // überall leichter Schimmer, am Rand stark
    data[i * 4] = Math.max(0, data[i * 4] - 18 * s)
    data[i * 4 + 1] = Math.min(255, data[i * 4 + 1] + 70 * s)
    data[i * 4 + 2] = Math.max(0, data[i * 4 + 2] - 10 * s)
  }
  // grünliche Stelle auf dem Trikot (Reflexion): Rechteck im Brustbereich
  const x0 = Math.round(SW * 0.56), x1 = Math.round(SW * 0.7), y0 = Math.round(SH * 0.72), y1 = Math.round(SH * 0.8)
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * SW + x) * 4
    if (data[i + 3] < 250) continue
    const l = (data[i] + data[i + 1] + data[i + 2]) / 3
    data[i] = l * 0.55; data[i + 1] = Math.min(255, l * 1.25 + 30); data[i + 2] = l * 0.6
  }
  await sharp(data, { raw: { width: SW, height: SH, channels: 4 } }).png({ compressionLevel: 2 }).toFile(path.join(tmp, 'subject.png'))
  return { SW, SH }
}

async function props() {
  const paper = `<svg width="820" height="560" xmlns="http://www.w3.org/2000/svg">
    <rect width="820" height="560" rx="18" fill="#f7f6f2"/>
    <text x="410" y="455" font-family="Arial Black, Arial, Helvetica" font-weight="900" font-size="460" text-anchor="middle" fill="#111">${NUMBER}</text>
  </svg>`
  await sharp(Buffer.from(paper)).png().toFile(path.join(tmp, 'paper.png'))
  const ball = `<svg width="360" height="360" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="g" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b9b9b4"/></radialGradient></defs>
    <circle cx="180" cy="180" r="176" fill="url(#g)"/>
    <polygon points="180,120 237,161 215,228 145,228 123,161" fill="#141414"/>
    <polygon points="180,8 230,30 180,60 130,30" fill="#141414"/>
    <polygon points="20,150 60,120 70,190 30,215" fill="#141414"/>
    <polygon points="340,150 300,120 290,190 330,215" fill="#141414"/>
    <polygon points="95,320 130,290 160,345" fill="#141414"/>
    <polygon points="265,320 230,290 200,345" fill="#141414"/>
  </svg>`
  await sharp(Buffer.from(ball)).png().toFile(path.join(tmp, 'ball.png'))
}

// ── 3. Bewegungsablauf (Drehplan) als stückweise lineare Kurven ──
// [t, Wert]-Stützstellen → ffmpeg-Ausdruck
function pw(keys) {
  let e = String(keys[keys.length - 1][1])
  for (let i = keys.length - 2; i >= 0; i--) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1]
    const seg = t1 > t0 ? `(${v0}+(${v1 - v0})*(t-${t0})/${t1 - t0})` : String(v1)
    e = `if(lt(t,${t1}),${seg},${e})`
  }
  return `if(lt(t,${keys[0][0]}),${keys[0][1]},${e})`
}
// Zeitplan (s): Intro 0–3 (Nummer 0.3–2.7) · T1 4–9 · T2 10.5–14.5 · T3 16–21 ·
// T4 22.5–27.5 · T5 29–32 · T6 34–37 · T7 38.5–41.5
const PLAN = { intro: [0, 3], t1: [4, 9], t2: [10.5, 14.5], t3: [16, 21], t4: [22.5, 27.5], t5: [29, 32], t6: [34, 37], t7: [38.5, 41.5] }
// Maßstab (Walkout: von 0.8 auf 1.0 heran; Fingerzeig leicht vor)
const S = pw([[0, 1], [14.6, 1], [15.8, 0.8], [16.2, 0.8], [19, 1], [28.8, 1], [29.4, 1.03], [32, 1.03], [32.6, 1]])
// Breite (seitlich: schmaler)
const SX = pw([[0, 1], [37.8, 1], [38.4, 0.62], [41.6, 0.62], [42.2, 1]])
// Lage x (Jubel: zur Seite und zurück, Pausen: kleine Schritte)
const DX = `${pw([[0, 0], [9.2, 0], [10, 40], [10.4, 0], [22.5, 0], [23.6, -260], [24.8, 210], [26, -160], [27.2, 120], [28, 0], [32.2, 0], [33, -120], [34, 0]])}+6*sin(t*1.7)`
// Lage y (Kopf-hoch-Nicken, Gehen wippt, Jubel springt)
const DY = `${pw([[0, 0], [10.5, 0], [11, 70], [12.6, 70], [13.6, 0], [14.5, 0]])}+if(between(t,16,19),18*abs(sin(t*PI*1.8)),0)-if(between(t,23,27.3),150*abs(sin((t-23)*PI*1.4)),0)+4*sin(t*2.3)`

async function encode({ SW, SH }) {
  const file = path.join(OUT, `${NAME}.MOV`)
  const sw = `trunc(${SW}*(${S})*(${SX})/2)*2`, sh = `trunc(${SH}*(${S})/2)*2`
  const fc = [
    `[1:v]scale=w='${sw}':h='${sh}':eval=frame[s]`,
    `[0:v][s]overlay=x='(W-w)/2+(${DX})':y='H-h+(${DY})':eval=frame[a]`,
    NONUMBER ? `[a]null[b]` : `[a][2:v]overlay=x='(W-w)/2+20':y='2380+8*sin(t*3)':enable='between(t,0.3,2.7)'[b]`,
    `[b][3:v]overlay=x='(W-w)/2+520':y='2900+10*sin(t*2)':enable='between(t,${PLAN.t6[0] - 0.4},${PLAN.t6[1] + 0.3})'[c]`,
    `[c]eq=brightness='0.012*sin(2*PI*t*0.4)':eval=frame,noise=c0s=7:c1s=4:c2s=4:allf=t,format=yuv420p[v]`,
  ].join(';')
  await run(FF, ['-v', 'error', '-y',
    '-loop', '1', '-framerate', '60', '-i', path.join(tmp, 'bg.png'),
    '-loop', '1', '-framerate', '60', '-i', path.join(tmp, 'subject.png'),
    '-loop', '1', '-framerate', '60', '-i', path.join(tmp, 'paper.png'),
    '-loop', '1', '-framerate', '60', '-i', path.join(tmp, 'ball.png'),
    '-filter_complex', fc, '-map', '[v]', '-t', String(SECONDS), '-r', '60',
    '-c:v', 'hevc_videotoolbox', '-b:v', '45M', '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p', file], { maxBuffer: 1 << 26 })
  return file
}

async function photo({ SW, SH }) {
  // Foto in voller Auflösung (3024×4032), Pose wie Take 1, danach HEIC
  const PW = 3024, PH = 4032, k = PW / W
  const bg = await sharp(path.join(tmp, 'bg.png')).resize(PW, PH).toBuffer()
  const sub = await sharp(path.join(tmp, 'subject.png')).resize(Math.round(SW * k), Math.round(SH * k)).toBuffer()
  const jpg = path.join(tmp, `${NAME}_FOTO.jpg`)
  await sharp(bg).composite([{ input: sub, left: Math.round((PW - SW * k) / 2), top: PH - Math.round(SH * k) }]).jpeg({ quality: 93 }).toFile(jpg)
  const heic = path.join(OUT, `${NAME.replace(/\d+$/, (d) => String(+d + 1).padStart(d.length, '0'))}.HEIC`)
  await run('sips', ['-s', 'format', 'heic', jpg, '--out', heic])
  return heic
}

await background()
const dims = await subject()
await props()
const t0 = Date.now()
const mov = await encode(dims)
console.log('Clip:', mov, `${(fs.statSync(mov).size / 1e6).toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(0)} s`)
if (has('--photo')) {
  // Foto 20 s „nach“ dem Clip aufgenommen (Dateizeit) → Zuordnung über die Uhrzeit
  const h = await photo(dims)
  const st = fs.statSync(mov)
  fs.utimesSync(h, new Date(st.mtimeMs + 20e3), new Date(st.mtimeMs + 20e3))
  console.log('Foto:', h)
}
fs.rmSync(tmp, { recursive: true, force: true })
console.log('Plan (Soll-Takes, s):', JSON.stringify(PLAN))
