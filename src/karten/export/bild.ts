// ─────────────────────────────────────────────────────────────
// v20-K: Instagram-Bilder aus Karten (1080 × 1920 PNG):
//   storyNeueKarte(d)        „Neue Karte im Album" (Admin-Knopf je Karte)
//   pullBild(karten, name)   „Zeig deinen Pull" (Fan nach dem Pack)
//   storyShiny(d, finder)    v22: „SHINY gezogen!" (Admin → Album → Shiny & Geheim)
// Gleicher Renderer wie die Karte selbst (zeichnen.ts). Teilen per
// navigator.share({ files }) mit Rückfall Download.
// ─────────────────────────────────────────────────────────────
import { ladeKartenAssets, zeichneKarte, F_DISPLAY, F_TEXT, type KartenAssets, type ZeichenOpts } from '../zeichnen'
import { SELTEN_NAME, SELTEN_RANG, type KartenDaten, type Seltenheit } from '../typen'

export const STORY_W = 1080
export const STORY_H = 1920
const SITE = 'aga-erste.de/album'
const IG = '@svagathenburg'

const LICHT: Record<Seltenheit, string> = {
  bronze: '233,29,41',
  silber: '214,224,236',
  gold: '232,193,90',
  spezial: '255,122,168',
}

function abstand(ctx: CanvasRenderingContext2D, px: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  if ('letterSpacing' in c) c.letterSpacing = `${px}px`
}

/** Bühne: Schwarz, Licht in Seltenheitsfarbe von oben, feine Strahlen. */
export function zeichneBuehne(ctx: CanvasRenderingContext2D, s: Seltenheit, zeit = 0, staerke = 1) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  ctx.fillStyle = '#070506'
  ctx.fillRect(0, 0, W, H)
  const f = LICHT[s]
  const g = ctx.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, H * 0.62)
  g.addColorStop(0, `rgba(${f},${0.42 * staerke})`)
  g.addColorStop(0.45, `rgba(${f},${0.12 * staerke})`)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // Strahlen
  const c = ctx as CanvasRenderingContext2D & { createConicGradient?: (a: number, x: number, y: number) => CanvasGradient }
  if (c.createConicGradient) {
    const r = c.createConicGradient(zeit * 0.12, W / 2, H * 0.42)
    for (let i = 0; i < 28; i++) {
      r.addColorStop(i / 28, `rgba(${f},${0.075 * staerke})`)
      r.addColorStop(i / 28 + 2.4 / 360, `rgba(${f},${0.075 * staerke})`)
      r.addColorStop(i / 28 + 3 / 360, `rgba(${f},0)`)
      r.addColorStop(Math.min(1, (i + 1) / 28 - 0.2 / 360), `rgba(${f},0)`)
    }
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = r
    ctx.fillRect(0, 0, W, H)
    ctx.restore()
    const v = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, H * 0.7)
    v.addColorStop(0.3, 'rgba(7,5,6,0)')
    v.addColorStop(1, 'rgba(7,5,6,0.92)')
    ctx.fillStyle = v
    ctx.fillRect(0, 0, W, H)
  }
}

// ── v22: Shiny im Canvas — Karte zeichnen, dann per Gradient-Map in Schwarz-Gold
// tonen (läuft in jedem Browser, auch ohne ctx.filter), Sternenstaub + Prägung.
const GOLD: [number, number, number][] = [
  [4, 3, 2],
  [42, 29, 10],
  [150, 108, 34],
  [240, 200, 98],
  [255, 246, 214],
]
function goldTon(v: number): [number, number, number] {
  const t = Math.max(0, Math.min(0.9999, v)) * (GOLD.length - 1)
  const i = Math.floor(t)
  const f = t - i
  const a = GOLD[i]
  const b = GOLD[i + 1]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}
