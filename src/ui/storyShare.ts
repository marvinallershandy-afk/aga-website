import type { Player } from '../data/players'
import { POSITION_LABEL } from '../data/players'
import { CLUB, CONTACT, NEXT_MATCH } from '../data/content'
import { CARD_RATIO, POP_RATIO, FONT_BODY, FONT_DISPLAY, drawPlayerCard, loadCardAssets } from './cardArt'

// ─────────────────────────────────────────────────────────────
// One-Tap Instagram-Story-Share. v14-D: das Story-Bild (1080×1920)
// zeigt die Karte 2.0 MIT Freisteller (gemeinsamer Renderer cardArt.ts),
// rot-schwarz statt Gold, ohne Stats. Im Fuß „aga-erste.de · @sva_fussball";
// hat das nächste Spiel einen echten Anstoß, steht er darüber.
// Teilen via navigator.share({files}) mit Feature-Detection, sonst Download.
// ─────────────────────────────────────────────────────────────

const W = 1080
const H = 1920
const SITE = 'aga-erste.de'
// v15: Handle aus der Pflege (Admin → Verein & Links), Fallback club.ts
const INSTA = CONTACT.instagram.startsWith('@') ? CONTACT.instagram : `@${CONTACT.instagram}`

/** „Nächstes Spiel: So 16.08. · 15:00 · vs TuS X" — nur mit echtem Anstoß. */
export function nextMatchLine(now = new Date()): string | null {
  const m = NEXT_MATCH
  if (!m.kickoff || m.isPlaceholder) return null
  const d = new Date(m.kickoff)
  if (Number.isNaN(d.getTime()) || d.getTime() < now.getTime()) return null
  const day = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' }).format(d)
  const time = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(d)
  return `Nächstes Spiel: ${day.replace(',', '')} · ${time} · ${m.home ? 'vs' : 'bei'} ${m.opponent}`
}

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  if ('letterSpacing' in c) c.letterSpacing = `${px}px`
}

/** Zeichnet das Story-Bild und liefert den Canvas zurück. */
export async function renderStoryCanvas(player: Player): Promise<HTMLCanvasElement> {
  const assets = await loadCardAssets(player.cutoutUrl ?? null)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Hintergrund: Schwarz mit rotem Flutlicht-Schein von oben
  ctx.fillStyle = '#070506'
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, 520, 60, W / 2, 700, 1100)
  glow.addColorStop(0, 'rgba(233,29,41,0.55)')
  glow.addColorStop(0.45, 'rgba(120,12,20,0.35)')
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  // diagonale CI-Streifen
  ctx.save()
  ctx.globalAlpha = 0.07
  ctx.fillStyle = '#E91D29'
  for (let i = -H; i < W + H; i += 120) {
    ctx.beginPath()
    ctx.moveTo(i, H)
    ctx.lineTo(i + 46, H)
    ctx.lineTo(i + 46 + H * 0.6, 0)
    ctx.lineTo(i + H * 0.6, 0)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
  // Bürstung
  for (let y = 0; y < H; y += 3) {
    ctx.fillStyle = (y / 3) % 2 ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.05)'
    ctx.fillRect(0, y, W, 1)
  }

  // Kopf: SVA-Wortmarke + Vereinsname
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `64px ${FONT_DISPLAY}`
  const svW = ctx.measureText('SV').width
  const aW = ctx.measureText('A').width
  const sx = W / 2 - (svW + aW) / 2
  ctx.fillStyle = '#fff'
  ctx.fillText('SV', sx, 150)
  ctx.fillStyle = '#E91D29'
  ctx.fillText('A', sx + svW, 150)
  ctx.textAlign = 'center'
  ctx.font = `700 24px ${FONT_BODY}`
  setSpacing(ctx, 7)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText(`${CLUB.name.toUpperCase()} · 1. HERREN`, W / 2 + 3.5, 198)
  setSpacing(ctx, 0)

  // Karte (mit Freisteller, Kopf ragt über die Kante)
  const cw = 760
  const ch = cw * CARD_RATIO
  const cx = (W - cw) / 2
  const cy = 300 + POP_RATIO * cw
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.7)'
  ctx.shadowBlur = 80
  ctx.shadowOffsetY = 40
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.roundRect(cx + 10, cy + 10, cw - 20, ch - 20, 36)
  ctx.fill()
  ctx.restore()
  drawPlayerCard(ctx, cx, cy, cw, player, assets, { hero: true })

  // Unter der Karte: Position · Nummer
  let y = cy + ch + 96
  ctx.textAlign = 'center'
  ctx.font = `800 30px ${FONT_BODY}`
  setSpacing(ctx, 8)
  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.fillText(
    POSITION_LABEL[player.position].toUpperCase() + (player.number === null ? '' : `  ·  #${player.number}`),
    W / 2 + 4,
    y,
  )
  setSpacing(ctx, 0)

  // Nächstes Spiel (nur mit echtem Anstoß)
  const nm = nextMatchLine()
  if (nm) {
    y += 70
    ctx.font = `700 30px ${FONT_BODY}`
    const tw = ctx.measureText(nm).width + 64
    ctx.fillStyle = '#E91D29'
    ctx.beginPath()
    ctx.roundRect(W / 2 - tw / 2, y - 44, tw, 64, 32)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillText(nm, W / 2, y)
  }

  // Fuß
  ctx.font = `700 28px ${FONT_BODY}`
  setSpacing(ctx, 4)
  ctx.fillStyle = 'rgba(255,255,255,0.62)'
  ctx.fillText(`${SITE}  ·  ${INSTA}`, W / 2 + 2, H - 110)
  ctx.fillStyle = '#E91D29'
  ctx.fillRect(W / 2 - 60, H - 80, 120, 4)
  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })
}

export type ShareResult = 'shared' | 'downloaded' | 'error'

export async function shareStory(player: Player): Promise<ShareResult> {
  try {
    const canvas = await renderStoryCanvas(player)
    const blob = await canvasToBlob(canvas)
    const file = new File([blob], `sva-${player.name.replace(/\s+/g, '-').toLowerCase()}.png`, { type: 'image/png' })

    // Web-Share mit Datei-Support?
    const navAny = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    if (navAny.share && navAny.canShare && navAny.canShare({ files: [file] })) {
      await navAny.share({
        files: [file],
        title: `${player.name} · ${CLUB.shortName}`,
        text: player.number === null
          ? `${player.name} — ${CLUB.name} · ${SITE}`
          : `${player.name} #${player.number} — ${CLUB.name} · ${SITE}`,
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
