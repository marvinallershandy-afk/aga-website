// ─────────────────────────────────────────────────────────────
// v20-K: Pack-Opening als Instagram-Reel (1080 × 1920, 7 s) — im Browser
// per Canvas + MediaRecorder, ohne Server. MP4 (H.264), wo der Browser es
// aufnehmen kann (Safari, Chrome ≥ 126), sonst WebM (VP9/VP8).
//
// Ablauf (gleiche Dramaturgie wie das Pack-Öffnen im Album):
//   0,0–1,3 s  Tütchen schwebt, Folie glänzt
//   1,3–2,0 s  Lasche reißt auf, Licht der Seltenheit leuchtet durch
//   2,0–2,6 s  Lichtblitz, Karte steigt verdeckt heraus
//   2,6–3,7 s  Kamerafahrt: Karte fliegt heran, Strahlen drehen
//   3,7–4,4 s  Karte dreht sich um
//   4,4–6,2 s  Karte mit wanderndem Folienglanz, Name + Seltenheit
//   6,2–7,0 s  Abspann: „Neue Karte im Album" + aga-erste.de/album
// Die Karte wird einmal vorgerendert (Grundbild), pro Frame kommt nur die
// Folie darüber → flüssig auch auf dem Handy.
// ─────────────────────────────────────────────────────────────
import { ladeKartenAssets, zeichneFolie, zeichneKarte, F_DISPLAY, F_TEXT } from '../zeichnen'
import { canvasPfad, UMRISS } from '../geometrie'
import { ladeBild } from '../medien'
import { SELTEN_NAME, type KartenDaten } from '../typen'
import { STORY_H, STORY_W, zeichneBuehne } from './bild'

export interface ReelOpts {
  kicker?: string
  abspann?: string
  dauer?: number
  fps?: number
  /** Fortschritt 0…1 (Anzeige im Admin) */
  onFortschritt?: (p: number) => void
}

const ease = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3)
const easeInOut = (t: number) => {
  const x = Math.max(0, Math.min(1, t))
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}
const zwischen = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)))

function abstand(ctx: CanvasRenderingContext2D, px: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  if ('letterSpacing' in c) c.letterSpacing = `${px}px`
}

export function reelFormat(): { mime: string; endung: 'mp4' | 'webm' } | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const mime of ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return { mime, endung: mime.startsWith('video/mp4') ? 'mp4' : 'webm' }
    } catch {
      /* weiter */
    }
  }
  return null
}

function zeichneTuete(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, t: number, riss: number, wappen: HTMLImageElement | null, licht: string) {
  const h = w * 1.48
  const x = cx - w / 2
  const y = cy - h / 2
  const lasche = h * 0.145
  const koerper = (yy: number, hh: number) => {
    const g = ctx.createLinearGradient(x, yy, x + w * 0.4, yy + hh)
    g.addColorStop(0, '#ec2633')
    g.addColorStop(0.38, '#b0131c')
    g.addColorStop(0.78, '#4a080d')
    g.addColorStop(1, '#1c0507')
    ctx.fillStyle = g
    ctx.fillRect(x, yy, w, hh)
    // Glanzbahn
    const gx = x + w * (0.5 + Math.sin(t * 1.2) * 0.35)
    const s = ctx.createLinearGradient(gx - w * 0.3, yy, gx + w * 0.3, yy + hh * 0.3)
    s.addColorStop(0.3, 'rgba(255,255,255,0)')
    s.addColorStop(0.5, 'rgba(255,255,255,0.22)')
    s.addColorStop(0.7, 'rgba(255,255,255,0)')
    ctx.fillStyle = s
    ctx.fillRect(x, yy, w, hh)
    // Siegelnaht
    for (let i = 0; i < w; i += 9) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(x + i, yy + hh - 14, 4.5, 14)
    }
  }
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 60
  ctx.shadowOffsetY = 30
  ctx.fillStyle = '#1c0507'
  ctx.fillRect(x, y + lasche, w, h - lasche)
  ctx.restore()
  koerper(y + lasche, h - lasche)
  if (wappen) {
    const ww = w * 0.34
    ctx.drawImage(wappen, cx - ww / 2, y + h * 0.27, ww, ww * (wappen.naturalHeight / wappen.naturalWidth))
  }
  ctx.textAlign = 'center'
  ctx.fillStyle = '#F4F2EF'
  ctx.font = `${w * 0.15}px ${F_DISPLAY}`
  ctx.fillText('SAMMELKARTEN', cx, y + h * 0.66)
  ctx.font = `700 ${w * 0.042}px ${F_TEXT}`
  abstand(ctx, w * 0.01)
  ctx.fillText('SAISON 2026/27 · SV AGATHENBURG-DOLLERN', cx, y + h * 0.72)
  abstand(ctx, 0)
  // Lasche
  ctx.save()
  ctx.translate(x + riss * w * 0.7, y + lasche - riss * h * 0.5)
  ctx.rotate(-riss * 0.5)
  ctx.globalAlpha = 1 - Math.max(0, riss - 0.6) * 2.5
  const g = ctx.createLinearGradient(0, -lasche, w, 0)
  g.addColorStop(0, '#ec2633')
  g.addColorStop(1, '#7a0d14')
  ctx.fillStyle = g
  ctx.fillRect(0, -lasche, w, lasche)
  ctx.setLineDash([10, 8])
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(w * 0.06, -4)
  ctx.lineTo(w * 0.94, -4)
  ctx.stroke()
  ctx.restore()
  // Spalt mit Licht
  if (riss > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const sg = ctx.createLinearGradient(0, y + lasche - 40, 0, y + lasche + 40)
    sg.addColorStop(0, `rgba(${licht},0)`)
    sg.addColorStop(0.5, `rgba(${licht},${0.9 * Math.min(1, riss * 1.5)})`)
    sg.addColorStop(1, `rgba(${licht},0)`)
    ctx.fillStyle = sg
    ctx.fillRect(x, y + lasche - 40, w * Math.min(1, riss * 1.4), 80)
    ctx.restore()
  }
}

