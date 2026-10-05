// ─────────────────────────────────────────────────────────────
// v17-A: Druckfertiges A4-Plakat „Check-in präsentiert von …“ für den
// Eingang (300 dpi, 2480 × 3508 px). Stil des Stickerheft-Covers:
// Rot-Schwarz, Rahmen, Wappen, großer QR-Code auf Weiß, Partner-Logo.
// Export als PNG oder als einseitiges PDF (JPEG eingebettet, kein Paket).
// ─────────────────────────────────────────────────────────────
import { qrMatrix, zeichneQr } from './qr'

export const A4 = { w: 2480, h: 3508 } as const

export interface PlakatDaten {
  url: string
  gegner: string
  anstoss: string
  saison: string
  partner: { name: string; logoUrl?: string | null } | null
}

function bildLaden(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = () => res(null)
    img.src = src
  })
}

function mittig(ctx: CanvasRenderingContext2D, text: string, y: number, maxBreite: number, groesse: number, font: string, gewicht = '400') {
  let g = groesse
  ctx.font = `${gewicht} ${g}px ${font}`
  while (ctx.measureText(text).width > maxBreite && g > 20) {
    g -= 4
    ctx.font = `${gewicht} ${g}px ${font}`
  }
  ctx.fillText(text, A4.w / 2, y)
}

export async function zeichnePlakat(canvas: HTMLCanvasElement, d: PlakatDaten): Promise<void> {
  canvas.width = A4.w
  canvas.height = A4.h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nicht verfügbar.')
  try {
    await Promise.all([document.fonts.load('400 120px Anton'), document.fonts.load('800 60px "Archivo Variable"')])
  } catch {
    /* Systemschrift */
  }
  const ANTON = 'Anton, Impact, "Arial Narrow", sans-serif'
  const BODY = '"Archivo Variable", Archivo, Arial, sans-serif'
  const { w, h } = A4

  // Hintergrund wie das Heft-Cover: dunkles Rot mit Vignette, schwarzer Rand, rote Linie
  const g = ctx.createRadialGradient(w / 2, h * 0.38, 200, w / 2, h * 0.45, h * 0.75)
  g.addColorStop(0, '#b3141e')
  g.addColorStop(0.55, '#6b0c13')
  g.addColorStop(1, '#22060a')
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = g
  ctx.fillRect(70, 70, w - 140, h - 140)
  ctx.strokeStyle = '#E91D29'
  ctx.lineWidth = 14
  ctx.strokeRect(120, 120, w - 240, h - 240)
  // schwarzes Band hinter dem Titel (wie auf dem Cover)
  ctx.fillStyle = 'rgba(10,8,8,.9)'
  ctx.fillRect(70, 560, w - 140, 520)

  const wappen = await bildLaden('/brand/wappen.png')
  if (wappen) {
    const ww = 380
    const wh = (wappen.naturalHeight / wappen.naturalWidth) * ww
    ctx.drawImage(wappen, w / 2 - ww / 2, 170, ww, wh)
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#fff'
  mittig(ctx, 'DAS OFFIZIELLE STICKERHEFT', 720, w - 400, 120, ANTON)
  ctx.fillStyle = '#E8C15A'
  mittig(ctx, `SV AGATHENBURG/DOLLERN · SAISON ${d.saison}`, 820, w - 400, 62, BODY, '800')
  ctx.fillStyle = '#fff'
  mittig(ctx, 'JETZT EINCHECKEN!', 1010, w - 300, 190, ANTON)

  // Spiel
  const datum = new Date(d.anstoss)
  const wann = `${datum.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' })} · Anstoß ${datum.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })} Uhr`
  ctx.fillStyle = '#fff'
  mittig(ctx, `SVA – ${d.gegner.toUpperCase()}`, 1250, w - 400, 120, ANTON)
  ctx.fillStyle = 'rgba(255,255,255,.85)'
  mittig(ctx, wann, 1350, w - 400, 64, BODY, '700')

  // QR auf weißer Karte
  const q = 1300
  const qx = (w - q) / 2
  const qy = 1440
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.roundRect(qx - 50, qy - 50, q + 100, q + 220, 40)
  ctx.fill()
  zeichneQr(ctx, qrMatrix(d.url), qx, qy, q, '#111')
  ctx.fillStyle = '#111'
  mittig(ctx, 'Handy-Kamera drauf → Tütchen mit Stickern!', qy + q + 110, q, 58, BODY, '800')

  // Schritte
  ctx.fillStyle = '#fff'
  mittig(ctx, '1  SCANNEN    ·    2  TÜTCHEN AUFREISSEN    ·    3  EINKLEBEN', 3010, w - 360, 70, ANTON)

  // Partner
  const py = 3080
  const ph = 300
  if (d.partner) {
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.roundRect(300, py, w - 600, ph, 30)
    ctx.fill()
    ctx.fillStyle = '#6b0c13'
    mittig(ctx, 'CHECK-IN PRÄSENTIERT VON', py + 70, w - 700, 46, BODY, '800')
    const logo = d.partner.logoUrl ? await bildLaden(d.partner.logoUrl) : null
    if (logo) {
      const maxW = w - 900
      const maxH = 170
      const s = Math.min(maxW / logo.naturalWidth, maxH / logo.naturalHeight)
      const lw = logo.naturalWidth * s
      const lh = logo.naturalHeight * s
      ctx.drawImage(logo, w / 2 - lw / 2, py + 95 + (maxH - lh) / 2, lw, lh)
    } else {
      ctx.fillStyle = '#111'
      mittig(ctx, d.partner.name, py + 220, w - 800, 110, ANTON)
    }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.85)'
    mittig(ctx, 'Kostenlos · nur für Zuschauer am Waldsportplatz', py + 120, w - 400, 60, BODY, '800')
  }
  ctx.fillStyle = 'rgba(255,255,255,.75)'
  mittig(ctx, `Gültig ab 1 Std. vor Anstoß bis kurz nach Abpfiff · 1 Check-in pro Person · ${d.url.replace(/^https?:\/\//, '').replace(/\?.*$/, '')}`, h - 150, w - 400, 42, BODY, '700')
}

export function canvasZuBlob(canvas: HTMLCanvasElement, typ: 'image/png' | 'image/jpeg', q?: number): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Export fehlgeschlagen.'))), typ, q))
}

/** Einseitiges A4-PDF mit dem Plakat als JPEG (DCTDecode). */
export async function plakatPdf(canvas: HTMLCanvasElement): Promise<Blob> {
  const jpeg = new Uint8Array(await (await canvasZuBlob(canvas, 'image/jpeg', 0.95)).arrayBuffer())
  const enc = new TextEncoder()
  const teile: Uint8Array[] = []
  const offsets: number[] = []
  let laenge = 0
  const add = (x: string | Uint8Array) => {
    const b = typeof x === 'string' ? enc.encode(x) : x
    teile.push(b)
    laenge += b.length
  }
  const obj = (n: number, body: string) => {
    offsets[n] = laenge
    add(`${n} 0 obj\n${body}\nendobj\n`)
  }
  add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>')
  offsets[4] = laenge
  add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`)
  add(jpeg)
  add('\nendstream\nendobj\n')
  const inhalt = 'q 595.28 0 0 841.89 0 0 cm /Im0 Do Q'
  obj(5, `<< /Length ${inhalt.length} >>\nstream\n${inhalt}\nendstream`)
  const xref = laenge
  let x = 'xref\n0 6\n0000000000 65535 f \n'
  for (let i = 1; i <= 5; i++) x += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  add(`${x}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(teile as BlobPart[], { type: 'application/pdf' })
}

export function herunterladen(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
