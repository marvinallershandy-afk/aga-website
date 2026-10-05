// ─────────────────────────────────────────────────────────────
// v18-P: Logo-Aufbereitung für Bande, Partner-Wand und Konfigurator.
//
// Jedes Logo wird EINMAL dekodiert und analysiert (Cache auf Modulebene,
// Schlüssel = URL), dann überall gleich dargestellt:
//   • Ränder trimmen — transparente UND einfarbige Ränder (weißes JPG):
//     der Hintergrund wird vom Rand her per Flood-Fill freigestellt, Weiß
//     IM Logo bleibt erhalten.
//   • Seitenverhältnis, Tinten-Farbe (für den Firmennamen) und der beste
//     Banden-Hintergrund (hell/dunkel) nach Kontrast.
//   • „hatSchrift": zählt Zusammenhangskomponenten — Wort-/Bildmarken mit
//     Schrift haben viele (Buchstaben), reine Bildzeichen wenige. Nur
//     Bildzeichen bekommen den Firmennamen daneben gesetzt.
// Bewusst ohne three/React → nutzbar in /partner, im Panel und in der 3D-Bande.
// ─────────────────────────────────────────────────────────────

export type Grund = 'hell' | 'dunkel' | 'rot'

export interface Logo {
  /** getrimmtes Logo, Hintergrund transparent (max. 1200 px Kante) */
  bild: HTMLCanvasElement
  /** Breite / Höhe des getrimmten Logos */
  seite: number
  /** empfohlener Untergrund nach Kontrast */
  grund: 'hell' | 'dunkel'
  /** Hauptfarbe der Logo-Tinte (für den Firmennamen daneben) */
  tinte: string
  /** enthält Schrift (dann KEIN Name daneben) */
  hatSchrift: boolean
}

export const FARBE = {
  hell: '#F4F2EF', // warmes Weiß (Designsystem)
  dunkel: '#141213',
  rot: '#E91D29',
  textHell: '#141213',
  textDunkel: '#F4F2EF',
} as const

const MAX = 1200
const cache = new Map<string, Promise<Logo>>()

function bildLaden(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Logo nicht lesbar'))
    img.src = src
  })
}

/** Logo laden + aufbereiten (gecacht pro URL). */
export function ladeLogo(url: string): Promise<Logo> {
  let p = cache.get(url)
  if (!p) {
    p = bildLaden(url).then(bereite)
    cache.set(url, p)
    p.catch(() => cache.delete(url))
  }
  return p
}

/** Bereits fertig aufbereitetes Logo (synchron) — für React-Erstrender. */
const fertig = new Map<string, Logo>()
export function logoSofort(url: string): Logo | null {
  return fertig.get(url) ?? null
}
export function ladeLogoMerken(url: string): Promise<Logo> {
  return ladeLogo(url).then((l) => {
    fertig.set(url, l)
    return l
  })
}

