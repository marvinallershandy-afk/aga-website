// ─────────────────────────────────────────────────────────────
// v14-D „Karten 2.0" — EIN Canvas-Renderer für die Sammelkarte.
// Genutzt von der 3D-Textur (three/playerCardTexture.ts) UND vom
// Story-Export (storyShare.ts). Bewusst three-frei.
//
// Design (gespiegelt in cards.css für die DOM-HoloCard):
//  · Karten-Art: rot-schwarzer, gebürsteter Metall-Foil mit Wappen-
//    Prägung, große Rückennummer als Wasserzeichen
//  · Freisteller: der Spieler ragt mit dem Kopf über die obere Kante
//  · oben links Rückennummer in Gold + Position, oben rechts Wappen
//  · unten Vorname klein, NACHNAME groß (Anton)
//  · Badges: Kapitän „C", „NEU" für Neuzugänge
//  · Stufen: Kader (Rot), Neuzugang (Silber), Kapitän (Gold),
//    Spieler des Monats (Holo)
// Keine Stats, kein Rating (SHOW_RATING=false), keine Platzhalter.
// ─────────────────────────────────────────────────────────────

import type { Player, Staff } from '../data/players'
import { ROLE_LABEL, SHOW_RATING } from '../data/players'

export type CardTier = 'kader' | 'neu' | 'kapitaen' | 'potm'

/** Höhe des Kartenkörpers relativ zur Breite (3 : 4.2). */
export const CARD_RATIO = 1.4
/** Freiraum über dem Kartenkörper für den herausragenden Kopf (× Breite). */
export const POP_RATIO = 0.085

export function tierOf(p: Player): CardTier {
  if (p.isPlayerOfMonth) return 'potm'
  if (p.isCaptain) return 'kapitaen'
  if (p.isNewSigning) return 'neu'
  return 'kader'
}

const TIER_FRAME: Record<CardTier, [string, string]> = {
  kader: ['#ff5560', '#8e0f17'],
  neu: ['#f2f4f7', '#868d96'],
  kapitaen: ['#ffe39a', '#b8912f'],
  potm: ['#fff1c2', '#c79a35'],
}

export const FONT_DISPLAY = 'Anton, "Archivo Variable", system-ui, sans-serif'
export const FONT_BODY = '"Archivo Variable", Archivo, system-ui, sans-serif'

// ── Asset-Laden (gecacht) ───────────────────────────────────
const imgCache = new Map<string, Promise<HTMLImageElement | null>>()
export function loadImage(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  let p = imgCache.get(url)
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })
    imgCache.set(url, p)
  }
  return p
}

let fontsReady: Promise<void> | null = null
export function ensureCardFonts(): Promise<void> {
  if (!fontsReady) {
    fontsReady = (async () => {
      try {
        await Promise.all([
          document.fonts.load('40px Anton'),
          document.fonts.load('700 40px "Archivo Variable"'),
          document.fonts.load('800 40px "Archivo Variable"'),
        ])
      } catch {
        /* Systemschrift genügt als Fallback */
      }
    })()
  }
  return fontsReady
}

export interface CardAssets {
  figure: HTMLImageElement | null
  crest: HTMLImageElement | null
  wappen: HTMLImageElement | null
}

export async function loadCardAssets(figureUrl: string | null | undefined): Promise<CardAssets> {
  const [figure, crest, wappen] = await Promise.all([
    loadImage(figureUrl),
    loadImage('/brand/aga-logo.png'),
    loadImage('/brand/wappen.png'),
    ensureCardFonts(),
  ])
  return { figure, crest, wappen }
}

// ── Helfer ──────────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  if ('letterSpacing' in c) c.letterSpacing = `${px}px`
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, maxW: number, basePx: number, weightFamily: (px: number) => string): number {
  let px = basePx
  for (; px > 6; px -= Math.max(1, basePx * 0.02)) {
    ctx.font = weightFamily(px)
    if (ctx.measureText(text).width <= maxW) break
  }
  return px
}