const LICHT: Record<string, string> = { bronze: '233,29,41', silber: '214,224,236', gold: '232,193,90', spezial: '255,160,200' }

/** Rendert das Reel einer Karte und gibt die Video-Datei zurück. */
export async function kartenReel(d: KartenDaten, opts: ReelOpts = {}): Promise<{ blob: Blob; endung: 'mp4' | 'webm' }> {
  const format = reelFormat()
  if (!format) throw new Error('Dieser Browser kann keine Videos aufnehmen.')
  const dauer = opts.dauer ?? 7
  const fps = opts.fps ?? 30
  const [a, wappen] = await Promise.all([ladeKartenAssets(d), ladeBild('/brand/aga-logo.png')])
  const KW = 720
  const KH = KW * 1.4
  // Grundbilder einmal (Vorder- und Rückseite)
  const grund = document.createElement('canvas')
  grund.width = KW + 40
  grund.height = KH + 160
  zeichneKarte(grund.getContext('2d')!, d, a, 20, 120, KW, { ohneFolie: true, zeit: 2 })
  const rueck = await rueckseiteBild(KW, wappen)

  const c = document.createElement('canvas')
  c.width = STORY_W
  c.height = STORY_H
  const ctx = c.getContext('2d')!
  const stream = c.captureStream(fps)
  const rec = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: 9_000_000 })
  const teile: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && teile.push(e.data)
  const fertig = new Promise<void>((res) => (rec.onstop = () => res()))

  const frame = (t: number) => {
    const s = d.seltenheit
    const licht = LICHT[s]
    const walk = s === 'gold' || s === 'spezial'
    const bueh = t < 2 ? 0.35 : 0.35 + 0.65 * ease(zwischen(t, 2.0, 3.0))
    zeichneBuehne(ctx, s, t * (walk ? 1 : 0.4), bueh)
    // Blitz
    const blitz = Math.max(0, 1 - Math.abs(t - 2.2) / 0.35)
    if (blitz > 0) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const g = ctx.createRadialGradient(STORY_W / 2, STORY_H * 0.44, 0, STORY_W / 2, STORY_H * 0.44, 900)
      g.addColorStop(0, `rgba(255,255,255,${0.9 * blitz})`)
      g.addColorStop(0.3, `rgba(${licht},${0.5 * blitz})`)
      g.addColorStop(1, `rgba(${licht},0)`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, STORY_W, STORY_H)
      ctx.restore()
    }
    // Kopf
    ctx.save()
    ctx.textAlign = 'center'
    ctx.font = `800 30px ${F_TEXT}`
    abstand(ctx, 7)
    ctx.fillStyle = '#E91D29'
    ctx.fillText((opts.kicker ?? 'PACK-OPENING').toUpperCase(), STORY_W / 2 + 3, 190)
    ctx.font = `800 24px ${F_TEXT}`
    abstand(ctx, 5)
    ctx.fillStyle = 'rgba(244,242,239,0.7)'
    ctx.fillText('SV AGATHENBURG-DOLLERN · SAMMELALBUM', STORY_W / 2 + 2, 236)
    ctx.restore()

    if (t < 2.4) {
      const riss = ease(zwischen(t, 1.3, 2.0))
      const fall = ease(zwischen(t, 1.9, 2.4))
      ctx.save()
      ctx.globalAlpha = 1 - fall
      ctx.translate(0, fall * 500 + Math.sin(t * 2) * 10)
      zeichneTuete(ctx, STORY_W / 2, STORY_H * 0.47, 600, t, riss, wappen, licht)
      ctx.restore()
    }
    if (t >= 2.0) {
      // Karte: steigt heraus → Kamerafahrt → Drehung
      const steig = ease(zwischen(t, 2.0, 2.6))
      const kamera = easeInOut(zwischen(t, 2.6, 3.7))
      const dreh = easeInOut(zwischen(t, 3.7, 4.4))
      const skala = t < 2.6 ? 0.55 + steig * 0.1 : 0.65 + kamera * 0.35
      const spin = walk ? (1 - kamera) * Math.PI * 2 : 0
      const winkel = spin + dreh * Math.PI // 0 = Rücken, π = Vorderseite
      const sx = Math.cos(winkel)
      const cx = STORY_W / 2
      const cy = STORY_H * 0.47 + (1 - steig) * 260
      const w = KW * skala
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(Math.max(0.02, Math.abs(sx)), 1)
      const vorne = dreh > 0.5
      if (vorne) {
        ctx.drawImage(grund, -w / 2 - 20 * skala, -w * 0.7 - 120 * skala, grund.width * skala, grund.height * skala)
        const mx = 0.15 + zwischen(t, 4.2, 6.2) * 0.75
        zeichneFolie(ctx, d, a, -w / 2, -w * 0.7, w, { mx, my: 0.25 + zwischen(t, 4.2, 6.2) * 0.3, licht: 0.7 })
      } else {
        ctx.drawImage(rueck, -w / 2, -w * 0.7, w, w * 1.4)
      }
      ctx.restore()
    }
    // Name + Seltenheit
    const info = ease(zwischen(t, 4.5, 5.0))
    if (info > 0) {
      ctx.save()
      ctx.globalAlpha = info
      ctx.textAlign = 'center'
      ctx.fillStyle = '#F4F2EF'
      ctx.font = `${84}px ${F_DISPLAY}`
      ctx.fillText(d.titel.toUpperCase(), STORY_W / 2, STORY_H * 0.47 + KH / 2 + 130 + (1 - info) * 20)
      ctx.font = `800 28px ${F_TEXT}`
      abstand(ctx, 6)
      ctx.fillStyle = s === 'gold' ? '#E8C15A' : 'rgba(244,242,239,0.75)'
      ctx.fillText(`${SELTEN_NAME[s]}${d.variante ? '-GLANZ' : ''}${d.limitiert ? ' · LIMITIERT' : ''}${d.serie ? ` · ${d.serie}` : ''}`.toUpperCase(), STORY_W / 2 + 3, STORY_H * 0.47 + KH / 2 + 185)
      ctx.restore()
    }
    // Abspann
    const ab = ease(zwischen(t, 6.1, 6.6))
    if (ab > 0) {
      ctx.save()
      ctx.fillStyle = `rgba(7,5,6,${0.82 * ab})`
      ctx.fillRect(0, STORY_H - 330, STORY_W, 330)
      ctx.globalAlpha = ab
      ctx.textAlign = 'center'
      ctx.fillStyle = '#F4F2EF'
      ctx.font = `64px ${F_DISPLAY}`
      ctx.fillText((opts.abspann ?? 'Neue Karte im Album').toUpperCase(), STORY_W / 2, STORY_H - 200)
      ctx.font = `800 28px ${F_TEXT}`
      abstand(ctx, 5)
      ctx.fillStyle = 'rgba(244,242,239,0.7)'
      ctx.fillText('AGA-ERSTE.DE/ALBUM  ·  @SVAGATHENBURG', STORY_W / 2 + 2, STORY_H - 135)
      ctx.fillStyle = '#E91D29'
      ctx.fillRect(STORY_W / 2 - 60, STORY_H - 100, 120, 4)
      ctx.restore()
    }
  }

  frame(0)
  rec.start(250)
  const t0 = performance.now()
  await new Promise<void>((res) => {
    const schritt = () => {
      const t = (performance.now() - t0) / 1000
      if (t >= dauer) {
        frame(dauer)
        res()
        return
      }
      frame(t)
      opts.onFortschritt?.(t / dauer)
      requestAnimationFrame(schritt)
    }
    requestAnimationFrame(schritt)
  })
  rec.stop()
  await fertig
  stream.getTracks().forEach((tr) => tr.stop())
  return { blob: new Blob(teile, { type: format.mime.split(';')[0] }), endung: format.endung }
}