// ── Analyse ─────────────────────────────────────────────────
function lum(r: number, g: number, b: number) {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function kontrast(l1: number, l2: number) {
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (a + 0.05) / (b + 0.05)
}
const L_HELL = lum(0xf4, 0xf2, 0xef)
const L_DUNKEL = lum(0x14, 0x12, 0x13)

export function bereite(img: HTMLImageElement | ImageBitmap | HTMLCanvasElement): Logo {
  const w0 = 'naturalWidth' in img ? img.naturalWidth : img.width
  const h0 = 'naturalHeight' in img ? img.naturalHeight : img.height
  const k = Math.min(1, MAX / Math.max(w0, h0))
  const w = Math.max(1, Math.round(w0 * k))
  const h = Math.max(1, Math.round(h0 * k))
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h)
  const px = data.data

  // 1) Einfarbiger, deckender Rand? (weißes/farbiges JPG) → vom Rand her freistellen
  const randFarbe = deckenderRand(px, w, h)
  if (randFarbe) freistellen(px, w, h, randFarbe)

  // 2) Begrenzungsrahmen der sichtbaren Pixel
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) {
    // leeres Bild → 1×1 transparent
    x0 = 0; y0 = 0; x1 = 0; y1 = 0
  }
  ctx.putImageData(data, 0, 0)
  const tw = x1 - x0 + 1
  const th = y1 - y0 + 1
  const out = document.createElement('canvas')
  out.width = tw
  out.height = th
  out.getContext('2d')!.drawImage(cv, x0, y0, tw, th, 0, 0, tw, th)

  // 3) Tinte: Kontrast gegen hell/dunkel, Hauptfarbe
  let schlechtHell = 0, schlechtDunkel = 0, n = 0
  const farben = new Map<number, { n: number; r: number; g: number; b: number; l: number }>()
  const schritt = Math.max(1, Math.floor(Math.sqrt((tw * th) / 40000)))
  for (let y = y0; y <= y1; y += schritt) {
    for (let x = x0; x <= x1; x += schritt) {
      const i = (y * w + x) * 4
      const a = px[i + 3]
      if (a < 128) continue
      const r = px[i], g = px[i + 1], b = px[i + 2]
      const l = lum(r, g, b)
      n++
      if (kontrast(l, L_HELL) < 1.9) schlechtHell++
      if (kontrast(l, L_DUNKEL) < 1.9) schlechtDunkel++
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
      const f = farben.get(key)
      if (f) { f.n++; f.r += r; f.g += g; f.b += b }
      else farben.set(key, { n: 1, r, g, b, l })
    }
  }
  // Hell bevorzugt (so sehen echte Banden aus) — dunkel nur, wenn das Logo
  // auf Hell deutlich schlechter lesbar ist (z. B. weißes Logo).
  const grund: 'hell' | 'dunkel' = n && schlechtHell / n > 0.35 && schlechtDunkel < schlechtHell ? 'dunkel' : 'hell'
  // Hauptfarbe = häufigste Farbe mit gutem Kontrast zum gewählten Grund
  const lg = grund === 'hell' ? L_HELL : L_DUNKEL
  let best: { n: number; r: number; g: number; b: number } | null = null
  for (const f of farben.values()) {
    const l = lum(f.r / f.n, f.g / f.n, f.b / f.n)
    if (kontrast(l, lg) < 3) continue
    if (!best || f.n > best.n) best = f
  }
  const tinte = best
    ? `rgb(${Math.round(best.r / best.n)}, ${Math.round(best.g / best.n)}, ${Math.round(best.b / best.n)})`
    : grund === 'hell' ? FARBE.textHell : FARBE.textDunkel

  const logo: Logo = { bild: out, seite: tw / th, grund, tinte, hatSchrift: zaehleTeile(out) >= 6 }
  return logo
}

/** Randfarbe, falls der Rand (fast) komplett deckend und einfarbig ist. */
function deckenderRand(px: Uint8ClampedArray, w: number, h: number): [number, number, number] | null {
  let n = 0, deckend = 0, r = 0, g = 0, b = 0
  const probe = (x: number, y: number) => {
    const i = (y * w + x) * 4
    n++
    if (px[i + 3] > 245) {
      deckend++
      r += px[i]; g += px[i + 1]; b += px[i + 2]
    }
  }
  const sx = Math.max(1, Math.floor(w / 64)), sy = Math.max(1, Math.floor(h / 64))
  for (let x = 0; x < w; x += sx) { probe(x, 0); probe(x, h - 1) }
  for (let y = 0; y < h; y += sy) { probe(0, y); probe(w - 1, y) }
  if (deckend / n < 0.9) return null
  const m: [number, number, number] = [r / deckend, g / deckend, b / deckend]
  // einfarbig? Abweichung prüfen
  let ab = 0
  const pruef = (x: number, y: number) => {
    const i = (y * w + x) * 4
    if (Math.abs(px[i] - m[0]) + Math.abs(px[i + 1] - m[1]) + Math.abs(px[i + 2] - m[2]) > 60) ab++
  }
  for (let x = 0; x < w; x += sx) { pruef(x, 0); pruef(x, h - 1) }
  for (let y = 0; y < h; y += sy) { pruef(0, y); pruef(w - 1, y) }
  return ab / n < 0.12 ? m : null
}