/** Einfarbige Silhouette eines Bildes (gecacht pro Farbe/Größe). */
const silCache = new Map<string, HTMLCanvasElement>()
function silhouette(img: HTMLImageElement, w: number, h: number, color: string): HTMLCanvasElement {
  const key = `${img.src}|${w}|${h}|${color}`
  let c = silCache.get(key)
  if (c) return c
  c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  const x = c.getContext('2d')!
  x.drawImage(img, 0, 0, c.width, c.height)
  x.globalCompositeOperation = 'source-in'
  x.fillStyle = color
  x.fillRect(0, 0, c.width, c.height)
  silCache.set(key, c)
  return c
}

/** Wappen-Prägung: helle Kante oben links, dunkle unten rechts, Fläche
 *  kaum sichtbar — liest sich wie ins Metall gepresst. */
function drawEmboss(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, w: number) {
  const h = w * (img.naturalHeight / img.naturalWidth)
  const d = Math.max(1, w * 0.008)
  const layer = document.createElement('canvas')
  layer.width = Math.round(w + d * 4)
  layer.height = Math.round(h + d * 4)
  const l = layer.getContext('2d')!
  const ox = d * 2
  const oy = d * 2
  const dark = silhouette(img, w, h, '#000')
  const light = silhouette(img, w, h, '#fff')
  // dunkle Kante unten rechts
  l.globalAlpha = 0.55
  l.drawImage(dark, ox + d, oy + d)
  l.globalAlpha = 1
  l.globalCompositeOperation = 'destination-out'
  l.drawImage(dark, ox, oy)
  // helle Kante oben links
  l.globalCompositeOperation = 'source-over'
  const lightLayer = document.createElement('canvas')
  lightLayer.width = layer.width
  lightLayer.height = layer.height
  const ll = lightLayer.getContext('2d')!
  ll.globalAlpha = 0.22
  ll.drawImage(light, ox - d, oy - d)
  ll.globalAlpha = 1
  ll.globalCompositeOperation = 'destination-out'
  ll.drawImage(light, ox, oy)
  l.drawImage(lightLayer, 0, 0)
  // Hauch Fläche
  l.globalAlpha = 0.05
  l.drawImage(light, ox, oy)
  ctx.drawImage(layer, cx - w / 2 - ox, cy - h / 2 - oy)
}

/** Kartengrund: rot-schwarzer gebürsteter Foil. */
function drawFoil(ctx: CanvasRenderingContext2D, x: number, y: number, W: number, H: number, tier: CardTier | 'stab') {
  const u = W / 100
  // Grundfläche
  const base = ctx.createRadialGradient(x + W * 0.5, y + H * 0.2, u * 4, x + W * 0.5, y + H * 0.4, H * 0.95)
  if (tier === 'stab') {
    base.addColorStop(0, '#3a2a2c'); base.addColorStop(0.5, '#1c1617'); base.addColorStop(1, '#0b090a')
  } else {
    base.addColorStop(0, '#5a1219'); base.addColorStop(0.5, '#230b0e'); base.addColorStop(1, '#0b0607')
  }
  ctx.fillStyle = base
  ctx.fillRect(x, y, W, H)
  // Foil-Band diagonal (Rot), darunter ein Schwarz-Band
  const band = ctx.createLinearGradient(x, y, x + W, y + H)
  const red = tier === 'stab' ? '255,255,255' : '233,29,41'
  const a = tier === 'stab' ? 0.06 : 0.42
  band.addColorStop(0, `rgba(${red},0)`)
  band.addColorStop(0.3, `rgba(${red},0)`)
  band.addColorStop(0.42, `rgba(${red},${a * 0.6})`)
  band.addColorStop(0.48, `rgba(255,140,140,${a * 0.55})`)
  band.addColorStop(0.53, `rgba(${red},${a})`)
  band.addColorStop(0.64, `rgba(${red},0)`)
  band.addColorStop(0.72, 'rgba(0,0,0,0.38)')
  band.addColorStop(0.86, 'rgba(0,0,0,0.1)')
  band.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = band
  ctx.fillRect(x, y, W, H)
  // Bürstung: feine horizontale Striche, deterministisch gestreut
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const step = Math.max(1, u * 0.45)
  for (let yy = y; yy < y + H; yy += step) {
    const r = rnd()
    ctx.fillStyle = r > 0.5 ? `rgba(255,255,255,${0.012 + (r - 0.5) * 0.06})` : `rgba(0,0,0,${0.03 + r * 0.08})`
    ctx.fillRect(x, yy, W, Math.max(0.6, step * 0.5))
  }
  // Bühnenlicht von oben
  const spot = ctx.createRadialGradient(x + W * 0.5, y + H * 0.24, u * 2, x + W * 0.5, y + H * 0.3, W * 0.62)
  spot.addColorStop(0, 'rgba(255,226,200,0.2)')
  spot.addColorStop(1, 'rgba(255,226,200,0)')
  ctx.fillStyle = spot
  ctx.fillRect(x, y, W, H)
}

