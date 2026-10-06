// ─────────────────────────────────────────────────────────────
// v20-K: Instagram-Bilder aus Karten (1080 × 1920 PNG):
//   storyNeueKarte(d)        „Neue Karte im Album" (Admin-Knopf je Karte)
//   pullBild(karten, name)   „Zeig deinen Pull" (Fan nach dem Pack)
// Gleicher Renderer wie die Karte selbst (zeichnen.ts). Teilen per
// navigator.share({ files }) mit Rückfall Download.
// ─────────────────────────────────────────────────────────────
import { ladeKartenAssets, zeichneKarte, F_DISPLAY, F_TEXT } from '../zeichnen'
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
  const sortiert = [...karten].sort((x, y) => SELTEN_RANG[y.seltenheit] - SELTEN_RANG[x.seltenheit])
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
    zeichneKarte(ctx, k, assets[i + 1], -cw * 0.36, -cw * 0.7 * 0.72, cw * 0.72, { zeit: 2 })
    ctx.restore()
  })
  zeichneKarte(ctx, top, assets[0], (STORY_W - cw) / 2, cy, cw, { schatten: true, licht: 0.55, mx: 0.3, my: 0.2, zeit: 3 })
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
