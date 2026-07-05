import type { Player } from '../data/players'
import { POSITION_LABEL } from '../data/players'
import { CLUB } from '../data/club'

// ─────────────────────────────────────────────────────────────
// One-Tap Instagram-Story-Share. Rendert die Karte clientseitig als
// 1080×1920-PNG (Canvas) und teilt via navigator.share({files}) mit
// Feature-Detection; Fallback: Download.
// ─────────────────────────────────────────────────────────────

const W = 1080
const H = 1920

// Vereinswappen einmal vorladen (fürs Story-Bild)
const crestImage = typeof Image !== 'undefined' ? new Image() : null
if (crestImage) crestImage.src = '/brand/wappen.png'

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Zeichnet das Story-Bild und liefert den Canvas zurück. */
export function renderStoryCanvas(player: Player): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Hintergrund: dunkler Verlauf
  const bg = ctx.createRadialGradient(W / 2, H * 0.42, 100, W / 2, H * 0.5, H * 0.75)
  bg.addColorStop(0, '#241a2c')
  bg.addColorStop(0.5, '#141019')
  bg.addColorStop(1, '#08070a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // diffuser roter Glow oben
  const glow = ctx.createRadialGradient(W / 2, 260, 40, W / 2, 260, 520)
  glow.addColorStop(0, 'rgba(233,29,41,0.35)')
  glow.addColorStop(1, 'rgba(233,29,41,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, 700)

  // Kopf-Branding — "SVA" mittig, A in Rot
  ctx.font = '400 52px Anton, system-ui'
  ctx.textAlign = 'left'
  const svW = ctx.measureText('SV').width
  const aW = ctx.measureText('A').width
  const startX = W / 2 - (svW + aW) / 2
  ctx.fillStyle = '#fff'
  ctx.fillText('SV', startX, 150)
  ctx.fillStyle = '#E91D29'
  ctx.fillText('A', startX + svW, 150)
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '600 22px Archivo, system-ui'
  ctx.fillText(CLUB.name.toUpperCase(), W / 2, 195)

  // Karte
  const cw = 640
  const ch = 900
  const cx = (W - cw) / 2
  const cy = 300

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 60
  ctx.shadowOffsetY = 30
  const cardGrad = ctx.createRadialGradient(W / 2, cy, 80, W / 2, cy + ch, ch)
  cardGrad.addColorStop(0, '#3a2c14')
  cardGrad.addColorStop(0.4, '#231f20')
  cardGrad.addColorStop(1, '#14100f')
  ctx.fillStyle = cardGrad
  roundRect(ctx, cx, cy, cw, ch, 40)
  ctx.fill()
  ctx.restore()

  // Goldrahmen
  ctx.strokeStyle = 'rgba(232,193,90,0.7)'
  ctx.lineWidth = 3
  roundRect(ctx, cx + 16, cy + 16, cw - 32, ch - 32, 28)
  ctx.stroke()

  // Holo-Diagonalstreifen (dezent)
  ctx.save()
  roundRect(ctx, cx + 8, cy + 8, cw - 16, ch - 16, 32)
  ctx.clip()
  const holo = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch)
  holo.addColorStop(0, 'rgba(255,0,200,0.10)')
  holo.addColorStop(0.3, 'rgba(0,229,255,0.10)')
  holo.addColorStop(0.6, 'rgba(124,255,0,0.08)')
  holo.addColorStop(1, 'rgba(255,212,0,0.10)')
  ctx.fillStyle = holo
  for (let i = -ch; i < cw + ch; i += 90) {
    ctx.fillRect(cx + i, cy, 34, ch)
  }
  ctx.restore()

  // Rating + Position
  ctx.textAlign = 'left'
  ctx.fillStyle = '#E8C15A'
  ctx.font = '400 110px Anton, system-ui'
  ctx.fillText(String(player.rating), cx + 60, cy + 150)
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = '800 34px Archivo, system-ui'
  ctx.fillText(player.position, cx + 70, cy + 200)

  // Echtes Vereinswappen (falls geladen — sonst leer lassen)
  if (crestImage?.complete && crestImage.naturalWidth > 0) {
    const crw = 82
    const crh = crw * (crestImage.naturalHeight / crestImage.naturalWidth)
    ctx.drawImage(crestImage, cx + cw - crw - 52, cy + 48, crw, crh)
  }

  // Nummer-Wasserzeichen
  ctx.fillStyle = 'rgba(232,193,90,0.10)'
  ctx.font = '400 360px Anton, system-ui'
  ctx.textAlign = 'right'
  ctx.fillText(String(player.number), cx + cw - 40, cy + 560)

  // Silhouette (Kopf + Schulter-Büste)
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  const sx = W / 2
  const sy = cy + 300
  ctx.beginPath()
  ctx.arc(sx, sy, 88, 0, Math.PI * 2) // Kopf
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(sx, cy + 640, 190, 150, 0, Math.PI, Math.PI * 2, false) // Schultern (obere Hälfte)
  ctx.fill()

  // Name
  ctx.textAlign = 'center'
  ctx.fillStyle = '#fff'
  ctx.font = '400 66px Anton, system-ui'
  ctx.fillText(player.name.toUpperCase(), W / 2, cy + 730)

  // goldene Trennlinie
  const lg = ctx.createLinearGradient(cx + 120, 0, cx + cw - 120, 0)
  lg.addColorStop(0, 'rgba(232,193,90,0)')
  lg.addColorStop(0.5, 'rgba(232,193,90,0.8)')
  lg.addColorStop(1, 'rgba(232,193,90,0)')
  ctx.fillStyle = lg
  ctx.fillRect(cx + 120, cy + 755, cw - 240, 2)

  // Stats
  const stats = [
    [player.stats.games, 'SPIELE'],
    [player.stats.goals, 'TORE'],
    [player.stats.assists, 'ASSISTS'],
  ] as const
  const colW = (cw - 120) / 3
  stats.forEach(([val, label], i) => {
    const x = cx + 60 + colW * i + colW / 2
    ctx.fillStyle = '#E8C15A'
    ctx.font = '400 62px Anton, system-ui'
    ctx.fillText(String(val), x, cy + 835)
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = '700 22px Archivo, system-ui'
    ctx.fillText(label, x, cy + 872)
  })

  // Fuß-Branding
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '700 26px Archivo, system-ui'
  ctx.fillText(POSITION_LABEL[player.position].toUpperCase() + ' · #' + player.number, W / 2, cy + ch + 90)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = '600 22px Archivo, system-ui'
  ctx.fillText(CONTACT_INSTA, W / 2, cy + ch + 130)

  return canvas
}

const CONTACT_INSTA = '@sva_fussball'

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })
}

export type ShareResult = 'shared' | 'downloaded' | 'error'

export async function shareStory(player: Player): Promise<ShareResult> {
  try {
    // Fonts sicher geladen, bevor gezeichnet wird
    if (document.fonts?.ready) await document.fonts.ready
    const canvas = renderStoryCanvas(player)
    const blob = await canvasToBlob(canvas)
    const file = new File([blob], `sva-${player.name.replace(/\s+/g, '-').toLowerCase()}.png`, { type: 'image/png' })

    // Web-Share mit Datei-Support?
    const navAny = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    if (navAny.share && navAny.canShare && navAny.canShare({ files: [file] })) {
      await navAny.share({
        files: [file],
        title: `${player.name} · ${CLUB.shortName}`,
        text: `${player.name} #${player.number} — ${CLUB.name}`,
      })
      return 'shared'
    }

    // Fallback: Download
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    return 'downloaded'
  } catch (err) {
    // Abbruch durch Nutzer ist kein Fehler
    if (err instanceof DOMException && err.name === 'AbortError') return 'shared'
    console.error('[shareStory]', err)
    return 'error'
  }
}
