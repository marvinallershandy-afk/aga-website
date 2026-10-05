// ─────────────────────────────────────────────────────────────
// v15-L: Story-Grafik nach Abpfiff (1080×1920, Instagram-Story):
// Endstand + Torschützen + „Spieler des Spiels" als Sammelkarte.
// Nutzt denselben Karten-Renderer wie der Story-Share der Website
// (src/ui/cardArt.ts) und dieselbe Bildsprache (src/ui/storyShare.ts):
// Schwarz, rotes Flutlicht, CI-Streifen, Anton/Archivo.
// ─────────────────────────────────────────────────────────────
import { CARD_RATIO, POP_RATIO, FONT_BODY, FONT_DISPLAY, drawPlayerCard, ensureCardFonts, loadCardAssets, loadImage } from '../../ui/cardArt'
import type { Player } from '../../data/players'
import { CONTACT } from '../../data/content'
import type { RosterRow, SpielRow } from './db'
import { positionCode } from './pflege'

const W = 1080
const H = 1920

export interface StoryDaten {
  spiel: Pick<SpielRow, 'gegner' | 'heim' | 'anstoss' | 'wettbewerb' | 'spieltag_nr'>
  toreSva: number
  toreGegner: number
  /** „Warkehr 12'" … in Reihenfolge */
  torschuetzen: string[]
  motm: RosterRow | null
  /** v16-S: „Live-Ticker präsentiert von“ (Admin → Partner), optional. */
  partner?: { name: string; logoUrl?: string } | null
}

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  if ('letterSpacing' in c) c.letterSpacing = `${px}px`
}

/** Fremd-Origin-Bilder (Supabase-Storage) als Blob holen → Canvas bleibt exportierbar. */
async function sameOrigin(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  try {
    const u = new URL(url, window.location.href)
    if (u.origin === window.location.origin) return u.href
    const r = await fetch(u.href, { mode: 'cors', credentials: 'omit' })
    if (!r.ok) return null
    return URL.createObjectURL(await r.blob())
  } catch {
    return null
  }
}

function alsPlayer(r: RosterRow): Player {
  return {
    id: r.slug,
    name: r.name,
    number: r.nummer,
    position: positionCode(r.position),
    photoUrl: r.foto_url,
    cutoutUrl: r.freisteller_url,
    stats: { games: 0, goals: 0, assists: 0 },
    rating: 70,
    since: r.im_verein_seit,
    isCaptain: r.kapitaen || undefined,
  }
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, font: (px: number) => string): number {
  let p = px
  ctx.font = font(p)
  while (ctx.measureText(text).width > maxW && p > 20) {
    p -= 2
    ctx.font = font(p)
  }
  return p
}

