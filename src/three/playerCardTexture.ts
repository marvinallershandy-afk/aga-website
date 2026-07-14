import * as THREE from 'three'
import type { Player, Staff } from '../data/players'
import { ROLE_LABEL, POSITION_LABEL } from '../data/players'

// ─────────────────────────────────────────────────────────────
// v14-E1 „Karten-Wand": Die 3D-Karte bekommt eine Inhalts-Diät.
// Auf dem Platz ist eine Karte ~100–160 Bildpunkte breit — dort
// müssen NUR Rating, Nachname, Foto/Wappen und Nummer tragen.
// Stats leben im Flip-Modal und in der DOM-Galerie. Dazu: gemalte
// Bevel-Kante (Licht oben links, Schatten unten rechts) + Gold-
// Rahmen mit Ecken-Akzenten → die Karte liest als Objekt mit
// Kante, nicht als Sticker.
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

/** Gemalte Kanten: Licht oben/links, Schatten unten/rechts + Gold-Rahmen
 *  mit Ecken-Akzenten. Wird NACH dem Inhalt (außerhalb des Clips) gemalt. */
function paintCardEdge(ctx: CanvasRenderingContext2D, goldAlpha: number) {
  // Bevel: schmale Gradient-Streifen entlang der Kanten
  ctx.save()
  roundRect(ctx, 6, 6, W - 12, H - 12, 34)
  ctx.clip()
  let g = ctx.createLinearGradient(0, 0, 26, 0)
  g.addColorStop(0, 'rgba(255,244,224,0.16)'); g.addColorStop(1, 'rgba(255,244,224,0)')
  ctx.fillStyle = g; ctx.fillRect(6, 6, 26, H - 12)
  g = ctx.createLinearGradient(0, 0, 0, 26)
  g.addColorStop(0, 'rgba(255,244,224,0.13)'); g.addColorStop(1, 'rgba(255,244,224,0)')
  ctx.fillStyle = g; ctx.fillRect(6, 6, W - 12, 26)
  g = ctx.createLinearGradient(W - 26, 0, W, 0)
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.42)')
  ctx.fillStyle = g; ctx.fillRect(W - 32, 6, 26, H - 12)
  g = ctx.createLinearGradient(0, H - 26, 0, H)
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.42)')
  ctx.fillStyle = g; ctx.fillRect(6, H - 32, W - 12, 26)
  ctx.restore()

  // Gold-Rahmen
  roundRect(ctx, 6, 6, W - 12, H - 12, 34)
  ctx.strokeStyle = `rgba(232,193,90,${goldAlpha})`
  ctx.lineWidth = 5
  ctx.stroke()
  roundRect(ctx, 17, 17, W - 34, H - 34, 26)
  ctx.strokeStyle = 'rgba(232,193,90,0.22)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  // Ecken-Akzente: die Rundungs-Bögen kräftiger nachziehen (Metall-Ecke)
  ctx.strokeStyle = `rgba(240,206,110,${Math.min(1, goldAlpha + 0.2)})`
  ctx.lineWidth = 6
  const r = 34
  const arc = (cx: number, cy: number, a0: number, a1: number) => {
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke()
  }
  arc(6 + r + 2.5, 6 + r + 2.5, Math.PI, Math.PI * 1.5)
  arc(W - 6 - r - 2.5, 6 + r + 2.5, Math.PI * 1.5, 0)
  arc(W - 6 - r - 2.5, H - 6 - r - 2.5, 0, Math.PI * 0.5)
  arc(6 + r + 2.5, H - 6 - r - 2.5, Math.PI * 0.5, Math.PI)
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
    roundRect(ctx, 6, 6, W - 12, H - 12, 34)
    ctx.save(); ctx.clip()

    // dunkler Verlauf (TOTM = Gold-Ton)
    const g = ctx.createLinearGradient(0, 0, 0, H)
    if (isTOTM) { g.addColorStop(0, '#5a4718'); g.addColorStop(0.42, '#2b2413'); g.addColorStop(1, '#0e0a05') }
    else { g.addColorStop(0, '#3a1519'); g.addColorStop(0.44, '#201618'); g.addColorStop(1, '#0b0809') }
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
    const rg = ctx.createRadialGradient(W / 2, H * 0.14, 20, W / 2, H * 0.14, W * 0.95)
    rg.addColorStop(0, 'rgba(255,220,180,0.15)'); rg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H)

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'

    // Foto-Fenster (größer als v11) oder edler Platzhalter
    const bw = W * 0.76, bh = H * 0.52
    const bx = W / 2 - bw / 2, by = H * 0.115
    if (photo) {
      const r = Math.max(bw / photo.width, bh / photo.height)
      const dw = photo.width * r, dh = photo.height * r
      ctx.save()
      roundRect(ctx, bx, by, bw, bh, 14); ctx.clip()
      ctx.drawImage(photo, W / 2 - dw / 2, by, dw, dh)
      // CI-Duotone-Hauch (Foto ist graustufen-gebaked) → roter Unterton
      const pg = ctx.createLinearGradient(0, by, 0, by + bh)
      pg.addColorStop(0, 'rgba(233,29,41,0.05)'); pg.addColorStop(1, 'rgba(110,18,24,0.32)')
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = pg; ctx.fillRect(bx, by, bw, bh)
      ctx.globalCompositeOperation = 'source-over'
      ctx.restore()
      // feine Foto-Einfassung
      roundRect(ctx, bx, by, bw, bh, 14)
      ctx.strokeStyle = 'rgba(232,193,90,0.28)'; ctx.lineWidth = 2; ctx.stroke()
    } else {
      // Platzhalter: großes Wappen-Wasserzeichen + große Nummer
      const crest = getCrest()
      if (crest.complete && crest.naturalWidth) {
        const cw = W * 0.5, ch = cw * (crest.naturalHeight / crest.naturalWidth)
        ctx.globalAlpha = 0.3
        ctx.drawImage(crest, W / 2 - cw / 2, by + bh / 2 - ch / 2 - 26, cw, ch)
        ctx.globalAlpha = 1
      }
      ctx.font = `170px Anton, system-ui, sans-serif`
      ctx.fillStyle = 'rgba(232,193,90,0.85)'
      ctx.fillText(String(player.number), W / 2, by + bh * 0.62)
    }

    // dunkler Kontrast-Anker hinter Rating & Wappen (Lesbarkeit auf Foto)
    let cg = ctx.createRadialGradient(76, 96, 8, 76, 96, 170)
    cg.addColorStop(0, 'rgba(8,5,6,0.66)'); cg.addColorStop(1, 'rgba(8,5,6,0)')
    ctx.fillStyle = cg; ctx.fillRect(0, 0, 260, 300)
    cg = ctx.createRadialGradient(W - 72, 88, 8, W - 72, 88, 150)
    cg.addColorStop(0, 'rgba(8,5,6,0.6)'); cg.addColorStop(1, 'rgba(8,5,6,0)')
    ctx.fillStyle = cg; ctx.fillRect(W - 250, 0, 250, 260)

    // Rating + Position (oben links) — GROSS, das trägt aus der Distanz
    ctx.font = `150px Anton, system-ui, sans-serif`
    ctx.fillStyle = isTOTM ? '#ffe9a3' : GOLD
    ctx.fillText(String(player.rating), 82, 104)
    ctx.font = `700 38px Archivo, system-ui, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.fillText(player.position, 82, 172)

    // Wappen oben rechts
    const crest = getCrest()
    if (crest.complete && crest.naturalWidth) {
      const cw = 88, ch = cw * (crest.naturalHeight / crest.naturalWidth)
      ctx.drawImage(crest, W - cw - 26, 26, cw, ch)
    }

    // TOTM-Banner
    if (isTOTM) {
      ctx.fillStyle = GOLD
      roundRect(ctx, W / 2 - 140, H * 0.615, 280, 42, 8); ctx.fill()
      ctx.fillStyle = '#231c08'; ctx.font = `800 23px Archivo, system-ui, sans-serif`
      ctx.fillText('SPIELER DES MONATS', W / 2, H * 0.615 + 22)
    }

    // untere Info-Platte
    const plateY = H * 0.64
    const pg2 = ctx.createLinearGradient(0, plateY, 0, H)
    pg2.addColorStop(0, 'rgba(8,6,6,0)'); pg2.addColorStop(0.4, 'rgba(8,6,6,0.9)')
    ctx.fillStyle = pg2; ctx.fillRect(0, plateY, W, H - plateY)

    const parts = player.name.split(' ')
    const first = parts.slice(0, -1).join(' ')
    const last = parts.slice(-1)[0]
    if (first) {
      ctx.font = `700 34px Archivo, system-ui, sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.62)'
      ctx.fillText(first.toUpperCase(), W / 2, H * 0.755)
    }
    // Nachname = der Star der Karte
    fitText(ctx, last.toUpperCase(), W / 2, H * 0.838, W * 0.85, 92, 'Anton, system-ui, sans-serif', '#ffffff')

    // Gold-Trennlinie
    const ly = H * 0.895
    const lg = ctx.createLinearGradient(W * 0.14, 0, W * 0.86, 0)
    lg.addColorStop(0, 'rgba(232,193,90,0)'); lg.addColorStop(0.5, 'rgba(232,193,90,0.8)'); lg.addColorStop(1, 'rgba(232,193,90,0)')
    ctx.strokeStyle = lg; ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.moveTo(W * 0.14, ly); ctx.lineTo(W * 0.86, ly); ctx.stroke()

    // Fußzeile: Position ausgeschrieben + Rückennummer (statt Mini-Stats —
    // Stats leben im Modal, hier wäre es unlesbarer Pixelbrei)
    ctx.font = `800 30px Archivo, system-ui, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.78)'
    ctx.fillText(`${POSITION_LABEL[player.position].toUpperCase()}  ·  #${player.number}`, W / 2, H * 0.945)

    ctx.restore()

    paintCardEdge(ctx, isTOTM ? 0.9 : 0.62)
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