export function zeichneShinyKarte(ctx: CanvasRenderingContext2D, d: KartenDaten, a: KartenAssets, x: number, y: number, W: number, o: ZeichenOpts = {}) {
  const rand = Math.round(W * 0.12)
  const c = document.createElement('canvas')
  c.width = Math.round(W + rand * 2)
  c.height = Math.round(W * 1.4 + rand * 2)
  const k = c.getContext('2d', { willReadFrequently: true })!
  zeichneKarte(k, { ...d, shiny: false }, a, rand, rand, W, o)
  const img = k.getImageData(0, 0, c.width, c.height)
  const p = img.data
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue
    const l = (0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]) / 255
    const [r, g, b] = goldTon(Math.pow(l, 0.85) * 1.08)
    p[i] = r
    p[i + 1] = g
    p[i + 2] = b
  }
  k.putImageData(img, 0, 0)
  // Sternenstaub (deterministisch)
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  k.save()
  k.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 70; i++) {
    const sx = rand + rnd() * W
    const sy = rand + rnd() * W * 1.4
    const sr = W * (0.002 + rnd() * 0.006)
    k.fillStyle = `rgba(255,236,170,${(0.3 + rnd() * 0.6).toFixed(2)})`
    k.beginPath()
    k.moveTo(sx, sy - sr * 3)
    k.lineTo(sx + sr * 0.6, sy)
    k.lineTo(sx, sy + sr * 3)
    k.lineTo(sx - sr * 0.6, sy)
    k.closePath()
    k.moveTo(sx - sr * 3, sy)
    k.lineTo(sx, sy + sr * 0.6)
    k.lineTo(sx + sr * 3, sy)
    k.lineTo(sx, sy - sr * 0.6)
    k.closePath()
    k.fill()
  }
  k.restore()
  // „SHINY“-Prägung senkrecht rechts
  k.save()
  k.translate(rand + W * 0.92, rand + W * 0.22)
  k.rotate(Math.PI / 2)
  k.font = `${Math.round(W * 0.076)}px ${F_DISPLAY}`
  abstand(k, W * 0.026)
  k.strokeStyle = 'rgba(246,215,124,0.7)'
  k.lineWidth = Math.max(1, W * 0.003)
  k.strokeText('SHINY', 0, 0)
  k.restore()
  ctx.drawImage(c, x - rand, y - rand)
}

function kopf(ctx: CanvasRenderingContext2D, kicker: string, wappen: HTMLImageElement | null) {
  const W = ctx.canvas.width
  ctx.save()
  if (wappen) ctx.drawImage(wappen, W / 2 - 38, 96, 76, 76 * (wappen.naturalHeight / wappen.naturalWidth))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `800 26px ${F_TEXT}`
  abstand(ctx, 6)
  ctx.fillStyle = 'rgba(244,242,239,0.82)'
  ctx.fillText('SV AGATHENBURG-DOLLERN', W / 2 + 3, 232)
  ctx.font = `800 30px ${F_TEXT}`
  abstand(ctx, 7)
  ctx.fillStyle = '#E91D29'
  ctx.fillText(kicker, W / 2 + 3, 290)
  ctx.restore()
}

function fuss(ctx: CanvasRenderingContext2D, zeile: string) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  ctx.save()
  ctx.textAlign = 'center'
  ctx.font = `${64}px ${F_DISPLAY}`
  ctx.fillStyle = '#F4F2EF'
  ctx.fillText(zeile.toUpperCase(), W / 2, H - 230)
  ctx.font = `800 28px ${F_TEXT}`
  abstand(ctx, 5)
  ctx.fillStyle = 'rgba(244,242,239,0.66)'
  ctx.fillText(`${SITE.toUpperCase()}  ·  ${IG.toUpperCase()}`, W / 2 + 2, H - 160)
  ctx.fillStyle = '#E91D29'
  ctx.fillRect(W / 2 - 60, H - 120, 120, 4)
  ctx.restore()
}

function seltenZeile(d: KartenDaten): string {
  if (d.shiny) return 'SHINY  ·  ZÄHLT NICHT FÜRS ALBUM'
  if (d.geheim) return 'GEHEIMKARTE'
  const t = [SELTEN_NAME[d.seltenheit] + (d.variante ? '-Glanz' : ''), d.limitiert ? 'Limitiert' : null, d.serie ?? null].filter(Boolean)
  return t.join('  ·  ').toUpperCase()
}

async function wappen() {
  const { ladeBild } = await import('../medien')
  return ladeBild('/brand/aga-logo.png')
}

