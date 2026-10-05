// ─────────────────────────────────────────────────────────────
// v17-G: „Aufstellung als Story“ — 1080×1920-PNG im Design der TV-Aufstellung
// (/live): gleiches Datenmodell (daten.ts), gleiche Geometrie, gleiche
// Brustbild-Regeln. Genutzt vom Admin (Aufstellung) — Content-Maschine light.
// ─────────────────────────────────────────────────────────────
import { ensureCardFonts, FONT_BODY, FONT_DISPLAY } from '../../ui/cardArt'
import { plattenSchrift, proj, type AufstellungGrafik, type GrafikSlot } from './daten'

const W = 1080
const H = 1920
const ROT = '#e91d29'
const BOX = { x: 40, y: 390, w: 1000, h: 1010 }

function spacing(ctx: CanvasRenderingContext2D, px: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  if ('letterSpacing' in c) c.letterSpacing = `${px}px`
}

/** Bild laden; Fremd-Origin (Supabase-Storage) als Blob → Canvas bleibt exportierbar. */
const cache = new Map<string, Promise<HTMLImageElement | null>>()
function bild(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  let p = cache.get(url)
  if (!p) {
    p = (async () => {
      let src = url
      try {
        const u = new URL(url, window.location.href)
        if (u.protocol !== 'data:' && u.origin !== window.location.origin) {
          const r = await fetch(u.href, { mode: 'cors', credentials: 'omit' })
          if (!r.ok) return null
          src = URL.createObjectURL(await r.blob())
        }
      } catch {
        return null
      }
      return new Promise<HTMLImageElement | null>((res) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = () => res(null)
        i.src = src
      })
    })()
    cache.set(url, p)
  }
  return p
}

const bx = (px: number) => BOX.x + (px / 100) * BOX.w
const by = (py: number) => BOX.y + (py / 100) * BOX.h

function zeichneFeld(ctx: CanvasRenderingContext2D) {
  const L = 105, W2 = 34
  const pt = (xm: number, ym: number) => { const [x, y] = proj(xm / W2, ym / L); return [bx(x), by(y)] as const }
  const poly = (pts: (readonly [number, number])[], close = true) => {
    ctx.beginPath()
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    if (close) ctx.closePath()
  }
  const rect = (x0: number, x1: number, y0: number, y1: number) => poly([pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)])
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number, close = false) => {
    const p: (readonly [number, number])[] = []
    for (let i = 0; i <= 48; i++) { const a = a0 + ((a1 - a0) * i) / 48; p.push(pt(cx + Math.cos(a) * r, cy + Math.sin(a) * r)) }
    poly(p, close)
  }
  const g = ctx.createLinearGradient(0, BOX.y, 0, BOX.y + BOX.h)
  g.addColorStop(0, '#101611'); g.addColorStop(1, '#18241a')
  ctx.fillStyle = g
  rect(-W2 - 4, W2 + 4, -5, L + 4); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.022)'
  for (let i = 1; i < 12; i += 2) { rect(-W2, W2, (i * L) / 12, ((i + 1) * L) / 12); ctx.fill() }
  const rg = ctx.createRadialGradient(W / 2, BOX.y + BOX.h * 0.55, 10, W / 2, BOX.y + BOX.h * 0.55, BOX.h * 0.7)
  rg.addColorStop(0, 'rgba(255,255,255,0.07)'); rg.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = rg
  rect(-W2 - 4, W2 + 4, -5, L + 4); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.26)'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'
  const arcA = Math.asin((16.5 - 11) / 9.15)
  rect(-W2, W2, 0, L); ctx.stroke()
  poly([pt(-W2, L / 2), pt(W2, L / 2)], false); ctx.stroke()
  arc(0, L / 2, 9.15, 0, Math.PI * 2, true); ctx.stroke()
  rect(-20.16, 20.16, 0, 16.5); ctx.stroke()
  rect(-9.16, 9.16, 0, 5.5); ctx.stroke()
  arc(0, 11, 9.15, arcA, Math.PI - arcA); ctx.stroke()
  rect(-20.16, 20.16, L - 16.5, L); ctx.stroke()
  rect(-9.16, 9.16, L - 5.5, L); ctx.stroke()
  arc(0, L - 11, 9.15, Math.PI + arcA, Math.PI * 2 - arcA); ctx.stroke()
  ctx.strokeStyle = 'rgba(233,29,41,0.8)'; ctx.lineWidth = 5
  poly([pt(-W2, 0), pt(W2, 0)], false); ctx.stroke()
}

function ballIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save()
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = r * 0.12
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#111'; ctx.beginPath()
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; const px = x + Math.cos(a) * r * 0.42, py = y + Math.sin(a) * r * 0.42; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py) }
  ctx.closePath(); ctx.fill(); ctx.restore()
}

function chip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, bg: string, fg: string, size: number, ball = false) {
  ctx.font = `800 ${size}px ${FONT_BODY}`
  const tw = ctx.measureText(text).width + (ball ? size * 1.2 : 0)
  const w = tw + size * 0.7, h = size * 1.35
  ctx.fillStyle = bg
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, size * 0.25); ctx.fill()
  if (ball) ballIcon(ctx, x - w / 2 + size * 0.35 + size * 0.5, y, size * 0.48)
  ctx.fillStyle = fg; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
  ctx.fillText(text, x - w / 2 + size * 0.35 + (ball ? size * 1.2 : 0), y + size * 0.04)
  return w
}

async function zeichneSpieler(ctx: CanvasRenderingContext2D, s: GrafikSlot, teil: 'bild' | 'text') {
  const D = 132 * s.k
  const cx = bx(s.x), cy = by(s.y)
  const p = s.spieler
  if (teil === 'text') return zeichneText(ctx, s, D, cx, cy)
  // Kreis
  const rg = ctx.createRadialGradient(cx, cy - D * 0.2, D * 0.05, cx, cy, D * 0.6)
  if (s.role === 'TW') { rg.addColorStop(0, '#3b3b3b'); rg.addColorStop(1, '#0a0a0a') } else { rg.addColorStop(0, '#8c1720'); rg.addColorStop(1, '#1e0608') }
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10
  ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, D / 2, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  const img = await bild(p?.bild)
  if (img && p) {
    ctx.save()
    ctx.beginPath()
    if (p.freisteller) {
      // unten Halbkreis, oben Rechteck bis 0,28·D über den Kreis → Kopf ragt heraus
      ctx.moveTo(cx - D / 2, cy - D / 2 - D * 0.28)
      ctx.lineTo(cx + D / 2, cy - D / 2 - D * 0.28)
      ctx.lineTo(cx + D / 2, cy)
      ctx.arc(cx, cy, D / 2, 0, Math.PI)
      ctx.closePath()
      ctx.clip()
      const iw = D * 1.75, ih = iw * (img.naturalHeight / img.naturalWidth)
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2
      ctx.drawImage(img, cx - iw / 2, cy - D / 2 - D * 0.686, iw, ih)
    } else {
      ctx.arc(cx, cy, D / 2, 0, Math.PI * 2); ctx.clip()
      const r = img.naturalWidth / img.naturalHeight
      const w = r > 1 ? D * r : D, h = r > 1 ? D : D / r
      ctx.drawImage(img, cx - w / 2, cy - D / 2 - (h - D) * 0.18, w, h)
    }
    ctx.restore()
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `400 ${D * 0.42}px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(p?.number != null ? String(p.number) : '?', cx, cy)
  }
  // Ring
  ctx.strokeStyle = p?.kapitaen ? '#e8c15a' : 'rgba(255,255,255,0.92)'; ctx.lineWidth = Math.max(3, D * 0.035)
  ctx.beginPath(); ctx.arc(cx, cy, D / 2, 0, Math.PI * 2); ctx.stroke()
  if (p?.kapitaen) {
    const r = D * 0.15, x = cx + D * 0.38, y = cy - D * 0.38
    ctx.fillStyle = '#e8c15a'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#1a1408'; ctx.font = `900 ${r * 1.1}px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('C', x, y + r * 0.05)
  }
  if (s.karte) {
    ctx.save(); ctx.translate(cx - D * 0.42, cy - D * 0.36); ctx.rotate(-0.17)
    ctx.fillStyle = s.karte === 'rot' ? '#e3141f' : '#f5d000'; ctx.fillRect(-D * 0.085, -D * 0.12, D * 0.17, D * 0.24)
    ctx.restore()
  }
}