// v14-E1: Trainerstab-Karte im selben Kanten-/Rahmen-System (Rolle statt
// Rating/Stats) — an der Seitenlinie, klar abgesetzt vom Kader.
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
    g.addColorStop(0, '#241a1b'); g.addColorStop(1, '#0f0b0c')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    // roter Kopfbalken
    ctx.fillStyle = RED; ctx.fillRect(0, 6, W, 16)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    // Foto oder Wappen
    if (photo) {
      const bw = W * 0.76, bh = H * 0.52, bx = W / 2 - bw / 2, by = H * 0.1
      const r = Math.max(bw / photo.width, bh / photo.height)
      ctx.save(); roundRect(ctx, bx, by, bw, bh, 14); ctx.clip()
      ctx.drawImage(photo, W / 2 - photo.width * r / 2, by, photo.width * r, photo.height * r)
      const pg = ctx.createLinearGradient(0, by, 0, by + bh)
      pg.addColorStop(0, 'rgba(233,29,41,0.04)'); pg.addColorStop(1, 'rgba(110,18,24,0.3)')
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = pg; ctx.fillRect(bx, by, bw, bh)
      ctx.globalCompositeOperation = 'source-over'; ctx.restore()
      roundRect(ctx, bx, by, bw, bh, 14)
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 2; ctx.stroke()
    } else {
      const crest = getCrest()
      if (crest.complete && crest.naturalWidth) {
        const cw = W * 0.46, ch = cw * (crest.naturalHeight / crest.naturalWidth)
        ctx.globalAlpha = 0.55; ctx.drawImage(crest, W / 2 - cw / 2, H * 0.16, cw, ch); ctx.globalAlpha = 1
      }
    }
    // Platte
    const plateY = H * 0.62
    const pg2 = ctx.createLinearGradient(0, plateY, 0, H)
    pg2.addColorStop(0, 'rgba(8,6,6,0)'); pg2.addColorStop(0.42, 'rgba(8,6,6,0.92)')
    ctx.fillStyle = pg2; ctx.fillRect(0, plateY, W, H - plateY)
    ctx.font = `800 38px Archivo, system-ui, sans-serif`; ctx.fillStyle = RED
    ctx.fillText(ROLE_LABEL[member.role].toUpperCase(), W / 2, H * 0.745)
    fitText(ctx, member.name.toUpperCase(), W / 2, H * 0.838, W * 0.85, 84, 'Anton, system-ui, sans-serif', '#ffffff')
    ctx.font = `600 28px Archivo, system-ui, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,0.58)'
    ctx.fillText(`im Verein seit ${member.since}`, W / 2, H * 0.94)
    ctx.restore()
    paintCardEdge(ctx, 0.3)
    tex.needsUpdate = true
  }
  draw()
  const crest = getCrest()
  if (!crest.complete) crest.onload = () => draw(undefined)
  if (member.photoUrl) { const img = new Image(); img.onload = () => draw(img); img.src = member.photoUrl }
  return { texture: tex }
}
