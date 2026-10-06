// ─────────────────────────────────────────────────────────────
// v20-K: Canvas-Renderer der Sammelkarte — gleiches Design wie
// <SvaKarte/> (karten.css), gleiche Geometrie (geometrie.ts).
// Genutzt von: Story-Export (1080×1920 PNG), Pack-Opening-Video
// (MediaRecorder), „Zeig deinen Pull", 3D-Kartentextur im Rundgang.
// Bewusst three-/React-frei. Alle Assets über Modul-Caches (medien.ts).
// ─────────────────────────────────────────────────────────────
import { FENSTER, INNEN, KARTE_B, LAYOUT, UMRISS, canvasPfad, einruecken, nachnameGroesse, type Punkt } from './geometrie'
import { figurMessen, ladeBild, ladeSchriften } from './medien'
import { muster, SYMBOL_PFAD } from './muster'
import { ART_NAME, POSITION_NAME, SELTEN_NAME, kartenNummer, teileName, type KartenDaten, type Seltenheit } from './typen'
import { standardWerteText } from './werte'

export const F_DISPLAY = 'Anton, "Archivo Variable", system-ui, sans-serif'
export const F_TEXT = '"Archivo Variable", Archivo, system-ui, sans-serif'

export interface KartenAssets {
  figur: HTMLImageElement | null
  foto: HTMLImageElement | null
  logo: HTMLImageElement | null
  wappen: HTMLImageElement | null
  praegung: HTMLImageElement | null
  guilloche: HTMLImageElement | null
  buerstung: HTMLImageElement | null
  rauten: HTMLImageElement | null
  funkeln: HTMLImageElement | null
}

export async function ladeKartenAssets(d: KartenDaten): Promise<KartenAssets> {
  const m = muster()
  const person = d.art === 'spieler' || d.art === 'trainer'
  const [figur, foto, logo, wappen, praegung, guilloche, buerstung, rauten, funkeln] = await Promise.all([
    person ? ladeBild(d.figur) : Promise.resolve(null),
    !person || !d.figur ? ladeBild(d.foto) : Promise.resolve(null),
    d.art === 'partner' ? ladeBild(d.logo) : Promise.resolve(null),
    ladeBild('/brand/aga-logo.png'),
    ladeBild('/brand/wappen.png'),
    ladeBild(m.guilloche),
    ladeBild(m.buerstung),
    ladeBild(m.rauten),
    ladeBild(m.funkeln),
    ladeSchriften(),
  ])
  return { figur, foto, logo, wappen, praegung, guilloche, buerstung, rauten, funkeln }
}

const FARBEN: Record<Seltenheit, [string, string, string, string]> = {
  bronze: ['#ff6a72', '#E91D29', '#6d0b12', '#c4161f'],
  silber: ['#ffffff', '#8b929b', '#eef1f5', '#646b74'],
  gold: ['#fff1bd', '#c4952f', '#ffe7a0', '#8f6a1f'],
  spezial: ['#ffe9a8', '#ff7aa8', '#8fdcff', '#c9ffb8'],
}
const RAND_AUSSEN = einruecken(UMRISS, 0.45)
const RAND_BAND = einruecken(UMRISS, 1.9)

export interface ZeichenOpts {
  seite?: 'vorne' | 'hinten'
  /** Licht 0…1 (wie --mx/--my); Standard: ruhig oben links */
  mx?: number
  my?: number
  /** Glanz-Stärke 0…1 (wie --licht) */
  licht?: number
  /** Sekunden (Spezial: drehendes Licht) */
  zeit?: number
  /** Bodenschatten unter die Karte */
  schatten?: boolean
}

function abstand(ctx: CanvasRenderingContext2D, px: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  if ('letterSpacing' in c) c.letterSpacing = `${px}px`
}

function rahmenVerlauf(ctx: CanvasRenderingContext2D, s: Seltenheit, x: number, y: number, W: number) {
  const [a, b, c, d] = FARBEN[s]
  const g = ctx.createLinearGradient(x, y, x + W, y + W * 1.2 * 1.4)
  g.addColorStop(0, a)
  g.addColorStop(0.34, b)
  g.addColorStop(0.52, c)
  g.addColorStop(0.78, d)
  g.addColorStop(1, a)
  return g
}

/** Elliptischer Radial-Verlauf (CSS radial-gradient(rx ry at cx cy)). */
function ellipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, stops: [number, string][], x: number, y: number, w: number, h: number) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(1, ry / rx)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  stops.forEach(([o, c]) => g.addColorStop(o, c))
  ctx.fillStyle = g
  ctx.fillRect(x - cx, (y - cy) * (rx / ry), w, h * (rx / ry))
  ctx.restore()
}