function frameGradient(ctx: CanvasRenderingContext2D, x: number, y: number, W: number, H: number, tier: CardTier | 'stab') {
  const [c0, c1] = tier === 'stab' ? ['#d9d4d4', '#5d5657'] : TIER_FRAME[tier]
  const g = ctx.createLinearGradient(x, y, x + W, y + H)
  g.addColorStop(0, c0)
  g.addColorStop(0.5, c1)
  g.addColorStop(0.75, c0)
  g.addColorStop(1, c1)
  return g
}

/** Freisteller mit weichem Auslauf nach unten und Kontaktschatten.
 *  Der Kopf ragt um ~4.5 % der Breite über die Oberkante des Körpers. */
function drawFigure(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, W: number, H: number) {
  const u = W / 100
  const P = POP_RATIO * W
  const fw = W * 0.98
  const fh = fw * (img.naturalHeight / img.naturalWidth)
  // Freisteller-Konvention (macOS-Vision-Stapel): Scheitel bei ~18.5 % der Bildhöhe
  const headTop = 0.185 * fh
  const top = y - u * 4.5 - headTop
  const off = document.createElement('canvas')
  off.width = Math.round(W)
  off.height = Math.round(H + P)
  const o = off.getContext('2d')!
  // Seiten/unten an die Karte gebunden, oben frei (Pop-out)
  roundRect(o, 0, 0, W, H + P, u * 5)
  o.clip()
  o.drawImage(img, (W - fw) / 2, top - (y - P), fw, fh)
  // Auslauf in die Namensplatte
  o.globalCompositeOperation = 'destination-in'
  const m = o.createLinearGradient(0, P + H * 0.66, 0, P + H * 0.84)
  m.addColorStop(0, 'rgba(0,0,0,1)')
  m.addColorStop(1, 'rgba(0,0,0,0)')
  o.fillStyle = m
  o.fillRect(0, 0, W, H + P)
  // Kontaktschatten + roter Rim
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = u * 3.2
  ctx.shadowOffsetY = u * 1.2
  ctx.drawImage(off, x, y - P)
  ctx.restore()
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.shadowColor = 'rgba(233,29,41,0.55)'
  ctx.shadowBlur = u * 5
  ctx.drawImage(off, x, y - P)
  ctx.restore()
  ctx.drawImage(off, x, y - P)
}

function drawBadge(ctx: CanvasRenderingContext2D, kind: 'C' | 'NEU', cx: number, cy: number, u: number) {
  ctx.save()
  if (kind === 'C') {
    const r = u * 4.4
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
    g.addColorStop(0, '#ffe9a3'); g.addColorStop(1, '#b8912f')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#1a1206'
    ctx.font = `${u * 5.6}px ${FONT_DISPLAY}`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('C', cx, cy + u * 0.3)
  } else {
    const w = u * 10.5, h = u * 5
    const g = ctx.createLinearGradient(cx - w / 2, cy, cx + w / 2, cy)
    g.addColorStop(0, '#9aa1aa'); g.addColorStop(0.5, '#f4f6f8'); g.addColorStop(1, '#9aa1aa')
    ctx.fillStyle = g
    roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fill()
    ctx.fillStyle = '#16181b'
    ctx.font = `800 ${u * 2.9}px ${FONT_BODY}`
    setSpacing(ctx, u * 0.35)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('NEU', cx + u * 0.15, cy + u * 0.2)
  }
  ctx.restore()
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/)
  return { first: parts.slice(0, -1).join(' '), last: parts.slice(-1)[0] ?? '' }
}

