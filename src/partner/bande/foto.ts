// ─────────────────────────────────────────────────────────────
// v18-P: „So sieht's am Spieltag aus" — der Entwurf perspektivisch in ein
// echtes Spieltagsfoto vom Waldsportplatz gesetzt (picture by Nele).
// Im Foto gibt es zwischen zwei Werbebanden tatsächlich eine freie Stelle
// (Holzwand) — genau dort hängt die Vorschau.
//
// Technik: Homographie (4 Ecken) → Gitter aus Dreiecken, je Dreieck eine
// affine Abbildung mit Clip (Canvas 2D kennt keine Perspektive). Danach
// leichte Unschärfe + Licht des Fotos, damit die Tafel „im Bild" sitzt.
// ─────────────────────────────────────────────────────────────

export const FOTO = {
  gross: '/partner/spieltag-bande.webp', // 2000 × 1333
  klein: '/partner/spieltag-bande-1000.webp', // 1000 × 667
  breite: 2000,
  hoehe: 1333,
  /** freie Bandenfläche im Originalfoto (TL, TR, BR, BL), px bei 2000 Breite */
  // (Höhe links/rechts an den Nachbarbanden ausgerichtet; unten verdeckt
  // Gras die Kante — das wird aus dem Foto wieder davorgelegt)
  ecken: [
    [1200, 385],
    [1426, 358],
    [1426, 572],
    [1200, 612],
  ] as [number, number][],
  /** Seitenverhältnis der Tafel im Entwurf (B : H) */
  tafelSeite: 2.6,
  /** Bildausschnitte (bei 2000 Breite): Totale und nah an der Bande */
  ausschnitt: {
    totale: { x: 0, y: 0, w: 2000, h: 1333 },
    nah: { x: 905, y: 205, w: 820, h: 547 },
  },
} as const

export type Ausschnitt = keyof typeof FOTO.ausschnitt
export interface Rechteck {
  x: number
  y: number
  w: number
  h: number
}

type P = [number, number]

/** Homographie: Einheitsquadrat → Viereck q (TL, TR, BR, BL). */
function homographie(q: P[]): (u: number, v: number) => P {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3
  const det = dx1 * dy2 - dx2 * dy1
  const g = (dx3 * dy2 - dx2 * dy3) / det
  const h = (dx1 * dy3 - dx3 * dy1) / det
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0
  const d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0
  return (u, v) => {
    const w = g * u + h * v + 1
    return [(a * u + b * v + c) / w, (d * u + e * v + f) / w]
  }
}

/** Dreieck (s0,s1,s2) aus src nach (d0,d1,d2) — affin, mit leichter Überlappung gegen Fugen. */
function dreieck(ctx: CanvasRenderingContext2D, src: CanvasImageSource, s: P[], d: P[]) {
  const cx = (d[0][0] + d[1][0] + d[2][0]) / 3
  const cy = (d[0][1] + d[1][1] + d[2][1]) / 3
  ctx.save()
  ctx.beginPath()
  d.forEach(([x, y], i) => {
    const dx = x - cx, dy = y - cy
    const l = Math.hypot(dx, dy) || 1
    const px = x + (dx / l) * 0.6, py = y + (dy / l) * 0.6
    if (i) ctx.lineTo(px, py)
    else ctx.moveTo(px, py)
  })
  ctx.closePath()
  ctx.clip()
  const [[u0, v0], [u1, v1], [u2, v2]] = s
  const [[x0, y0], [x1, y1], [x2, y2]] = d
  const du1 = u1 - u0, dv1 = v1 - v0, du2 = u2 - u0, dv2 = v2 - v0
  const det = du1 * dv2 - du2 * dv1
  if (Math.abs(det) < 1e-9) {
    ctx.restore()
    return
  }
  const dx1 = x1 - x0, dx2 = x2 - x0, dy1 = y1 - y0, dy2 = y2 - y0
  const a = (dx1 * dv2 - dx2 * dv1) / det
  const c = (dx2 * du1 - dx1 * du2) / det
  const b = (dy1 * dv2 - dy2 * dv1) / det
  const dd = (dy2 * du1 - dy1 * du2) / det
  ctx.transform(a, b, c, dd, x0 - a * u0 - c * v0, y0 - b * u0 - dd * v0)
  ctx.drawImage(src, 0, 0)
  ctx.restore()
}

/** Quelle (Breite sw × Höhe sh) perspektivisch in das Viereck q zeichnen. */
export function zeichnePerspektive(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, q: P[], n = 10) {
  const H = homographie(q)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n, v0 = j / n, v1 = (j + 1) / n
      const s00: P = [u0 * sw, v0 * sh], s10: P = [u1 * sw, v0 * sh], s11: P = [u1 * sw, v1 * sh], s01: P = [u0 * sw, v1 * sh]
      const d00 = H(u0, v0), d10 = H(u1, v0), d11 = H(u1, v1), d01 = H(u0, v1)
      dreieck(ctx, src, [s00, s10, s11], [d00, d10, d11])
      dreieck(ctx, src, [s00, s11, s01], [d00, d11, d01])
    }
  }
}

let fotoCache: { src: string; img: Promise<HTMLImageElement> } | null = null
export function ladeFoto(gross: boolean): Promise<HTMLImageElement> {
  const src = gross ? FOTO.gross : FOTO.klein
  if (fotoCache?.src === src) return fotoCache.img
  const img = new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.decoding = 'async'
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Foto fehlt'))
    i.src = src
  })
  fotoCache = { src, img }
  return img
}