/** Kartenrücken als Bild (wie <KartenRuecken/>). */
async function rueckseiteBild(W: number, wappen: HTMLImageElement | null): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas')
  c.width = W
  c.height = W * 1.4
  const ctx = c.getContext('2d')!
  const H = W * 1.4
  ctx.save()
  canvasPfad(ctx, UMRISS, 0, 0, W)
  ctx.clip()
  const g = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, H * 0.75)
  g.addColorStop(0, '#6a141d')
  g.addColorStop(0.52, '#2a0a0e')
  g.addColorStop(1, '#0d0809')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.restore()
  ctx.save()
  canvasPfad(ctx, UMRISS, 0, 0, W)
  ctx.strokeStyle = 'rgba(244,242,239,0.35)'
  ctx.lineWidth = W * 0.008
  ctx.stroke()
  ctx.restore()
  if (wappen) {
    const ww = W * 0.34
    ctx.drawImage(wappen, W / 2 - ww / 2, H * 0.3, ww, ww * (wappen.naturalHeight / wappen.naturalWidth))
  }
  ctx.textAlign = 'center'
  ctx.fillStyle = '#F4F2EF'
  ctx.font = `${W * 0.09}px ${F_DISPLAY}`
  ctx.fillText('SAMMELKARTE', W / 2, H * 0.67)
  return c
}

