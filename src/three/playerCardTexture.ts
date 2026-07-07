import * as THREE from 'three'
import type { Player, Staff } from '../data/players'
import { ROLE_LABEL } from '../data/players'

// ─────────────────────────────────────────────────────────────
// v11-E1/E2: Edle Spielerkarte als Canvas-Textur (für die 3D-Karten
// auf dem Platz). KEIN Arcade-Holo — ruhige Metall-/Tiefen-Anmutung:
// dunkler Verlauf, feine gebürstete Diagonalen, Gold-Rahmen. Layout
// wie die gute DOM-Karte: Rating (Gold, oben links) + Position, Wappen
// oben rechts, Nummer-Wasserzeichen, Foto (oder edler Platzhalter),
// Name (Vorname klein/Nachname groß), Stats. Foto lädt async nach.
// ─────────────────────────────────────────────────────────────

const W = 512
const H = 716
const RED = '#E91D29'
const GOLD = '#E8C15A'

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function fitText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxW: number, basePx: number, font: string, color: string) {
  let px = basePx
  for (; px > 8; px -= 1) {
    ctx.font = `${px}px ${font}`
    if (ctx.measureText(text).width <= maxW) break
  }
  ctx.fillStyle = color
  ctx.fillText(text, cx, cy)
  return px
}

let crestImg: HTMLImageElement | null = null
function getCrest(): HTMLImageElement {
  if (!crestImg) {
    crestImg = new Image()
    crestImg.src = '/brand/wappen.png'
  }
  return crestImg
}

export interface CardTex {
  texture: THREE.CanvasTexture
}

export function makePlayerCardTexture(player: Player, isTOTM = false): CardTex {
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')!
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8

  const draw = (photo?: HTMLImageElement) => {
    ctx.clearRect(0, 0, W, H)
    // Korpus mit Rundung
    roundRect(ctx, 6, 6, W - 12, H - 12, 34)
    ctx.save(); ctx.clip()

    // dunkler Verlauf (TOTM = Gold-Ton)
    const g = ctx.createLinearGradient(0, 0, 0, H)
    if (isTOTM) { g.addColorStop(0, '#5a4718'); g.addColorStop(0.42, '#2b2413'); g.addColorStop(1, '#120d06') }
    else { g.addColorStop(0, '#3a1519'); g.addColorStop(0.44, '#201618'); g.addColorStop(1, '#0d0a0b') }
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    // gebürstete Diagonalen (dezent, „Metall" statt Holo)
    ctx.globalAlpha = 0.05
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1
    for (let i = -H; i < W; i += 7) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke()
    }
    ctx.globalAlpha = 1

    // radiale Aufhellung oben (Bühnenlicht)
    const rg = ctx.createRadialGradient(W / 2, H * 0.16, 20, W / 2, H * 0.16, W * 0.9)
    rg.addColorStop(0, 'rgba(255,220,180,0.14)'); rg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H)

    // Nummer-Wasserzeichen
    ctx.font = `700 320px Anton, system-ui, sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    ctx.fillText(String(player.number), W * 0.66, H * 0.46)

    // Foto oder Platzhalter
    if (photo) {
      const bw = W * 0.7, bh = H * 0.52
      const bx = W / 2 - bw / 2, by = H * 0.1
      const r = Math.max(bw / photo.width, bh / photo.height)
      const dw = photo.width * r, dh = photo.height * r
      ctx.save()
      roundRect(ctx, bx, by, bw, bh, 10); ctx.clip()
      ctx.drawImage(photo, W / 2 - dw / 2, by, dw, dh)
      // CI-Duotone-Hauch (Foto ist graustufen-gebaked) → roter Unterton
      const pg = ctx.createLinearGradient(0, by, 0, by + bh)
      pg.addColorStop(0, 'rgba(233,29,41,0.05)'); pg.addColorStop(1, 'rgba(110,18,24,0.32)')
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = pg; ctx.fillRect(bx, by, bw, bh)
      ctx.globalCompositeOperation = 'source-over'
      ctx.restore()
    } else {
      const crest = getCrest()
      if (crest.complete && crest.naturalWidth) {
        const cw = W * 0.42, ch = cw * (crest.naturalHeight / crest.naturalWidth)
        ctx.globalAlpha = 0.5
        ctx.drawImage(crest, W / 2 - cw / 2, H * 0.2, cw, ch)
        ctx.globalAlpha = 1
      }
    }

    // Rating + Position (oben links)
    ctx.textAlign = 'center'
    ctx.font = `130px Anton, system-ui, sans-serif`
    ctx.fillStyle = isTOTM ? '#ffe9a3' : GOLD
    ctx.fillText(String(player.rating), 78, 96)
    ctx.font = `700 34px Archivo, system-ui, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fillText(player.position, 78, 150)

    // Wappen oben rechts
    const crest = getCrest()
    if (crest.complete && crest.naturalWidth) {
      const cw = 74, ch = cw * (crest.naturalHeight / crest.naturalWidth)
      ctx.drawImage(crest, W - cw - 30, 30, cw, ch)
    }

    // TOTM-Banner
    if (isTOTM) {
      ctx.fillStyle = GOLD
      roundRect(ctx, W / 2 - 130, H * 0.6, 260, 40, 8); ctx.fill()
      ctx.fillStyle = '#231c08'; ctx.font = `800 22px Archivo, system-ui, sans-serif`
      ctx.fillText('SPIELER DES MONATS', W / 2, H * 0.6 + 27)
    }

    // untere Info-Platte
    const plateY = H * 0.72
    const pg2 = ctx.createLinearGradient(0, plateY, 0, H)
    pg2.addColorStop(0, 'rgba(10,8,8,0)'); pg2.addColorStop(0.35, 'rgba(10,8,8,0.86)')
    ctx.fillStyle = pg2; ctx.fillRect(0, plateY, W, H - plateY)

    const parts = player.name.split(' ')
    const first = parts.slice(0, -1).join(' ')
    const last = parts.slice(-1)[0]
    if (first) {
      ctx.font = `700 30px Archivo, system-ui, sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.fillText(first.toUpperCase(), W / 2, H * 0.79)
    }
    fitText(ctx, last.toUpperCase(), W / 2, H * 0.855, W * 0.82, 62, 'Anton, system-ui, sans-serif', '#ffffff')

    // Gold-Trennlinie
    const ly = H * 0.885
    const lg = ctx.createLinearGradient(W * 0.15, 0, W * 0.85, 0)
    lg.addColorStop(0, 'rgba(232,193,90,0)'); lg.addColorStop(0.5, 'rgba(232,193,90,0.7)'); lg.addColorStop(1, 'rgba(232,193,90,0)')
    ctx.strokeStyle = lg; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(W * 0.15, ly); ctx.lineTo(W * 0.85, ly); ctx.stroke()

    // Stats
    const stats: [number, string][] = [[player.stats.games, 'SPIELE'], [player.stats.goals, 'TORE'], [player.stats.assists, 'ASSISTS']]
    const sx = [W * 0.26, W * 0.5, W * 0.74]
    stats.forEach(([v, label], i) => {
      ctx.font = `44px Anton, system-ui, sans-serif`
      ctx.fillStyle = GOLD
      ctx.fillText(String(v), sx[i], H * 0.94)
      ctx.font = `700 18px Archivo, system-ui, sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.72)'
      ctx.fillText(label, sx[i], H * 0.975)
    })

    ctx.restore()

    // Gold-Rahmen
    roundRect(ctx, 6, 6, W - 12, H - 12, 34)
    ctx.strokeStyle = isTOTM ? 'rgba(232,193,90,0.85)' : 'rgba(232,193,90,0.5)'
    ctx.lineWidth = 3; ctx.stroke()
    roundRect(ctx, 16, 16, W - 32, H - 32, 26)
    ctx.strokeStyle = 'rgba(232,193,90,0.25)'; ctx.lineWidth = 1.5; ctx.stroke()

    tex.needsUpdate = true
  }

  draw()
  // Wappen nachladen → neu zeichnen
  const crest = getCrest()
  if (!crest.complete) crest.onload = () => draw(undefined)
  // Foto async
  if (player.photoUrl) {
    const img = new Image()
    img.onload = () => draw(img)
    img.src = player.photoUrl
  }
  return { texture: tex }
}