/** Zweiter Durchgang: Platten + Marken über ALLEN Brustbildern (nichts wird verdeckt). */
function zeichneText(ctx: CanvasRenderingContext2D, s: GrafikSlot, D: number, cx: number, cy: number) {
  const p = s.spieler
  // Marken auf dem unteren Kreisrand
  const marken: { t: string; bg: string; fg: string; ball?: boolean }[] = []
  if (s.tore.length) marken.push({ t: s.tore.join(' '), bg: '#fff', fg: '#111', ball: true })
  if (s.rein) marken.push({ t: `▲ ${s.rein}`, bg: 'rgba(26,138,62,0.96)', fg: '#fff' })
  if (marken.length) {
    const size = Math.max(20, D * 0.16)
    ctx.font = `800 ${size}px ${FONT_BODY}`
    const ws = marken.map((m) => ctx.measureText(m.t).width + (m.ball ? size * 1.2 : 0) + size * 0.7)
    let x = cx - (ws.reduce((a, b) => a + b, 0) + (ws.length - 1) * 6) / 2
    marken.forEach((m, i) => { chip(ctx, x + ws[i] / 2, cy + D * 0.16 + size * 0.68, m.t, m.bg, m.fg, size, m.ball); x += ws[i] + 6 })
  }
  // Namensplatte
  const name = (p?.nachname ?? 'N. N.').toUpperCase()
  const fs = Math.min(D * plattenSchrift(name, p?.number != null) * 1.08, 40)
  ctx.font = `400 ${fs}px ${FONT_DISPLAY}`
  spacing(ctx, fs * 0.02)
  const num = p?.number != null ? String(p.number) : ''
  const pad = fs * 0.34
  const nw = num ? ctx.measureText(num).width + pad * 1.6 : 0
  const tw = ctx.measureText(name).width + pad * 2
  const ph = fs * 1.38, py = cy + D / 2 + D * 0.07
  const x0 = cx - (nw + tw) / 2
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4
  if (nw) { ctx.fillStyle = ROT; ctx.fillRect(x0, py, nw, ph) }
  ctx.fillStyle = 'rgba(8,8,8,0.94)'; ctx.fillRect(x0 + nw, py, tw, ph)
  ctx.restore()
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center'
  if (nw) { ctx.fillStyle = '#fff'; ctx.fillText(num, x0 + nw / 2, py + ph / 2 + fs * 0.04) }
  ctx.fillStyle = p ? '#fff' : 'rgba(255,255,255,0.55)'; ctx.fillText(name, x0 + nw + tw / 2, py + ph / 2 + fs * 0.04)
  spacing(ctx, 0)
}