/** „Neue Karte im Album" — Story 1080×1920. */
export async function storyNeueKarte(d: KartenDaten): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas')
  c.width = STORY_W
  c.height = STORY_H
  const ctx = c.getContext('2d')!
  const [a, w] = await Promise.all([ladeKartenAssets(d), wappen()])
  zeichneBuehne(ctx, d.seltenheit, 2)
  kopf(ctx, d.limitiert ? 'LIMITIERTE KARTE' : 'NEUE KARTE IM ALBUM', w)
  const cw = 700
  zeichneKarte(ctx, d, a, (STORY_W - cw) / 2, 372, cw, { schatten: true, licht: 0.6, mx: 0.32, my: 0.22, zeit: 3 })
  ctx.save()
  ctx.textAlign = 'center'
  ctx.font = `800 28px ${F_TEXT}`
  abstand(ctx, 6)
  ctx.fillStyle = 'rgba(244,242,239,0.8)'
  ctx.fillText(seltenZeile(d), STORY_W / 2 + 3, 372 + cw * 1.4 + 92)
  ctx.restore()
  fuss(ctx, d.limitiert ? 'Nur diese Woche ziehbar' : 'Jetzt sammeln')
  return c
}

/** „Zeig deinen Pull": beste Karte groß, weitere gefächert dahinter. */
export async function pullBild(karten: KartenDaten[], name?: string): Promise<HTMLCanvasElement> {
  const rang = (k: KartenDaten) => (k.shiny ? 9 : k.geheim ? 8 : SELTEN_RANG[k.seltenheit])
  const sortiert = [...karten].sort((x, y) => rang(y) - rang(x))
  const top = sortiert[0]
  const c = document.createElement('canvas')
  c.width = STORY_W
  c.height = STORY_H
  const ctx = c.getContext('2d')!
  const [assets, w] = await Promise.all([Promise.all(sortiert.map((k) => ladeKartenAssets(k))), wappen()])
  zeichneBuehne(ctx, top.seltenheit, 1)
  kopf(ctx, name ? `${name.toUpperCase()} HAT GEZOGEN` : 'MEIN PULL', w)
  const cw = 640
  const cy = 420
  // Fächer: Nebenkarten gedreht hinter der besten
  const neben = sortiert.slice(1, 3)
  neben.forEach((k, i) => {
    const s = i === 0 ? -1 : 1
    ctx.save()
    ctx.translate(STORY_W / 2 + s * 250, cy + cw * 0.78)
    ctx.rotate((s * 11 * Math.PI) / 180)
    ctx.globalAlpha = 0.92
    ;(k.shiny ? zeichneShinyKarte : zeichneKarte)(ctx, k, assets[i + 1], -cw * 0.36, -cw * 0.7 * 0.72, cw * 0.72, { zeit: 2 })
    ctx.restore()
  })
  ;(top.shiny ? zeichneShinyKarte : zeichneKarte)(ctx, top, assets[0], (STORY_W - cw) / 2, cy, cw, { schatten: true, licht: 0.55, mx: 0.3, my: 0.2, zeit: 3 })
  ctx.save()
  ctx.textAlign = 'center'
  ctx.font = `800 28px ${F_TEXT}`
  abstand(ctx, 6)
  ctx.fillStyle = 'rgba(244,242,239,0.8)'
  ctx.fillText(seltenZeile(top), STORY_W / 2 + 3, cy + cw * 1.4 + 96)
  ctx.restore()
  fuss(ctx, 'Sammel mit')
  return c
}

/** v22: „SHINY gezogen!“ — Story 1080×1920 zum Posten (Erstfund wird genannt). */
export async function storyShiny(d: KartenDaten, finder?: string, datum?: string, chance = 250): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas')
  c.width = STORY_W
  c.height = STORY_H
  const ctx = c.getContext('2d')!
  const [a, w] = await Promise.all([ladeKartenAssets(d), wappen()])
  zeichneBuehne(ctx, 'gold', 1, 1.15)
  kopf(ctx, 'EXTREM SELTEN', w)
  ctx.save()
  ctx.textAlign = 'center'
  const g = ctx.createLinearGradient(0, 330, 0, 440)
  g.addColorStop(0, '#fff6d6')
  g.addColorStop(0.55, '#f0c862')
  g.addColorStop(1, '#a87a22')
  ctx.fillStyle = g
  ctx.font = `118px ${F_DISPLAY}`
  ctx.fillText('SHINY GEZOGEN!', STORY_W / 2, 430)
  ctx.restore()
  const cw = 620
  const y = 500
  zeichneShinyKarte(ctx, d, a, (STORY_W - cw) / 2, y, cw, { schatten: true, licht: 0.6, mx: 0.32, my: 0.22, zeit: 3 })
  ctx.save()
  ctx.textAlign = 'center'
  ctx.font = `800 30px ${F_TEXT}`
  abstand(ctx, 5)
  ctx.fillStyle = '#f6d77c'
  const unten = y + cw * 1.4 + 80
  if (finder) ctx.fillText(`ERSTFUND: ${finder.toUpperCase()}${datum ? `  ·  ${datum}` : ''}`, STORY_W / 2 + 2, unten)
  ctx.font = `700 24px ${F_TEXT}`
  ctx.fillStyle = 'rgba(244,242,239,0.7)'
  ctx.fillText(`CHANCE 1 : ${chance} JE KARTE  ·  ZÄHLT NICHT FÜRS ALBUM`, STORY_W / 2 + 2, unten + 48)
  ctx.restore()
  fuss(ctx, 'Wer findet die nächste?')
  return c
}