// v11-E1: kompakte Trainerstab-Karte (Rolle statt Rating/Stats) — an der
// Seitenlinie/Bank, klar abgesetzt vom Kader.
export function makeStaffCardTexture(member: Staff): CardTex {
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')!
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8

  const draw = (photo?: HTMLImageElement) => {
    ctx.clearRect(0, 0, W, H)
    roundRect(ctx, 6, 6, W - 12, H - 12, 34); ctx.save(); ctx.clip()
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#241a1b'); g.addColorStop(1, '#120d0e')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    // roter Kopfbalken
    ctx.fillStyle = RED; ctx.fillRect(0, 0, W, 14)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    // Foto oder Wappen
    if (photo) {
      const bw = W * 0.72, bh = H * 0.5, bx = W / 2 - bw / 2, by = H * 0.1
      const r = Math.max(bw / photo.width, bh / photo.height)
      ctx.save(); roundRect(ctx, bx, by, bw, bh, 10); ctx.clip()
      ctx.drawImage(photo, W / 2 - photo.width * r / 2, by, photo.width * r, photo.height * r)
      const pg = ctx.createLinearGradient(0, by, 0, by + bh)
      pg.addColorStop(0, 'rgba(233,29,41,0.04)'); pg.addColorStop(1, 'rgba(110,18,24,0.3)')
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = pg; ctx.fillRect(bx, by, bw, bh)
      ctx.globalCompositeOperation = 'source-over'; ctx.restore()
    } else {
      const crest = getCrest()
      if (crest.complete && crest.naturalWidth) {
        const cw = W * 0.44, ch = cw * (crest.naturalHeight / crest.naturalWidth)
        ctx.globalAlpha = 0.62; ctx.drawImage(crest, W / 2 - cw / 2, H * 0.16, cw, ch); ctx.globalAlpha = 1
      }
    }
    // Platte
    const plateY = H * 0.66
    const pg2 = ctx.createLinearGradient(0, plateY, 0, H)
    pg2.addColorStop(0, 'rgba(10,8,8,0)'); pg2.addColorStop(0.4, 'rgba(10,8,8,0.9)')
    ctx.fillStyle = pg2; ctx.fillRect(0, plateY, W, H - plateY)
    ctx.font = `800 32px Archivo, system-ui, sans-serif`; ctx.fillStyle = RED
    ctx.fillText(ROLE_LABEL[member.role].toUpperCase(), W / 2, H * 0.76)
    fitText(ctx, member.name.toUpperCase(), W / 2, H * 0.85, W * 0.82, 66, 'Anton, system-ui, sans-serif', '#ffffff')
    ctx.font = `600 26px Archivo, system-ui, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillText(`im Verein seit ${member.since}`, W / 2, H * 0.925)
    ctx.restore()
    roundRect(ctx, 6, 6, W - 12, H - 12, 34)
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 2; ctx.stroke()
    tex.needsUpdate = true
  }
  draw()
  const crest = getCrest()
  if (!crest.complete) crest.onload = () => draw(undefined)
  if (member.photoUrl) { const img = new Image(); img.onload = () => draw(img); img.src = member.photoUrl }
  return { texture: tex }
}
