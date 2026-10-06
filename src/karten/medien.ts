// ─────────────────────────────────────────────────────────────
// v20-K: Medien-Caches des Kartensystems (Modul-Ebene, einmal je URL):
//  · Freisteller-Messung (Scheitel-Lage, damit jeder Kopf gleich sitzt)
//  · Bild-Laden für Canvas (Export, 3D-Textur)
//  · Schriften für Canvas
//  · HEVC-Alpha-Erkennung für lebende Karten
// ─────────────────────────────────────────────────────────────
import { FIGUR_KONVENTION } from './geometrie'

export interface FigurMass {
  /** Oberkante des Motivs (Alpha) als Anteil der Bildhöhe */
  kopf: number
  /** Höhe / Breite */
  ratio: number
}
const massCache = new Map<string, FigurMass>()

/** Misst die erste deckende Zeile (64-px-Probe). Fremde Origin ohne CORS → Konvention. */
export function figurMessen(img: HTMLImageElement): FigurMass {
  const key = img.currentSrc || img.src
  const hit = massCache.get(key)
  if (hit) return hit
  const ratio = img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : FIGUR_KONVENTION.ratio
  let kopf: number = FIGUR_KONVENTION.kopf
  try {
    const w = 64
    const h = Math.max(8, Math.round(w * ratio))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const x = c.getContext('2d', { willReadFrequently: true })!
    x.drawImage(img, 0, 0, w, h)
    const d = x.getImageData(0, 0, w, h).data
    zeilen: for (let yy = 0; yy < h; yy++) {
      let n = 0
      for (let xx = 0; xx < w; xx++) {
        if (d[(yy * w + xx) * 4 + 3] > 90 && ++n >= 2) {
          kopf = yy / h
          break zeilen
        }
      }
    }
  } catch {
    /* tainted → Konvention */
  }
  const m = { kopf, ratio }
  massCache.set(key, m)
  return m
}
export function figurMassBekannt(url: string): FigurMass | null {
  try {
    return massCache.get(new URL(url, window.location.href).href) ?? null
  } catch {
    return null
  }
}

const bildCache = new Map<string, Promise<HTMLImageElement | null>>()
export function ladeBild(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  let p = bildCache.get(url)
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image()
      img.decoding = 'async'
      if (/^https?:/.test(url) && !url.startsWith(window.location.origin)) img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })
    bildCache.set(url, p)
  }
  return p
}

let schriften: Promise<void> | null = null
export function ladeSchriften(): Promise<void> {
  if (!schriften) {
    schriften = (async () => {
      try {
        await Promise.all([
          document.fonts.load('40px Anton'),
          document.fonts.load('700 40px "Archivo Variable"'),
          document.fonts.load('800 40px "Archivo Variable"'),
          document.fonts.load('500 40px "Archivo Variable"'),
        ])
      } catch {
        /* Systemschrift genügt */
      }
    })()
  }
  return schriften
}

let hevc: boolean | null = null
/** WebKit (Safari, alle iOS-Browser) kann HEVC mit Alpha, aber kein VP9-Alpha. */
export function hevcZuerst(): boolean {
  if (hevc != null) return hevc
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const safari = /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(ua)
  hevc = ios || safari
  return hevc
}

export const ruhigeBewegung = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Haptik (Android/Chrome; iOS ignoriert vibrate still). */
export function vibriere(muster: number | number[]) {
  try {
    if (ruhigeBewegung()) return
    navigator.vibrate?.(muster)
  } catch {
    /* egal */
  }
}