export function alsBlob(c: HTMLCanvasElement, typ = 'image/png'): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), typ))
}

export type TeilenErgebnis = 'geteilt' | 'gespeichert' | 'fehler'
/** Teilen (Web Share mit Datei) oder herunterladen. */
export async function teilen(blob: Blob, dateiname: string, text: string): Promise<TeilenErgebnis> {
  try {
    const file = new File([blob], dateiname, { type: blob.type })
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], text })
      return 'geteilt'
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = dateiname
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    return 'gespeichert'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'geteilt'
    return 'fehler'
  }
}

/** v26-B: Fan-Barometer-Story 1080×1920 (großer Balken, „NOCH N BIS ZUM PACK"). */
export async function storyBarometer(b: { gegner: string; anstoss: string; ziel: number; stand: number }): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas')
  c.width = STORY_W
  c.height = STORY_H
  const ctx = c.getContext('2d')!
  const W = c.width
  const H = c.height
  // Hintergrund
  ctx.fillStyle = '#070506'
  ctx.fillRect(0, 0, W, H)
  const g = ctx.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, H * 0.62)
  g.addColorStop(0, 'rgba(92,19,27,0.55)')
  g.addColorStop(1, 'rgba(7,5,6,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const w = await wappen()
  kopf(ctx, 'FAN-BAROMETER', w)
  const anteil = Math.max(0, Math.min(1, b.stand / Math.max(1, b.ziel)))
  const rest = Math.max(0, b.ziel - b.stand)
  const voll = b.stand >= b.ziel
  // Großer Stand
  ctx.textAlign = 'center'
  ctx.fillStyle = '#F4F2EF'
  ctx.font = `220px ${F_DISPLAY}`
  ctx.fillText(String(b.stand), W / 2, H * 0.44)
  ctx.font = `800 40px ${F_TEXT}`
  ctx.fillStyle = 'rgba(244,242,239,0.66)'
  ctx.fillText(`VON ${b.ziel} EINGECHECKT`, W / 2, H * 0.48)
  // Balken
  const bx = 120
  const bw = W - 240
  const by = H * 0.56
  const bh = 46
  ctx.fillStyle = 'rgba(244,242,239,0.12)'
  roundRect(ctx, bx, by, bw, bh, bh / 2)
  ctx.fill()
  const bg = ctx.createLinearGradient(bx, 0, bx + bw, 0)
  bg.addColorStop(0, '#E91D29')
  bg.addColorStop(1, voll ? '#3ddc84' : '#E8C15A')
  ctx.fillStyle = bg
  roundRect(ctx, bx, by, Math.max(bh, bw * anteil), bh, bh / 2)
  ctx.fill()
  // Call-to-action
  ctx.fillStyle = '#F4F2EF'
  ctx.font = `92px ${F_DISPLAY}`
  ctx.fillText(voll ? 'GESCHAFFT!' : `NOCH ${rest} BIS ZUM PACK`, W / 2, H * 0.68)
  ctx.font = `800 34px ${F_TEXT}`
  ctx.fillStyle = 'rgba(244,242,239,0.7)'
  const datum = new Date(b.anstoss).toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  ctx.fillText(`SVA – ${b.gegner.toUpperCase()}  ·  ${datum.toUpperCase()}`, W / 2, H * 0.72)
  fuss(ctx, voll ? 'Event-Pack für alle' : 'Gemeinsam einchecken')
  return c
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