export async function renderAufstellungStory(g: AufstellungGrafik): Promise<HTMLCanvasElement> {
  await ensureCardFonts()
  const wappen = await bild('/brand/wappen.png')
  const partnerLogo = await bild(g.partner?.logoUrl)
  // Bilder vorladen (parallel)
  await Promise.all([...g.slots.map((s) => bild(s.spieler?.bild)), ...g.bank.map((b) => bild(b.spieler.bild))])

  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')!
  // Grund: Schwarz, rotes Flutlicht, CI-Streifen
  ctx.fillStyle = '#0b0a0a'; ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, -200, 50, W / 2, -200, 1300)
  glow.addColorStop(0, 'rgba(233,29,41,0.42)'); glow.addColorStop(1, 'rgba(233,29,41,0)')
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
  ctx.save(); ctx.globalAlpha = 0.05; ctx.fillStyle = ROT
  for (let x = -H; x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + 36, H); ctx.lineTo(x + 36 + H * 0.47, 0); ctx.lineTo(x + H * 0.47, 0); ctx.closePath(); ctx.fill() }
  ctx.restore()

  // Kopf
  ctx.fillStyle = ROT; ctx.fillRect(40, 96, 10, 240)
  if (wappen) ctx.drawImage(wappen, 78, 112, 150, 150)
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff'
  // Formation (rechts oben) zuerst messen → Titel bekommt den Rest der Breite
  ctx.font = `400 84px ${FONT_DISPLAY}`
  const fw = ctx.measureText(g.formation).width + 56
  ctx.fillStyle = '#fff'
  ctx.font = `400 ${g.vorlaeufig ? 92 : 118}px ${FONT_DISPLAY}`; spacing(ctx, 2)
  ctx.fillText((g.vorlaeufig ? 'Voraussichtliche Elf' : g.kopf.titel).toUpperCase(), 256, 210, W - 256 - fw - 90)
  spacing(ctx, 4)
  ctx.font = `800 40px ${FONT_BODY}`; ctx.fillStyle = 'rgba(255,255,255,0.9)'
  const paarung = (g.kopf.gegner ? (g.kopf.heim ? `SVA – ${g.kopf.gegner}` : `${g.kopf.gegner} – SVA`) : 'SV Agathenburg-Dollern').toUpperCase()
  ctx.fillText(paarung, 258, 276, 520)
  const pw = Math.min(520, ctx.measureText(paarung).width)
  spacing(ctx, 0)
  if (g.kopf.stand) {
    ctx.font = `400 46px ${FONT_DISPLAY}`
    const sw = ctx.measureText(g.kopf.stand).width + 28
    ctx.fillStyle = ROT; ctx.beginPath(); ctx.roundRect(258 + pw + 18, 234, sw, 54, 6); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(g.kopf.stand, 258 + pw + 18 + sw / 2, 279); ctx.textAlign = 'left'
  }
  if (g.kopf.zeile) { ctx.font = `500 30px ${FONT_BODY}`; ctx.fillStyle = 'rgba(236,234,232,0.62)'; ctx.fillText(g.kopf.zeile, 258, 326, 600) }
  // Formation
  ctx.font = `400 84px ${FONT_DISPLAY}`
  ctx.save(); ctx.shadowColor = 'rgba(233,29,41,0.45)'; ctx.shadowBlur = 30
  ctx.fillStyle = ROT; ctx.beginPath(); ctx.roundRect(W - 50 - fw, 124, fw, 118, 14); ctx.fill(); ctx.restore()
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(g.formation, W - 50 - fw / 2, 218)

  // Spielfeld + Elf (hinten zuerst, damit vorne oben liegt)
  zeichneFeld(ctx)
  const reihe = [...g.slots].sort((a, b) => a.y - b.y)
  for (const s of reihe) await zeichneSpieler(ctx, s, 'bild')
  for (const s of reihe) await zeichneSpieler(ctx, s, 'text')

  // Bank
  let y = BOX.y + BOX.h + 70
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(40, y - 50); ctx.lineTo(W - 40, y - 50); ctx.stroke()
  ctx.font = `400 46px ${FONT_DISPLAY}`; ctx.fillStyle = ROT; spacing(ctx, 2); ctx.fillText('BANK', 60, y); spacing(ctx, 0)
  const bank = g.bank.slice(0, 8)
  bank.forEach((b, i) => {
    const col = i % 2, row = Math.floor(i / 2)
    const x = 270 + col * 390, yy = y + row * 58
    ctx.globalAlpha = b.raus ? 0.6 : 1
    ctx.font = `400 42px ${FONT_DISPLAY}`
    let xx = x
    if (b.spieler.number != null) { ctx.fillStyle = ROT; ctx.fillText(String(b.spieler.number), xx, yy); xx += ctx.measureText(String(b.spieler.number)).width + 14 }
    ctx.fillStyle = '#fff'; ctx.fillText(b.spieler.nachname.toUpperCase(), xx, yy, 250)
    if (b.raus) { const w = Math.min(250, ctx.measureText(b.spieler.nachname.toUpperCase()).width); ctx.font = `800 26px ${FONT_BODY}`; ctx.fillStyle = '#ff6b73'; ctx.fillText(`▼ ${b.raus}`, xx + w + 12, yy - 4) }
    ctx.globalAlpha = 1
  })
  y += Math.max(1, Math.ceil(bank.length / 2)) * 58 + 40
  // Trainer
  if (g.trainer.length) {
    ctx.font = `400 46px ${FONT_DISPLAY}`; ctx.fillStyle = ROT; spacing(ctx, 2); ctx.fillText('TRAINER', 60, y); spacing(ctx, 0)
    let x = 270
    for (const t of g.trainer.slice(0, 2)) {
      ctx.font = `400 42px ${FONT_DISPLAY}`; ctx.fillStyle = '#fff'
      ctx.fillText(t.name.toUpperCase(), x, y); x += ctx.measureText(t.name.toUpperCase()).width + 12
      if (t.rolle !== 'Trainer') { ctx.font = `700 22px ${FONT_BODY}`; ctx.fillStyle = 'rgba(236,234,232,0.6)'; ctx.fillText(t.rolle.toUpperCase(), x, y - 4); x += ctx.measureText(t.rolle.toUpperCase()).width }
      x += 34
    }
  }
  // Fuß: präsentiert von / Verein
  const fy = H - 70
  ctx.textAlign = 'center'
  if (g.partner) {
    ctx.font = `800 24px ${FONT_BODY}`; ctx.fillStyle = 'rgba(236,234,232,0.62)'; spacing(ctx, 5)
    const label = 'PRÄSENTIERT VON'
    const lw = ctx.measureText(label).width
    if (partnerLogo) {
      const lh = 64, lwImg = Math.min(300, lh * (partnerLogo.naturalWidth / partnerLogo.naturalHeight))
      const total = lw + 30 + lwImg
      ctx.textAlign = 'left'; ctx.fillText(label, W / 2 - total / 2, fy + 8)
      ctx.drawImage(partnerLogo, W / 2 - total / 2 + lw + 30, fy - lh / 2, lwImg, lh)
    } else {
      ctx.fillText(`${label}  ${g.partner.name.toUpperCase()}`, W / 2, fy + 8)
    }
    spacing(ctx, 0)
  } else {
    ctx.font = `800 26px ${FONT_BODY}`; ctx.fillStyle = 'rgba(236,234,232,0.5)'; spacing(ctx, 6)
    ctx.fillText('SV AGATHENBURG-DOLLERN', W / 2, fy + 8); spacing(ctx, 0)
  }
  return cv
}

/** Teilen (Handy: Share-Sheet mit Datei) oder Download. */
export async function teileAufstellungStory(g: AufstellungGrafik): Promise<'geteilt' | 'geladen'> {
  const cv = await renderAufstellungStory(g)
  const blob: Blob = await new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('Bild konnte nicht erzeugt werden'))), 'image/png'))
  const name = `sva-aufstellung${g.kopf.gegner ? '-' + g.kopf.gegner.toLowerCase().replace(/[^a-z0-9]+/g, '-') : ''}.png`
  const file = new File([blob], name, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (x: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Aufstellung SVA' })
      return 'geteilt'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'geteilt'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'geladen'
}