/** Hintergrund vom Rand her transparent machen (Flood-Fill mit Toleranz, weiche Kante). */
function freistellen(px: Uint8ClampedArray, w: number, h: number, c: [number, number, number]) {
  const TOL = 48, WEICH = 90
  const dist = (i: number) => Math.abs(px[i] - c[0]) + Math.abs(px[i + 1] - c[1]) + Math.abs(px[i + 2] - c[2])
  const besucht = new Uint8Array(w * h)
  const stapel: number[] = []
  const rein = (p: number) => {
    if (!besucht[p]) {
      besucht[p] = 1
      stapel.push(p)
    }
  }
  for (let x = 0; x < w; x++) { rein(x); rein((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { rein(y * w); rein(y * w + w - 1) }
  while (stapel.length) {
    const p = stapel.pop()!
    const i = p * 4
    const d = dist(i)
    if (d > WEICH) continue
    // weiche Kante: nah am Grund → transparent, im Übergang teilweise
    const a = d <= TOL ? 0 : Math.round(((d - TOL) / (WEICH - TOL)) * px[i + 3])
    px[i + 3] = Math.min(px[i + 3], a)
    if (d > TOL) continue // Übergangspixel nicht weiter fluten
    const x = p % w, y = (p - x) / w
    if (x > 0) rein(p - 1)
    if (x < w - 1) rein(p + 1)
    if (y > 0) rein(p - w)
    if (y < h - 1) rein(p + w)
  }
}

/** Zusammenhangskomponenten (Alpha > 50 %) auf ≤ 220 px — Buchstaben zählen. */
function zaehleTeile(bild: HTMLCanvasElement): number {
  const k = Math.min(1, 220 / Math.max(bild.width, bild.height))
  const w = Math.max(1, Math.round(bild.width * k))
  const h = Math.max(1, Math.round(bild.height * k))
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bild, 0, 0, w, h)
  const a = ctx.getImageData(0, 0, w, h).data
  const lab = new Int32Array(w * h)
  let teile = 0
  const minPx = Math.max(4, Math.round((w * h) / 4000))
  const stapel: number[] = []
  for (let p = 0; p < w * h; p++) {
    if (lab[p] || a[p * 4 + 3] < 128) continue
    let groesse = 0
    lab[p] = 1
    stapel.push(p)
    while (stapel.length) {
      const q = stapel.pop()!
      groesse++
      const x = q % w, y = (q - x) / w
      const nb = [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, y > 0 ? q - w : -1, y < h - 1 ? q + w : -1]
      for (const r of nb) {
        if (r >= 0 && !lab[r] && a[r * 4 + 3] >= 128) {
          lab[r] = 1
          stapel.push(r)
        }
      }
    }
    if (groesse >= minPx) teile++
  }
  return teile
}

/** Datei (Upload) → Logo. Nur lokal im Browser; nichts verlässt das Gerät. */
export async function logoAusDatei(datei: File): Promise<{ logo: Logo; dataUrl: string }> {
  if (!/^image\/(png|jpeg|webp)$/.test(datei.type)) throw new Error('Bitte ein PNG, JPG oder WebP wählen.')
  if (datei.size > 8 * 1024 * 1024) throw new Error('Die Datei ist größer als 8 MB.')
  const url = URL.createObjectURL(datei)
  try {
    const img = await bildLaden(url)
    const logo = bereite(img)
    return { logo, dataUrl: verkleinertAlsDataUrl(logo.bild, 800) }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Getrimmtes Logo als kleines PNG (für die Sitzung, ≤ max px Kante). */
export function verkleinertAlsDataUrl(bild: HTMLCanvasElement, max: number): string {
  const k = Math.min(1, max / Math.max(bild.width, bild.height))
  const cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.round(bild.width * k))
  cv.height = Math.max(1, Math.round(bild.height * k))
  const ctx = cv.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bild, 0, 0, cv.width, cv.height)
  return cv.toDataURL('image/png')
}