function drawNamePlate(ctx: CanvasRenderingContext2D, x: number, y: number, W: number, H: number, first: string, last: string, tier: CardTier | 'stab', footer: string) {
  const u = W / 100
  const plate = ctx.createLinearGradient(0, y + H * 0.6, 0, y + H * 0.82)
  plate.addColorStop(0, 'rgba(8,5,6,0)')
  plate.addColorStop(1, 'rgba(8,5,6,0.94)')
  ctx.fillStyle = plate
  ctx.fillRect(x, y + H * 0.6, W, H * 0.4)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  if (first) {
    ctx.save()
    ctx.font = `700 ${u * 4.4}px ${FONT_BODY}`
    setSpacing(ctx, u * 0.9)
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    ctx.fillText(first.toUpperCase(), x + W / 2 + u * 0.45, y + H * 0.8)
    ctx.restore()
  }
  const lastU = last.toUpperCase()
  const px = fitFont(ctx, lastU, W * 0.86, u * 15, (p) => `${p}px ${FONT_DISPLAY}`)
  ctx.font = `${px}px ${FONT_DISPLAY}`
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = u * 1.5
  ctx.fillText(lastU, x + W / 2, y + H * 0.905)
  ctx.shadowBlur = 0
  // Trennlinie in Stufenfarbe
  const ly = y + H * 0.932
  const lg = ctx.createLinearGradient(x + W * 0.2, 0, x + W * 0.8, 0)
  const [c0] = tier === 'stab' ? ['#E91D29'] : TIER_FRAME[tier]
  lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.5, c0); lg.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = lg
  ctx.fillRect(x + W * 0.2, ly, W * 0.6, Math.max(1, u * 0.45))
  ctx.save()
  ctx.font = `700 ${u * 2.6}px ${FONT_BODY}`
  setSpacing(ctx, u * 0.75)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fillText(footer, x + W / 2 + u * 0.37, y + H * 0.968)
  ctx.restore()
}

function drawEdge(ctx: CanvasRenderingContext2D, x: number, y: number, W: number, H: number, tier: CardTier | 'stab') {
  const u = W / 100
  // Außenkante (Metall)
  roundRect(ctx, x + u * 0.5, y + u * 0.5, W - u, H - u, u * 4.6)
  ctx.strokeStyle = frameGradient(ctx, x, y, W, H, tier)
  ctx.lineWidth = u * 1.1
  ctx.stroke()
  // Bevel-Licht oben links
  roundRect(ctx, x + u * 1.3, y + u * 1.3, W - u * 2.6, H - u * 2.6, u * 4)
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = u * 0.4
  ctx.stroke()
}

export interface DrawOpts {
  /** Story/Modal: Stufen-Glanz kräftiger. */
  hero?: boolean
}

/**
 * Zeichnet die Spielerkarte. (x, y) = linke obere Ecke des KARTENKÖRPERS,
 * Breite W, Körperhöhe W·CARD_RATIO. Der Kopf des Freistellers ragt bis zu
 * POP_RATIO·W über y hinaus — der Aufrufer muss diesen Platz freihalten.
 */