function grund(ctx: CanvasRenderingContext2D, d: KartenDaten, x: number, y: number, W: number, H: number, hinten: boolean) {
  const u = W / 100
  ctx.fillStyle = '#0d0a0b'
  ctx.fillRect(x, y, W, H)
  const s = d.seltenheit
  if (hinten) {
    const st: Record<Seltenheit, [string, string, string]> = {
      bronze: ['#2a0b0f', '#140a0c', '#0b0809'],
      spezial: ['#2a0b0f', '#140a0c', '#0b0809'],
      silber: ['#2b2f34', '#17191c', '#0d0e10'],
      gold: ['#2b2112', '#15100a', '#0a0806'],
    }
    const [a, b, c] = st[s]
    ellipse(ctx, x + W / 2, y + H * 0.3, W * 0.6 * 1.2, H * 0.7 * 0.5 * 1.4, [[0, a], [0.55, b], [1, c]], x, y, W, H)
    return
  }
  if (s === 'silber') {
    ellipse(ctx, x + W / 2, y + H * 0.12, W * 0.55 * 1.1 * 1.2, H * 0.7 * 0.7, [[0, '#4a5059'], [0.46, '#23262b'], [0.82, '#0f1012'], [1, '#0f1012']], x, y, W, H)
    const l = ctx.createLinearGradient(x, y, x + W, y + H * 0.55)
    l.addColorStop(0.22, 'rgba(255,255,255,0)')
    l.addColorStop(0.34, 'rgba(220,228,238,0.16)')
    l.addColorStop(0.46, 'rgba(255,255,255,0)')
    l.addColorStop(0.6, 'rgba(255,255,255,0)')
    l.addColorStop(0.7, 'rgba(220,228,238,0.09)')
    l.addColorStop(0.8, 'rgba(255,255,255,0)')
    ctx.fillStyle = l
    ctx.fillRect(x, y, W, H)
  } else if (s === 'gold') {
    ellipse(ctx, x + W / 2, y + H * 0.4, W * 0.6 * 1.3, H * 0.8 * 0.6, [[0, '#2b2112'], [0.55, '#15100a'], [0.85, '#0a0806'], [1, '#0a0806']], x, y, W, H)
    ellipse(ctx, x + W / 2, y + H * 0.22, W * 0.45 * 1.2, H * 0.55 * 0.55, [[0, 'rgba(232,193,90,0.32)'], [0.7, 'rgba(232,193,90,0)'], [1, 'rgba(232,193,90,0)']], x, y, W, H)
  } else if (s === 'spezial') {
    ellipse(ctx, x + W / 2, y + H * 0.25, W * 0.6 * 1.3, H * 0.7 * 0.6, [[0, '#3a0a10'], [0.6, '#14070a'], [1, '#070405']], x, y, W, H)
  } else {
    ellipse(ctx, x + W / 2, y + H * 0.16, W * 0.6 * 1.25, H * 0.62 * 0.62, [[0, '#5c131b'], [0.46, '#2a0b0f'], [0.78, '#100a0b'], [1, '#100a0b']], x, y, W, H)
  }
  void u
}

function aurora(ctx: CanvasRenderingContext2D, x: number, y: number, W: number, H: number, zeit: number) {
  const c = ctx as CanvasRenderingContext2D & { createConicGradient?: (a: number, x: number, y: number) => CanvasGradient }
  if (!c.createConicGradient) return
  const cx = x + W / 2
  const cy = y + H * 0.42
  const g = c.createConicGradient(((zeit / 16) % 1) * Math.PI * 2 - Math.PI / 2, cx, cy)
  const st: [number, string][] = [
    [0, 'rgba(233,29,41,0)'], [40 / 360, 'rgba(233,29,41,0.55)'], [70 / 360, 'rgba(255,140,90,0.25)'], [110 / 360, 'rgba(233,29,41,0)'],
    [170 / 360, 'rgba(120,40,160,0.28)'], [220 / 360, 'rgba(233,29,41,0)'], [280 / 360, 'rgba(232,193,90,0.3)'], [330 / 360, 'rgba(233,29,41,0)'], [1, 'rgba(233,29,41,0)'],
  ]
  st.forEach(([o, col]) => g.addColorStop(o, col))
  ctx.fillStyle = g
  ctx.fillRect(x, y, W, H)
  // Strahlen
  const r = c.createConicGradient(-((zeit / 40) % 1) * Math.PI * 2, cx, cy)
  for (let i = 0; i < 24; i++) {
    r.addColorStop(i / 24, 'rgba(255,236,200,0.09)')
    r.addColorStop(i / 24 + 3 / 360, 'rgba(255,236,200,0.09)')
    r.addColorStop(i / 24 + 3.5 / 360, 'rgba(255,236,200,0)')
    r.addColorStop(Math.min(1, (i + 1) / 24 - 0.5 / 360), 'rgba(255,236,200,0)')
  }
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = r
  ctx.globalAlpha = 0.8
  ctx.fillRect(x, y, W, H)
  ctx.restore()
  // radial ausblenden: dunkler Rand
  const m = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.95)
  m.addColorStop(0, 'rgba(7,4,5,0)')
  m.addColorStop(1, 'rgba(7,4,5,0.35)')
  ctx.fillStyle = m
  ctx.fillRect(x, y, W, H)
}