/**
 * Szene zeichnen: Foto-Ausschnitt + Tafel (bereits gezeichnetes Canvas im
 * Seitenverhältnis FOTO.tafelSeite) in Perspektive. Zielgröße = cv.width/height.
 */
export function zeichneSpieltag(cv: HTMLCanvasElement, foto: HTMLImageElement, tafel: HTMLCanvasElement | null, aus: Ausschnitt | Rechteck) {
  const ctx = cv.getContext('2d')!
  const a = typeof aus === 'string' ? FOTO.ausschnitt[aus] : aus
  const k = foto.naturalWidth / FOTO.breite // Foto-Variante (1000/2000)
  const sx = cv.width / a.w // Ausschnitt → Canvas
  ctx.save()
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(foto, a.x * k, a.y * k, a.w * k, a.h * k, 0, 0, cv.width, cv.height)
  if (tafel) {
    const q = FOTO.ecken.map(([x, y]) => [(x - a.x) * sx, (y - a.y) * sx] as P)
    const pad = Math.ceil(6 * sx)
    const bx = Math.max(0, Math.floor(Math.min(q[0][0], q[3][0])) - pad)
    const by = Math.max(0, Math.floor(Math.min(q[0][1], q[1][1])) - pad)
    const bw = Math.min(cv.width - bx, Math.ceil(Math.max(q[1][0], q[2][0])) + pad - bx)
    const bh = Math.min(cv.height - by, Math.ceil(Math.max(q[2][1], q[3][1])) + pad - by)
    if (bw > 0 && bh > 0) {
      const ql = q.map(([x, y]) => [x - bx, y - by] as P)
      // 0) Gras VOR der Bande aus dem Foto merken (steht unten davor)
      const gras = grasMaske(ctx, bx, by, bw, bh, ql)
      // 1) Tafel in eine eigene Ebene (für Unschärfe/Licht)
      const ebene = document.createElement('canvas')
      ebene.width = bw
      ebene.height = bh
      const ec = ebene.getContext('2d')!
      ec.imageSmoothingQuality = 'high'
      zeichnePerspektive(ec, tafel, tafel.width, tafel.height, ql)
      ec.globalCompositeOperation = 'source-atop'
      // Licht des Fotos: oben etwas heller, unten im Schatten der Wiese
      const gr = ec.createLinearGradient(0, ql[0][1], 0, ql[3][1])
      gr.addColorStop(0, 'rgba(255,246,225,0.10)')
      gr.addColorStop(0.6, 'rgba(0,0,0,0)')
      gr.addColorStop(1, 'rgba(20,24,8,0.26)')
      ec.fillStyle = gr
      ec.fillRect(0, 0, bw, bh)
      // warmer Abendton wie im Foto
      ec.fillStyle = 'rgba(255,214,150,0.08)'
      ec.fillRect(0, 0, bw, bh)
      // dünne Kante wie bei einer echten Bande
      ec.globalCompositeOperation = 'source-over'
      ec.strokeStyle = 'rgba(30,30,28,0.5)'
      ec.lineWidth = Math.max(1, 1.4 * sx)
      ec.beginPath()
      ql.forEach(([x, y], i) => (i ? ec.lineTo(x, y) : ec.moveTo(x, y)))
      ec.closePath()
      ec.stroke()
      // 2) unscharf einsetzen — das Foto hat dort Tiefenunschärfe (≈ 1,5 px bei 2000 px)
      ctx.filter = `blur(${Math.max(0.5, 1.5 * sx).toFixed(2)}px) saturate(0.9) contrast(0.93)`
      ctx.drawImage(ebene, bx, by)
      ctx.filter = 'none'
      // 3) Gras wieder davor
      if (gras) ctx.drawImage(gras, bx, by)
    }
  }
  ctx.restore()
}

/** Grashalme im unteren Drittel der Bandenfläche (helles Grün) als Ebene. */
function grasMaske(ctx: CanvasRenderingContext2D, bx: number, by: number, bw: number, bh: number, q: P[]): HTMLCanvasElement | null {
  let bild: ImageData
  try {
    bild = ctx.getImageData(bx, by, bw, bh)
  } catch {
    return null
  }
  const px = bild.data
  const [tl, tr, br, bl] = q
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const i = (y * bw + x) * 4
      const t = Math.min(1, Math.max(0, (x - tl[0]) / Math.max(1, tr[0] - tl[0])))
      const yo = tl[1] + (tr[1] - tl[1]) * t
      const yu = bl[1] + (br[1] - bl[1]) * t
      const v = (y - yo) / Math.max(1, yu - yo)
      const r = px[i], g = px[i + 1], b = px[i + 2]
      const gruen = Math.min(1, Math.max(0, (g - Math.max(r, b) * 1.06 - 6) / 26))
      const unten = Math.min(1, Math.max(0, (v - 0.74) / 0.14))
      px[i + 3] = Math.round(255 * gruen * unten * (g > 70 ? 1 : 0))
    }
  }
  const cv = document.createElement('canvas')
  cv.width = bw
  cv.height = bh
  cv.getContext('2d')!.putImageData(bild, 0, 0)
  return cv
}