export function drawPlayerCard(ctx: CanvasRenderingContext2D, x: number, y: number, W: number, player: Player, assets: CardAssets, opts: DrawOpts = {}) {
  const H = W * CARD_RATIO
  const u = W / 100
  const tier = tierOf(player)
  const { first, last } = splitName(player.name)

  ctx.save()
  roundRect(ctx, x, y, W, H, u * 5)
  ctx.save()
  ctx.clip()
  drawFoil(ctx, x, y, W, H, tier)
  if (assets.wappen) drawEmboss(ctx, assets.wappen, x + W * 0.5, y + H * 0.42, W * 0.74)
  // Rückennummer als Wasserzeichen hinter dem Spieler
  if (player.number !== null && assets.figure) {
    ctx.save()
    ctx.font = `${u * 66}px ${FONT_DISPLAY}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(232,193,90,0.07)'
    ctx.strokeStyle = 'rgba(232,193,90,0.3)'
    ctx.lineWidth = u * 0.45
    ctx.fillText(String(player.number), x + W * 0.56, y + H * 0.38)
    ctx.strokeText(String(player.number), x + W * 0.56, y + H * 0.38)
    ctx.restore()
  }
  // Holo-Spezial (Spieler des Monats)
  if (tier === 'potm') {
    const holo = ctx.createLinearGradient(x, y, x + W, y + H)
    holo.addColorStop(0, 'rgba(255,80,200,0.16)')
    holo.addColorStop(0.3, 'rgba(80,220,255,0.16)')
    holo.addColorStop(0.6, 'rgba(160,255,120,0.12)')
    holo.addColorStop(1, 'rgba(255,215,90,0.18)')
    ctx.fillStyle = holo
    ctx.fillRect(x, y, W, H)
  }
  // Innere Rahmenlinie in Stufenfarbe (liegt hinter dem Kopf)
  roundRect(ctx, x + u * 3.4, y + u * 3.4, W - u * 6.8, H - u * 6.8, u * 3.2)
  ctx.strokeStyle = frameGradient(ctx, x, y, W, H, tier)
  ctx.globalAlpha = 0.75
  ctx.lineWidth = u * 0.55
  ctx.stroke()
  ctx.globalAlpha = 1
  if (!assets.figure) {
    // Ohne Foto: Wappen + große Nummer (edler Platzhalter)
    if (assets.crest) {
      const cw = W * 0.5
      const ch = cw * (assets.crest.naturalHeight / assets.crest.naturalWidth)
      ctx.globalAlpha = 0.5
      ctx.drawImage(assets.crest, x + W / 2 - cw / 2, y + H * 0.36 - ch / 2, cw, ch)
      ctx.globalAlpha = 1
    }
    if (player.number !== null) {
      ctx.font = `${u * 34}px ${FONT_DISPLAY}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(232,193,90,0.85)'
      ctx.fillText(String(player.number), x + W / 2, y + H * 0.56)
    }
  }
  drawNamePlate(ctx, x, y, W, H, first, last, tier, 'SV AGATHENBURG-DOLLERN')
  ctx.restore() // clip

  if (assets.figure) drawFigure(ctx, assets.figure, x, y, W, H)

  // Kopfzeile links: Nummer (Gold) + Position. Rating nur mit echten Werten.
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const colX = x + u * 15
  const big = SHOW_RATING ? String(player.rating) : player.number !== null ? String(player.number) : ''
  let posY = y + u * 13
  if (big) {
    const g = ctx.createLinearGradient(0, y + u * 4, 0, y + u * 22)
    g.addColorStop(0, '#fff0b8'); g.addColorStop(0.55, '#E8C15A'); g.addColorStop(1, '#b8912f')
    ctx.font = `${u * 17.5}px ${FONT_DISPLAY}`
    ctx.fillStyle = g
    ctx.shadowColor = 'rgba(0,0,0,0.65)'
    ctx.shadowBlur = u * 1.6
    ctx.shadowOffsetY = u * 0.4
    ctx.fillText(big, colX, y + u * 22.5)
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
    posY = y + u * 29.5
  }
  ctx.font = `800 ${u * 5.4}px ${FONT_BODY}`
  setSpacing(ctx, u * 0.6)
  ctx.fillStyle = 'rgba(255,255,255,0.94)'
  ctx.shadowColor = 'rgba(0,0,0,0.7)'
  ctx.shadowBlur = u * 1.2
  ctx.fillText(player.position, colX + u * 0.3, posY)
  ctx.restore()

  // Wappen oben rechts + Badges darunter
  if (assets.crest) {
    const cw = u * 15
    const ch = cw * (assets.crest.naturalHeight / assets.crest.naturalWidth)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur = u * 1.4
    ctx.drawImage(assets.crest, x + W - cw - u * 7.5, y + u * 6.5, cw, ch)
    ctx.restore()
  }
  let by = y + u * 30
  if (player.isCaptain) { drawBadge(ctx, 'C', x + W - u * 15, by, u); by += u * 11 }
  if (player.isNewSigning) drawBadge(ctx, 'NEU', x + W - u * 15, by, u)

  if (tier === 'potm') {
    ctx.save()
    const bw = W * 0.62, bh = u * 6.2, bx = x + W / 2 - bw / 2, byy = y + H * 0.62
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0)
    g.addColorStop(0, '#b8912f'); g.addColorStop(0.5, '#ffe9a3'); g.addColorStop(1, '#b8912f')
    ctx.fillStyle = g
    roundRect(ctx, bx, byy, bw, bh, u * 1.2); ctx.fill()
    ctx.fillStyle = '#1a1408'
    ctx.font = `800 ${u * 3.1}px ${FONT_BODY}`
    setSpacing(ctx, u * 0.5)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('SPIELER DES MONATS', x + W / 2, byy + bh / 2 + u * 0.2)
    ctx.restore()
  }

  drawEdge(ctx, x, y, W, H, tier)
  if (opts.hero) {
    // dezenter Glanz-Streifen
    ctx.save()
    roundRect(ctx, x, y, W, H, u * 5)
    ctx.clip()
    const gl = ctx.createLinearGradient(x, y, x + W, y + H * 0.7)
    gl.addColorStop(0.32, 'rgba(255,255,255,0)')
    gl.addColorStop(0.4, 'rgba(255,255,255,0.1)')
    gl.addColorStop(0.46, 'rgba(255,255,255,0)')
    ctx.fillStyle = gl
    ctx.fillRect(x, y, W, H)
    ctx.restore()
  }
  ctx.restore()
}