function musterZeichnen(ctx: CanvasRenderingContext2D, d: KartenDaten, a: KartenAssets, x: number, y: number, W: number, H: number, hinten: boolean) {
  const u = W / 100
  ctx.save()
  const kachel = (img: HTMLImageElement | null, alpha: number, op: GlobalCompositeOperation) => {
    if (!img) return
    ctx.globalAlpha = alpha
    ctx.globalCompositeOperation = op
    const s = 4 * u
    for (let yy = y; yy < y + H; yy += s) for (let xx = x; xx < x + W; xx += s) ctx.drawImage(img, xx, yy, s, s)
  }
  if (hinten || d.seltenheit === 'bronze' || d.seltenheit === 'spezial') kachel(a.rauten, hinten ? 0.05 : 0.045, 'screen')
  else if (d.seltenheit === 'gold' && a.guilloche) {
    ctx.globalAlpha = 0.34
    ctx.drawImage(a.guilloche, x, y, W, H)
  } else if (d.seltenheit === 'silber' && a.buerstung) {
    ctx.globalAlpha = 0.55
    ctx.globalCompositeOperation = 'overlay'
    ctx.drawImage(a.buerstung, x, y, W, H)
  }
  ctx.restore()
}

/** Blindprägung: Wappen-Silhouette mit Licht/Schatten-Kante. */
const silCache = new Map<string, HTMLCanvasElement>()
function silhouette(img: HTMLImageElement, w: number, h: number, farbe: string) {
  const k = `${img.src}|${Math.round(w)}|${Math.round(h)}|${farbe}`
  let c = silCache.get(k)
  if (c) return c
  c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  const x = c.getContext('2d')!
  x.drawImage(img, 0, 0, c.width, c.height)
  x.globalCompositeOperation = 'source-in'
  x.fillStyle = farbe
  x.fillRect(0, 0, c.width, c.height)
  silCache.set(k, c)
  return c
}
function praegung(ctx: CanvasRenderingContext2D, img: HTMLImageElement, bx: number, by: number, bw: number, bh: number, staerke: number, warm = false) {
  const r = img.naturalWidth / img.naturalHeight
  let w = bw
  let h = bw / r
  if (h > bh) {
    h = bh
    w = bh * r
  }
  const x = bx + (bw - w) / 2
  const y = by + (bh - h) / 2
  const dd = Math.max(1, w * 0.012)
  ctx.save()
  ctx.globalAlpha = 0.07 * staerke
  ctx.drawImage(silhouette(img, w, h, warm ? '#ffe6a0' : '#ffffff'), x, y)
  ctx.globalAlpha = 0.28 * staerke
  ctx.drawImage(silhouette(img, w, h, '#000000'), x + dd, y + dd)
  ctx.globalAlpha = 0.12 * staerke
  ctx.drawImage(silhouette(img, w, h, warm ? '#ffe6a0' : '#ffffff'), x - dd, y - dd)
  ctx.restore()
}

function bildCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, fokus = '50% 35%') {
  const [fx, fy] = fokus.split(/\s+/).map((v) => parseFloat(v) / 100)
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight) * 1.04
  const iw = img.naturalWidth * s
  const ih = img.naturalHeight * s
  ctx.drawImage(img, x + (w - iw) * (isNaN(fx) ? 0.5 : fx), y + (h - ih) * (isNaN(fy) ? 0.35 : fy), iw, ih)
}

function ausblenden(W: number, H: number, malen: (o: CanvasRenderingContext2D) => void, von: number, bis: number) {
  const off = document.createElement('canvas')
  off.width = Math.max(1, Math.round(W))
  off.height = Math.max(1, Math.round(H))
  const o = off.getContext('2d')!
  malen(o)
  o.globalCompositeOperation = 'destination-in'
  const g = o.createLinearGradient(0, H * von, 0, H * bis)
  g.addColorStop(0, 'rgba(0,0,0,1)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  o.fillStyle = g
  o.fillRect(0, 0, W, H)
  return off
}

function polyPfad(ctx: CanvasRenderingContext2D, p: readonly Punkt[], x: number, y: number, W: number) {
  canvasPfad(ctx, p, x, y, W)
}

function rahmen(ctx: CanvasRenderingContext2D, s: Seltenheit, x: number, y: number, W: number) {
  const u = W / 100
  const g = rahmenVerlauf(ctx, s, x, y, W)
  ctx.save()
  ctx.beginPath()
  RAND_AUSSEN.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * u, y + py * u) : ctx.moveTo(x + px * u, y + py * u)))
  ctx.closePath()
  RAND_BAND.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * u, y + py * u) : ctx.moveTo(x + px * u, y + py * u)))
  ctx.closePath()
  ctx.fillStyle = g
  ctx.globalAlpha = s === 'bronze' ? 0.55 : 1
  ctx.fill('evenodd')
  ctx.globalAlpha = s === 'bronze' ? 0.75 : 0.9
  polyPfad(ctx, INNEN, x, y, W)
  ctx.strokeStyle = g
  ctx.lineWidth = 0.55 * u
  ctx.stroke()
  ctx.globalAlpha = 1
  polyPfad(ctx, RAND_AUSSEN, x, y, W)
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 0.3 * u
  ctx.stroke()
  ctx.restore()
}

