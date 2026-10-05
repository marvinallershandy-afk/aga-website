// ─────────────────────────────────────────────────────────────
// v14-C: Bilder im Browser zuschneiden und verkleinern — BEVOR sie hochgeladen
// werden. Handyfotos (4–12 MB, 4000 px) werden so zu ~100–250 KB WebP.
// Kein Server, keine Zusatz-Bibliothek: Canvas reicht.
// ─────────────────────────────────────────────────────────────

/** Spielerfotos der Website: 800 × 1200 (2:3), wie public/players/*.webp. */
export const PLAYER_PHOTO = { width: 800, height: 1200 } as const
export const LOGO_MAX = { width: 800, height: 400 } as const

export interface CropState {
  /** Zoom ≥ 1 (1 = Bild füllt den Rahmen gerade so). */
  zoom: number
  /** Versatz in Anteilen des möglichen Spielraums, −1 … 1 (0 = mittig). */
  x: number
  y: number
}
export const CROP_DEFAULT: CropState = { zoom: 1, x: 0, y: -0.4 } // Gesichter sitzen meist oben

export async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return img
  } finally {
    // erst nach decode freigeben (Bild ist dann im Speicher)
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

/** Ausschnitt (in Quellpixeln) für Rahmen-Seitenverhältnis + Zoom + Versatz. */
export function cropRect(imgW: number, imgH: number, aspect: number, c: CropState) {
  // größter Ausschnitt mit dem Ziel-Seitenverhältnis, der ins Bild passt
  let w = imgW
  let h = w / aspect
  if (h > imgH) {
    h = imgH
    w = h * aspect
  }
  w /= c.zoom
  h /= c.zoom
  const maxX = (imgW - w) / 2
  const maxY = (imgH - h) / 2
  const cx = imgW / 2 + c.x * maxX
  const cy = imgH / 2 + c.y * maxY
  return { sx: cx - w / 2, sy: cy - h / 2, sw: w, sh: h }
}

async function canvasToBlob(canvas: HTMLCanvasElement, preferAlpha: boolean): Promise<Blob> {
  const toBlob = (type: string, q?: number) =>
    new Promise<Blob | null>((res) => canvas.toBlob(res, type, q))
  // WebP bevorzugt; ältere Safari-Versionen liefern dann PNG zurück → Fallback.
  const webp = await toBlob('image/webp', 0.84)
  if (webp && webp.type === 'image/webp') return webp
  const fb = preferAlpha ? await toBlob('image/png') : await toBlob('image/jpeg', 0.86)
  if (!fb) throw new Error('Bild konnte nicht umgewandelt werden.')
  return fb
}

/** Spielerfoto: auf 2:3 zuschneiden, 800 × 1200 rendern, als WebP/JPEG. */
export async function renderPlayerPhoto(img: HTMLImageElement, c: CropState): Promise<Blob> {
  const { width, height } = PLAYER_PHOTO
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nicht verfügbar.')
  ctx.imageSmoothingQuality = 'high'
  const r = cropRect(img.naturalWidth, img.naturalHeight, width / height, c)
  ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, width, height)
  return canvasToBlob(canvas, false)
}

/** Logo: nicht beschneiden, nur auf max. 800 × 400 verkleinern; Transparenz bleibt. */
export async function renderLogo(img: HTMLImageElement): Promise<Blob> {
  const scale = Math.min(1, LOGO_MAX.width / img.naturalWidth, LOGO_MAX.height / img.naturalHeight)
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nicht verfügbar.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  return canvasToBlob(canvas, true)
}

/**
 * v15-T: Screenshot für die Tabellen-Erkennung. Lange Kante ≤ `maxSide`,
 * kein Zuschnitt. Sehr lange Bilder (Scroll-Screenshots) werden in bis zu
 * `maxTeile` überlappende Abschnitte zerlegt — sonst würde die Schrift beim
 * Verkleinern unlesbar. WebP mit hoher Qualität, damit Ziffern scharf bleiben.
 */
export async function renderScreenshot(img: HTMLImageElement, maxSide = 2000, maxTeile = 3): Promise<Blob[]> {
  const W = img.naturalWidth
  const H = img.naturalHeight
  const ratio = H / W
  // Ab ~2,4 : 1 (länger als ein normaler Handy-Screenshot) in Abschnitte teilen.
  const teile = ratio > 2.4 ? Math.min(maxTeile, Math.ceil(ratio / 1.8)) : 1
  const ueberlapp = teile > 1 ? Math.round(H * 0.06) : 0
  const teilH = Math.ceil((H + ueberlapp * (teile - 1)) / teile)
  const out: Blob[] = []
  for (let i = 0; i < teile; i++) {
    const sy = Math.max(0, Math.min(H - teilH, i * (teilH - ueberlapp)))
    const sh = Math.min(teilH, H - sy)
    const scale = Math.min(1, maxSide / Math.max(W, sh))
    const w = Math.max(1, Math.round(W * scale))
    const h = Math.max(1, Math.round(sh * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas nicht verfügbar.')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, sy, W, sh, 0, 0, w, h)
    const toBlob = (type: string, q?: number) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, q))
    let blob = await toBlob('image/webp', 0.92)
    if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', 0.92)
    if (!blob) throw new Error('Bild konnte nicht umgewandelt werden.')
    out.push(blob)
  }
  return out
}

export const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp,image/heic,image/heif'

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