/** Trainerstab-Karte im selben System (Rolle statt Nummer/Position). */
export function drawStaffCard(ctx: CanvasRenderingContext2D, x: number, y: number, W: number, member: Staff, assets: CardAssets) {
  const H = W * CARD_RATIO
  const u = W / 100
  const { first, last } = splitName(member.name)
  ctx.save()
  roundRect(ctx, x, y, W, H, u * 5)
  ctx.save()
  ctx.clip()
  drawFoil(ctx, x, y, W, H, 'stab')
  if (assets.wappen) drawEmboss(ctx, assets.wappen, x + W * 0.5, y + H * 0.42, W * 0.74)
  ctx.fillStyle = '#E91D29'
  ctx.fillRect(x, y, W, u * 2.2)
  if (!assets.figure && assets.crest) {
    const cw = W * 0.48
    const ch = cw * (assets.crest.naturalHeight / assets.crest.naturalWidth)
    ctx.globalAlpha = 0.55
    ctx.drawImage(assets.crest, x + W / 2 - cw / 2, y + H * 0.38 - ch / 2, cw, ch)
    ctx.globalAlpha = 1
  }
  drawNamePlate(ctx, x, y, W, H, first, last, 'stab', member.since !== null ? `IM VEREIN SEIT ${member.since}` : 'SV AGATHENBURG-DOLLERN')
  ctx.restore()
  if (assets.figure) drawFigure(ctx, assets.figure, x, y, W, H)
  // Rolle oben links
  ctx.save()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `800 ${u * 5}px ${FONT_BODY}`
  setSpacing(ctx, u * 0.5)
  ctx.fillStyle = '#ff3b47'
  ctx.shadowColor = 'rgba(0,0,0,0.75)'
  ctx.shadowBlur = u * 1.2
  const role = ROLE_LABEL[member.role].toUpperCase()
  const lines = role.split('-')
  lines.forEach((ln, i) => ctx.fillText(i < lines.length - 1 ? ln + '-' : ln, x + u * 8, y + u * (13 + i * 6.4)))
  ctx.restore()
  if (assets.crest) {
    const cw = u * 13
    const ch = cw * (assets.crest.naturalHeight / assets.crest.naturalWidth)
    ctx.drawImage(assets.crest, x + W - cw - u * 7.5, y + u * 6.5, cw, ch)
  }
  drawEdge(ctx, x, y, W, H, 'stab')
  ctx.restore()
}