function folie(ctx: CanvasRenderingContext2D, d: KartenDaten, a: KartenAssets, x: number, y: number, W: number, H: number, mx: number, my: number, licht: number) {
  const s = d.seltenheit
  ctx.save()
  // Band quer über die Karte, Lage nach Licht
  const lx = x + W * (1.3 - mx * 1.6)
  const ly = y + H * (1.3 - my * 1.6)
  const g = ctx.createLinearGradient(lx - W * 0.9, ly - H * 0.5, lx + W * 0.9, ly + H * 0.5)
  const band = (st: [number, string][]) => st.forEach(([o, c]) => g.addColorStop(o, c))
  if (s === 'bronze') {
    band([[0.38, 'rgba(255,150,150,0)'], [0.48, 'rgba(255,150,150,0.12)'], [0.58, 'rgba(255,150,150,0)']])
    ctx.globalCompositeOperation = 'screen'
  } else if (s === 'silber') {
    band([[0.3, 'rgba(210,225,245,0)'], [0.44, 'rgba(210,225,245,0.28)'], [0.5, 'rgba(255,255,255,0.55)'], [0.56, 'rgba(210,225,245,0.24)'], [0.7, 'rgba(210,225,245,0)']])
    ctx.globalCompositeOperation = 'overlay'
  } else if (s === 'gold') {
    band([[0.3, 'rgba(255,214,120,0)'], [0.44, 'rgba(255,214,120,0.35)'], [0.5, 'rgba(255,246,210,0.6)'], [0.56, 'rgba(255,214,120,0.3)'], [0.7, 'rgba(255,214,120,0)']])
    ctx.globalCompositeOperation = 'overlay'
  } else {
    const hues = [355, 35, 150, 205, 285, 355]
    for (let i = 0; i <= 20; i++) g.addColorStop(i / 20, `hsl(${hues[i % 5]} 90% 64%)`)
    ctx.globalCompositeOperation = 'soft-light'
  }
  ctx.globalAlpha = s === 'spezial' ? 0.42 + licht * 0.3 : 0.55 + licht * 0.45
  ctx.fillStyle = g
  ctx.fillRect(x, y, W, H)
  ctx.restore()
  if (s === 'spezial' && a.funkeln) {
    // Funkeln: Regenbogen nur durch die Funken-Maske
    const off = document.createElement('canvas')
    off.width = Math.round(W)
    off.height = Math.round(H)
    const o = off.getContext('2d')!
    o.drawImage(a.funkeln, 0, 0, W, H)
    o.globalCompositeOperation = 'source-in'
    const r = o.createLinearGradient(-W * mx, -H * my, W * (2 - mx), H * (2 - my))
    const hues = [355, 45, 160, 210, 290]
    for (let i = 0; i <= 15; i++) r.addColorStop(i / 15, `hsl(${hues[i % 5]} 90% 74%)`)
    o.fillStyle = r
    o.fillRect(0, 0, W, H)
    ctx.save()
    ctx.globalCompositeOperation = 'color-dodge'
    ctx.globalAlpha = 0.45 + licht * 0.45
    ctx.drawImage(off, x, y)
    ctx.restore()
  }
}

function figur(ctx: CanvasRenderingContext2D, d: KartenDaten, img: HTMLImageElement, x: number, y: number, W: number) {
  const u = W / 100
  const H = W * 1.4
  const m = figurMessen(img)
  const fw = LAYOUT.figurBreite * u
  const fh = fw * m.ratio
  const kopf = (d.art === 'trainer' ? LAYOUT.figurKopfStab : LAYOUT.figurKopf) * u
  const top = kopf - m.kopf * fh
  const left = ((100 - LAYOUT.figurBreite) / 2 + LAYOUT.figurVersatz) * u
  const off = ausblenden(W, H, (o) => o.drawImage(img, left, top, fw, fh), LAYOUT.figurAusVon, LAYOUT.figurAusBis)
  ctx.save()
  ctx.beginPath()
  ctx.rect(x + 3.4 * u, y - 12 * u, W - 6.8 * u, H + 12 * u)
  ctx.clip()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 1.6 * u
  ctx.shadowOffsetY = 1.2 * u
  ctx.drawImage(off, x, y)
  ctx.restore()
}

function chip(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, u: number, bg: string | CanvasGradient, fg: string, groesse = 4.2, rechts = false) {
  ctx.save()
  ctx.font = `800 ${groesse * u}px ${F_TEXT}`
  abstand(ctx, groesse * 0.14 * u)
  const w = ctx.measureText(text).width + 4 * u
  const h = groesse * 1.15 * u + 2.4 * u
  const x0 = rechts ? x - w : x
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.roundRect(x0, y, w, h, 0.8 * u)
  ctx.fill()
  ctx.fillStyle = fg
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(text, x0 + 2 * u, y + h / 2 + 0.2 * u)
  ctx.restore()
  return w
}

function symbol(ctx: CanvasRenderingContext2D, s: Seltenheit, cx: number, cy: number, gr: number, farbe: string) {
  ctx.save()
  ctx.translate(cx - gr / 2, cy - gr / 2)
  ctx.scale(gr / 10, gr / 10)
  ctx.fillStyle = farbe
  ctx.fill(new Path2D(SYMBOL_PFAD[s]))
  ctx.restore()
}

function goldText(ctx: CanvasRenderingContext2D, top: number, bottom: number) {
  const g = ctx.createLinearGradient(0, top, 0, bottom)
  g.addColorStop(0, '#fff0b8')
  g.addColorStop(0.55, '#E8C15A')
  g.addColorStop(1, '#b8912f')
  return g
}