export async function renderErgebnisStory(d: StoryDaten): Promise<HTMLCanvasElement> {
  await ensureCardFonts()
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Hintergrund wie storyShare.ts
  ctx.fillStyle = '#070506'
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, 480, 60, W / 2, 700, 1150)
  glow.addColorStop(0, 'rgba(233,29,41,0.55)')
  glow.addColorStop(0.45, 'rgba(120,12,20,0.35)')
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
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
  for (let y = 0; y < H; y += 3) {
    ctx.fillStyle = (y / 3) % 2 ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.05)'
    ctx.fillRect(0, y, W, 1)
  }

  // Kopf: Wappen + ENDSTAND
  const wappen = await loadImage('/brand/wappen.png')
  if (wappen) {
    const ws = 96
    ctx.drawImage(wappen, W / 2 - ws / 2, 40, ws, ws * (wappen.height / wappen.width))
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `800 30px ${FONT_BODY}`
  setSpacing(ctx, 12)
  ctx.fillStyle = '#E8C15A'
  ctx.fillText('ENDSTAND', W / 2 + 6, 190)
  setSpacing(ctx, 0)
  const unter = [d.spiel.wettbewerb, d.spiel.spieltag_nr ? `${d.spiel.spieltag_nr}. Spieltag` : null].filter(Boolean).join(' · ')
  if (unter) {
    ctx.font = `700 26px ${FONT_BODY}`
    setSpacing(ctx, 4)
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fillText(unter.toUpperCase(), W / 2 + 2, 234)
    setSpacing(ctx, 0)
  }

  // Paarung + Ergebnis (Heim links)
  const heim = d.spiel.heim ? 'SVA' : d.spiel.gegner
  const gast = d.spiel.heim ? d.spiel.gegner : 'SVA'
  const th = d.spiel.heim ? d.toreSva : d.toreGegner
  const tg = d.spiel.heim ? d.toreGegner : d.toreSva
  const yScore = 470
  ctx.font = `230px ${FONT_DISPLAY}`
  const sH = String(th)
  const sG = String(tg)
  const wH = ctx.measureText(sH).width
  const wDp = ctx.measureText(':').width
  const gap = 26
  const total = wH + gap + wDp + gap + ctx.measureText(sG).width
  let x = W / 2 - total / 2
  ctx.textAlign = 'left'
  ctx.fillStyle = '#fff'
  ctx.fillText(sH, x, yScore)
  x += wH + gap
  ctx.fillStyle = '#E91D29'
  ctx.fillText(':', x, yScore - 14)
  x += wDp + gap
  ctx.fillStyle = '#fff'
  ctx.fillText(sG, x, yScore)

  // Teamnamen unter dem Ergebnis
  const nameZeile = (t: string, cx: number, sva: boolean) => {
    ctx.textAlign = 'center'
    const label = sva ? 'SV AGATHENBURG-DOLLERN' : t.toUpperCase()
    fitText(ctx, label, 440, 36, (p) => `${p}px ${FONT_DISPLAY}`)
    ctx.fillStyle = sva ? '#fff' : 'rgba(255,255,255,0.78)'
    ctx.fillText(label, cx, yScore + 82)
  }
  nameZeile(heim, W / 4 + 20, d.spiel.heim)
  nameZeile(gast, (3 * W) / 4 - 20, !d.spiel.heim)

  // Torschützen
  let y = yScore + 190
  if (d.torschuetzen.length) {
    ctx.textAlign = 'center'
    ctx.font = `800 24px ${FONT_BODY}`
    setSpacing(ctx, 8)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillText('TORE SVA', W / 2 + 4, y)
    setSpacing(ctx, 0)
    const zeile = d.torschuetzen.join('  ·  ')
    fitText(ctx, zeile, W - 140, 36, (p) => `700 ${p}px ${FONT_BODY}`)
    ctx.fillStyle = '#fff'
    ctx.fillText(zeile, W / 2, y + 50)
    y += 90
  }

  // Spieler des Spiels
  if (d.motm) {
    // v16-S: mit Partner etwas kleinere Karte → Platz für „präsentiert von“
    const cw = d.partner ? 450 : 560
    const ch = cw * CARD_RATIO
    const cx = (W - cw) / 2
    const cy = Math.max(y + 70, 900) + POP_RATIO * cw
    ctx.textAlign = 'center'
    ctx.font = `800 30px ${FONT_BODY}`
    setSpacing(ctx, 10)
    ctx.fillStyle = '#E8C15A'
    ctx.fillText('SPIELER DES SPIELS', W / 2 + 5, cy - POP_RATIO * cw - 26)
    setSpacing(ctx, 0)
    const figur = await sameOrigin(d.motm.freisteller_url)
    const assets = await loadCardAssets(figur)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.7)'
    ctx.shadowBlur = 70
    ctx.shadowOffsetY = 36
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.roundRect(cx + 10, cy + 10, cw - 20, ch - 20, 30)
    ctx.fill()
    ctx.restore()
    drawPlayerCard(ctx, cx, cy, cw, alsPlayer(d.motm), assets, { hero: true })
  }

  // v16-S: „Live-Ticker präsentiert von“ — Logo auf weißer Plakette über dem Fuß
  if (d.partner) {
    const yLabel = H - 262
    ctx.textAlign = 'center'
    ctx.font = `800 22px ${FONT_BODY}`
    setSpacing(ctx, 8)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillText('LIVE-TICKER PRÄSENTIERT VON', W / 2 + 4, yLabel)
    setSpacing(ctx, 0)
    const pw = 360
    const ph = 90
    const px = (W - pw) / 2
    const py = yLabel + 22
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 8
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.roundRect(px, py, pw, ph, 18)
    ctx.fill()
    ctx.restore()
    const logo = await loadImage(await sameOrigin(d.partner.logoUrl))
    if (logo && logo.width > 0 && logo.height > 0) {
      const s = Math.min((pw - 48) / logo.width, (ph - 24) / logo.height)
      const lw = logo.width * s
      const lh = logo.height * s
      ctx.drawImage(logo, W / 2 - lw / 2, py + ph / 2 - lh / 2, lw, lh)
    } else {
      ctx.fillStyle = '#111'
      fitText(ctx, d.partner.name.toUpperCase(), pw - 40, 40, (p) => `${p}px ${FONT_DISPLAY}`)
      ctx.textBaseline = 'middle'
      ctx.fillText(d.partner.name.toUpperCase(), W / 2, py + ph / 2 + 2)
      ctx.textBaseline = 'alphabetic'
    }
  }

  // Fuß
  ctx.textAlign = 'center'
  ctx.font = `700 28px ${FONT_BODY}`
  setSpacing(ctx, 4)
  ctx.fillStyle = 'rgba(255,255,255,0.62)'
  // v15: Handle aus der Pflege statt fest verdrahtet
  const insta = CONTACT.instagram.startsWith('@') ? CONTACT.instagram : `@${CONTACT.instagram}`
  ctx.fillText(`aga-erste.de  ·  ${insta}`, W / 2 + 2, H - 110)
  setSpacing(ctx, 0)
  ctx.fillStyle = '#E91D29'
  ctx.fillRect(W / 2 - 60, H - 80, 120, 4)
  return canvas
}

/** Teilen (Handy: Share-Sheet mit Datei) oder Download. */
export async function teileStory(d: StoryDaten): Promise<'geteilt' | 'geladen'> {
  const canvas = await renderErgebnisStory(d)
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Bild konnte nicht erzeugt werden'))), 'image/png'))
  const name = `sva-endstand-${d.spiel.gegner.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
  const file = new File([blob], name, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (x: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Endstand SVA' })
      return 'geteilt'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'geteilt'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'geladen'
}