function infoZeile(d: KartenDaten): string {
  if (d.art === 'spieler') {
    const t = [d.position ? POSITION_NAME[d.position] : null, d.kapitaen ? 'Kapitän' : null].filter(Boolean)
    return (t.length ? t.join(' · ') : 'SV Agathenburg-Dollern').toUpperCase()
  }
  if (d.art === 'trainer') return 'SV AGATHENBURG-DOLLERN'
  if (d.art === 'partner') return d.partnerSeit ? `PARTNER SEIT ${d.partnerSeit}` : 'PARTNER DES SVA'
  if (d.praesentiertVon) return `PRÄSENTIERT VON ${d.praesentiertVon.name.toUpperCase()}`
  return d.art === 'fan' ? 'DIE KURVE · SVA' : 'SV AGATHENBURG-DOLLERN'
}

function vorne(ctx: CanvasRenderingContext2D, d: KartenDaten, a: KartenAssets, x: number, y: number, W: number, o: ZeichenOpts) {
  const u = W / 100
  const H = W * 1.4
  const person = d.art === 'spieler' || d.art === 'trainer'
  const mitFigur = person && !!a.figur
  const titelGross = (d.art === 'fan' && !a.foto) || (d.art === 'partner' && !a.logo)
  const fotoKarte = !mitFigur && d.art !== 'partner' && !!a.foto
  const meister = /meister/i.test(d.serie ?? '')

  // ── Körper (geclippt) ──
  ctx.save()
  polyPfad(ctx, UMRISS, x, y, W)
  ctx.clip()
  grund(ctx, d, x, y, W, H, false)
  if (d.seltenheit === 'spezial') aurora(ctx, x, y, W, H, o.zeit ?? 0)
  musterZeichnen(ctx, d, a, x, y, W, H, false)
  if (a.praegung) {
    const stark = !mitFigur && !fotoKarte
    if (stark) praegung(ctx, a.praegung, x + 13 * u, y + 18 * u, 74 * u, 87 * u, 1.15, d.seltenheit === 'gold')
    else if (person) praegung(ctx, a.praegung, x + 13 * u, y + 22 * u, 74 * u, 87 * u, mitFigur ? 0.6 : 1, d.seltenheit === 'gold')
  }
  if (mitFigur && d.nummer != null && d.art === 'spieler') {
    ctx.save()
    ctx.font = `${74 * u}px ${F_DISPLAY}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.lineWidth = 0.35 * u
    ctx.strokeStyle = d.seltenheit === 'silber' ? 'rgba(230,236,244,0.3)' : d.seltenheit === 'gold' ? 'rgba(255,226,150,0.38)' : 'rgba(232,193,90,0.22)'
    ctx.strokeText(String(d.nummer), x + 58 * u, y + 2 * u + 74 * u * 0.08)
    ctx.restore()
  }
  if (fotoKarte && a.foto) {
    const off = document.createElement('canvas')
    off.width = Math.round(W)
    off.height = Math.round(H)
    const oc = off.getContext('2d')!
    canvasPfad(oc, FENSTER, 0, 0, W)
    oc.clip()
    bildCover(oc, a.foto, 0, 0, W, H * 0.76, mitFigur ? '50% 18%' : d.fokus ?? '50% 35%')
    oc.globalCompositeOperation = 'destination-in'
    const g = oc.createLinearGradient(0, H * 0.58, 0, H * 0.8)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    oc.fillStyle = g
    oc.fillRect(0, 0, W, H)
    ctx.drawImage(off, x, y)
  }
  if (d.art === 'partner' && a.logo) {
    const tx = x + 12 * u
    const ty = y + 22 * u
    const tw = 76 * u
    const th = 46 * u
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 3 * u
    ctx.shadowOffsetY = 1.2 * u
    const g = ctx.createLinearGradient(0, ty, 0, ty + th)
    g.addColorStop(0, '#faf8f5')
    g.addColorStop(1, '#ebe7e1')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.roundRect(tx, ty, tw, th, 1.4 * u)
    ctx.fill()
    ctx.restore()
    const pad = 7 * u
    const r = a.logo.naturalWidth / a.logo.naturalHeight || 2
    let lw = tw - pad * 2
    let lh = lw / r
    if (lh > th - pad * 2) {
      lh = th - pad * 2
      lw = lh * r
    }
    ctx.drawImage(a.logo, tx + (tw - lw) / 2, ty + (th - lh) / 2, lw, lh)
  }
  // Namensplatte
  const pl = ctx.createLinearGradient(0, y + H - 62 * u, 0, y + H)
  const pc = d.seltenheit === 'gold' ? '10,8,5' : d.seltenheit === 'silber' ? '9,10,12' : '8,5,6'
  pl.addColorStop(0, `rgba(${pc},0)`)
  pl.addColorStop(0.34, `rgba(${pc},0.86)`)
  pl.addColorStop(0.62, `rgba(${pc},0.97)`)
  pl.addColorStop(1, `rgba(${pc},0.97)`)
  ctx.fillStyle = pl
  ctx.fillRect(x, y + H - 62 * u, W, 62 * u)
  rahmen(ctx, d.seltenheit, x, y, W)
  folie(ctx, d, a, x, y, W, H, o.mx ?? 0.5, o.my ?? 0.3, o.licht ?? 0)
  ctx.restore()

  if (mitFigur && a.figur) figur(ctx, d, a.figur, x, y, W)

  // ── Text ──
  ctx.save()
  ctx.textAlign = 'center'
  const schatten = (b: number) => {
    ctx.shadowColor = 'rgba(0,0,0,0.65)'
    ctx.shadowBlur = b * u
    ctx.shadowOffsetY = 0.4 * u
  }
  if (person) {
    const sx = x + 15.5 * u
    let yy = y + 7.5 * u
    if (d.art === 'spieler') {
      if (d.nummer != null) {
        ctx.save()
        ctx.font = `${19 * u}px ${F_DISPLAY}`
        ctx.textBaseline = 'alphabetic'
        ctx.fillStyle = goldText(ctx, yy, yy + 17 * u)
        schatten(0.8)
        ctx.fillText(String(d.nummer), sx, yy + 16.4 * u)
        ctx.restore()
        yy += 17.1 * u + 1.2 * u
      }
      if (d.position) {
        ctx.save()
        ctx.font = `800 ${5.6 * u}px ${F_TEXT}`
        abstand(ctx, 0.56 * u)
        ctx.fillStyle = '#F4F2EF'
        schatten(1)
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(d.position, sx + 0.28 * u, yy + 4.6 * u)
        ctx.restore()
        yy += 5.6 * u + 1.2 * u
      }
    } else {
      ctx.save()
      const rolle = (d.rolle ?? 'Trainerstab').toUpperCase()
      ctx.font = `800 ${4.8 * u}px ${F_TEXT}`
      abstand(ctx, 0.77 * u)
      const tw = ctx.measureText(rolle).width
      ctx.translate(sx, yy + tw)
      ctx.rotate(-Math.PI / 2)
      ctx.fillStyle = '#ff4752'
      schatten(1)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(rolle, 0, 0)
      ctx.restore()
      yy += tw + 1 * u + 1.2 * u
    }
    if (a.wappen) {
      const ww = 11.5 * u
      const wh = ww * (a.wappen.naturalHeight / a.wappen.naturalWidth)
      ctx.save()
      schatten(0.8)
      ctx.drawImage(a.wappen, sx - ww / 2, yy + 0.8 * u, ww, wh)
      ctx.restore()
      yy += wh + 0.8 * u + 1.2 * u
    }
    if (d.kapitaen && d.art === 'spieler') {
      const r = 4.2 * u
      const g = ctx.createLinearGradient(sx - r, yy, sx + r, yy + 2 * r)
      g.addColorStop(0, '#ffe9a3')
      g.addColorStop(1, '#b8912f')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(sx, yy + 0.6 * u + r, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#1a1206'
      ctx.font = `${5.4 * u}px ${F_DISPLAY}`
      ctx.textBaseline = 'middle'
      ctx.fillText('C', sx, yy + 0.6 * u + r + 0.3 * u)
    }
  } else {
    const serie = (d.serie ?? ART_NAME[d.art]).toUpperCase()
    chip(ctx, serie, x + 7.5 * u, y + 7.5 * u, u, 'rgba(11,10,11,0.72)', meister ? '#E8C15A' : '#F4F2EF')
    if (a.wappen) {
      const ww = 10 * u
      ctx.drawImage(a.wappen, x + W - 7.5 * u - ww, y + 7.5 * u, ww, ww * (a.wappen.naturalHeight / a.wappen.naturalWidth))
    }
  }
  if (d.variante || d.limitiert || d.neuzugang) {
    const t = (d.limitiert ? 'Limitiert' : d.variante ? 'Glanz' : 'Neu').toUpperCase()
    let bg: string | CanvasGradient = 'rgba(244,242,239,0.92)'
    let fg = '#141213'
    if (d.limitiert) {
      bg = '#E91D29'
      fg = '#ffffff'
    } else if (d.seltenheit === 'gold') {
      const g = ctx.createLinearGradient(0, 0, 10 * u, 6 * u)
      g.addColorStop(0, '#fff0b8')
      g.addColorStop(1, '#c99a34')
      bg = g
    }
    chip(ctx, t, x + W - 6.5 * u, y + (person ? 8 : 19) * u, u, bg, fg, 3.6, true)
  }
  if (titelGross) {
    ctx.save()
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.font = `${21 * u}px ${F_DISPLAY}`
    d.titel
      .toUpperCase()
      .split(/\s+/)
      .forEach((w, i) => {
        ctx.fillStyle = i % 2 ? '#E91D29' : '#F4F2EF'
        ctx.fillText(w, x + 8 * u, y + 30 * u + (i + 1) * 18.9 * u - 1.6 * u)
      })
    ctx.restore()
  }
  // Namensblock
  const { vorname, nachname } = teileName(d.titel)
  let ny = y + (person ? 92.5 : 89) * u
  const cx = x + W / 2
  ctx.textBaseline = 'alphabetic'
  const klein = person ? (vorname ? vorname.toUpperCase() : '') : !titelGross && d.untertitel ? d.untertitel.toUpperCase() : ''
  if (klein) {
    ctx.save()
    const gr = person ? 4.4 : 3.8
    ctx.font = `700 ${gr * u}px ${F_TEXT}`
    abstand(ctx, (person ? 0.2 : 0.12) * gr * u)
    ctx.fillStyle = person ? 'rgba(244,242,239,0.78)' : '#E91D29'
    ctx.fillText(klein, cx + (person ? 0.44 : 0.23) * u, ny + gr * 0.84 * u)
    ctx.restore()
    ny += gr * u + 1.2 * u
  }
  if (!titelGross) {
    const t = (person ? nachname : d.titel).toUpperCase()
    const gr = person ? nachnameGroesse(t) : nachnameGroesse(t, 12.5, 84)
    ctx.save()
    ctx.font = `${gr * u}px ${F_DISPLAY}`
    ctx.fillStyle = '#F4F2EF'
    ctx.shadowColor = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur = 1.6 * u
    ctx.shadowOffsetY = 0.6 * u
    ctx.fillText(t, cx, ny + gr * 0.9 * u)
    ctx.restore()
    ny += gr * u
  } else if (d.untertitel) {
    ctx.save()
    ctx.font = `700 ${3.8 * u}px ${F_TEXT}`
    abstand(ctx, 0.46 * u)
    ctx.fillStyle = '#E91D29'
    ctx.fillText(d.untertitel.toUpperCase(), cx, ny + 3.2 * u)
    ctx.restore()
    ny += 3.8 * u
  }
  // Linie
  ny += 2 * u
  const lg = ctx.createLinearGradient(cx - 29 * u, 0, cx + 29 * u, 0)
  const lc = d.seltenheit === 'silber' ? '#dfe4ea' : d.seltenheit === 'gold' ? '#E8C15A' : d.seltenheit === 'spezial' ? '#ff7aa8' : '#E91D29'
  lg.addColorStop(0, 'rgba(0,0,0,0)')
  lg.addColorStop(0.5, lc)
  lg.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = lg
  ctx.fillRect(cx - 29 * u, ny, 58 * u, 0.45 * u)
  ny += 0.45 * u + 1.8 * u
  ctx.save()
  ctx.font = `700 ${3.1 * u}px ${F_TEXT}`
  abstand(ctx, 0.68 * u)
  ctx.fillStyle = 'rgba(244,242,239,0.62)'
  ctx.fillText(infoZeile(d), cx + 0.34 * u, ny + 2.6 * u)
  ctx.restore()
  // Credit (senkrecht)
  if (d.credit && fotoKarte) {
    ctx.save()
    ctx.translate(x + W - 5.4 * u - 1.2 * u, y + 22 * u)
    ctx.rotate(Math.PI / 2)
    ctx.font = `700 ${2.3 * u}px ${F_TEXT}`
    abstand(ctx, 0.41 * u)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(244,242,239,0.78)'
    ctx.shadowColor = 'rgba(0,0,0,0.9)'
    ctx.shadowBlur = 0.8 * u
    ctx.fillText(`FOTO: ${d.credit.toUpperCase()}`, 0, 0)
    ctx.restore()
  }
  // Fuß
  const fy = y + 124.4 * u
  ctx.save()
  ctx.font = `700 ${2.5 * u}px ${F_TEXT}`
  abstand(ctx, 0.35 * u)
  ctx.fillStyle = 'rgba(244,242,239,0.45)'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText((kartenNummer(d) ?? 'SVA').toUpperCase(), x + 15 * u, fy)
  ctx.textAlign = 'right'
  ctx.fillText(d.saison ?? '', x + W - 15 * u, fy)
  ctx.restore()
  const symF = d.seltenheit === 'gold' ? '#E8C15A' : d.seltenheit === 'silber' ? '#e6ebf1' : d.seltenheit === 'spezial' ? '#ffd6e6' : 'rgba(244,242,239,0.7)'
  symbol(ctx, d.seltenheit, cx, fy, 3.6 * u, symF)
  ctx.restore()

  // Glanz
  if ((o.licht ?? 0) > 0) {
    ctx.save()
    polyPfad(ctx, UMRISS, x, y, W)
    ctx.clip()
    ctx.globalCompositeOperation = 'overlay'
    ctx.globalAlpha = (o.licht ?? 0) * 0.9
    const gx = x + W * (o.mx ?? 0.5)
    const gy = y + H * (o.my ?? 0.3)
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, W * 0.7)
    g.addColorStop(0, 'rgba(255,255,255,0.45)')
    g.addColorStop(0.6, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(x, y, W, H)
    ctx.restore()
  }
}

function hinten(ctx: CanvasRenderingContext2D, d: KartenDaten, a: KartenAssets, x: number, y: number, W: number) {
  const u = W / 100
  const H = W * 1.4
  ctx.save()
  polyPfad(ctx, UMRISS, x, y, W)
  ctx.clip()
  grund(ctx, d, x, y, W, H, true)
  musterZeichnen(ctx, d, a, x, y, W, H, true)
  if (a.praegung) praegung(ctx, a.praegung, x + 18 * u, y + 30 * u, 64 * u, 75 * u, 0.9, d.seltenheit === 'gold')
  rahmen(ctx, d.seltenheit, x, y, W)
  ctx.restore()
  ctx.save()
  const px = x + 10 * u
  let yy = y + 10 * u
  if (a.wappen) ctx.drawImage(a.wappen, px, yy, 9 * u, 9 * u * (a.wappen.naturalHeight / a.wappen.naturalWidth))
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `800 ${3.4 * u}px ${F_TEXT}`
  abstand(ctx, 0.48 * u)
  ctx.fillStyle = '#F4F2EF'
  ctx.fillText('SV AGATHENBURG-DOLLERN', px + 11.6 * u, yy + 4.6 * u)
  ctx.font = `700 ${2.8 * u}px ${F_TEXT}`
  ctx.fillStyle = 'rgba(244,242,239,0.55)'
  ctx.fillText(`SAMMELKARTE · SAISON ${d.saison ?? '2026/27'}`, px + 11.6 * u, yy + 8.6 * u)
  yy += 10.6 * u + 9 * u
  ctx.font = `800 ${3.6 * u}px ${F_TEXT}`
  abstand(ctx, 0.72 * u)
  ctx.fillStyle = d.seltenheit === 'gold' ? '#E8C15A' : '#E91D29'
  const art = d.art === 'spieler' && d.position ? POSITION_NAME[d.position] : d.art === 'trainer' ? d.rolle ?? 'Trainerstab' : d.serie ?? ART_NAME[d.art]
  ctx.fillText(art.toUpperCase(), px, yy + 3 * u)
  yy += 3.6 * u + 1.6 * u
  const tg = Math.min(11, 150 / Math.max(8, d.titel.length))
  ctx.font = `${tg * u}px ${F_DISPLAY}`
  abstand(ctx, 0)
  ctx.fillStyle = '#F4F2EF'
  ctx.fillText(d.titel.toUpperCase(), px, yy + tg * 0.9 * u)
  yy += tg * 0.98 * u + 6 * u
  const werte = (d.werte ?? standardWerteText(d)).slice(0, 5)
  for (const w of werte) {
    ctx.fillStyle = 'rgba(244,242,239,0.14)'
    ctx.fillRect(px, yy, 80 * u, 0.25 * u)
    ctx.font = `700 ${3.2 * u}px ${F_TEXT}`
    abstand(ctx, 0.38 * u)
    ctx.fillStyle = 'rgba(244,242,239,0.55)'
    ctx.textAlign = 'left'
    ctx.fillText(w.label.toUpperCase(), px, yy + 5.4 * u)
    ctx.font = `700 ${3.6 * u}px ${F_TEXT}`
    abstand(ctx, 0)
    ctx.fillStyle = '#F4F2EF'
    ctx.textAlign = 'right'
    ctx.fillText(w.wert, px + 80 * u, yy + 5.6 * u)
    yy += 8.2 * u
  }
  if (werte.length) {
    ctx.fillStyle = 'rgba(244,242,239,0.14)'
    ctx.fillRect(px, yy, 80 * u, 0.25 * u)
  }
  ctx.textAlign = 'center'
  const cx = x + W / 2
  ctx.font = `${9 * u}px ${F_DISPLAY}`
  abstand(ctx, 0.36 * u)
  ctx.fillStyle = '#F4F2EF'
  ctx.fillText(kartenNummer(d) ?? '—', cx, y + 115 * u)
  ctx.font = `800 ${3 * u}px ${F_TEXT}`
  abstand(ctx, 0.48 * u)
  ctx.fillStyle = 'rgba(244,242,239,0.7)'
  const sel = (SELTEN_NAME[d.seltenheit] + (d.variante ? ' · Glanz' : '') + (d.limitiert ? ' · Limitiert' : '')).toUpperCase()
  ctx.fillText(sel, cx + 2.4 * u, y + 121.4 * u)
  const sw = ctx.measureText(sel).width
  symbol(ctx, d.seltenheit, cx - sw / 2 - 1 * u, y + 120.4 * u, 3.6 * u, 'rgba(244,242,239,0.7)')
  if (d.credit) {
    ctx.font = `600 ${2.7 * u}px ${F_TEXT}`
    abstand(ctx, 0.16 * u)
    ctx.fillStyle = 'rgba(244,242,239,0.5)'
    ctx.fillText(`Foto: ${d.credit}`, cx, y + 126 * u)
  }
  ctx.restore()
}

/** Zeichnet die Karte; (x, y) = linke obere Ecke, Breite W (Höhe 1,4 W). */
export function zeichneKarte(ctx: CanvasRenderingContext2D, d: KartenDaten, a: KartenAssets, x: number, y: number, W: number, o: ZeichenOpts = {}) {
  const u = W / KARTE_B
  if (o.schatten) {
    ctx.save()
    const g = ctx.createRadialGradient(x + W / 2, y + W * 1.4, 0, x + W / 2, y + W * 1.4, W * 0.5)
    g.addColorStop(0, 'rgba(0,0,0,0.6)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.translate(x + W / 2, y + W * 1.4)
    ctx.scale(1, 0.25)
    ctx.translate(-(x + W / 2), -(y + W * 1.4))
    ctx.fillRect(x - 10 * u, y + W * 1.4 - W * 0.5, W + 20 * u, W)
    ctx.restore()
  }
  if (o.seite === 'hinten') hinten(ctx, d, a, x, y, W)
  else vorne(ctx, d, a, x, y, W, o)
}
