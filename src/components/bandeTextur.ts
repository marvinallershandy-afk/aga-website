// ─────────────────────────────────────────────────────────────
// v18-P: Texturen der 3D-Süd-Bande — EINE Tafel = EINE CanvasTexture.
// Alles auf Modulebene gecacht (nicht in useMemo): Logos werden einmal
// geladen/getrimmt (logo.ts), jede Tafel einmal gezeichnet. Ändert sich der
// Entwurf aus dem Konfigurator, wird NUR die freie Tafel neu gezeichnet und
// hochgeladen (≈ 1,6 MB statt der früheren 8192er-Gesamttextur je Tastendruck).
//
// Auflösung: 256 px Höhe auf 0,24 m Bande ≈ 1 070 px/m, Breite exakt nach
// Tafel-Seitenverhältnis (keine gestreckte Schrift). Mipmaps + Anisotropie →
// scharf auch im flachen Blickwinkel der Rundgang-Station.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three'
import { BANDE_PANELE, BANDE_SLOTS, BANDE_SPONSOREN, FREIER_SLOT } from '../data/bandeLayout'
import { ladeLogo } from '../partner/bande/logo'
import { BANDE_3D, schriftenBereit, zeichneCta, zeichneLeer, zeichneTafel, zeichneVerein } from '../partner/bande/tafel'
import { entwurf, entwurfAktiv, type EntwurfZustand } from '../partner/bande/entwurf'

export const BANDE_W = 10.5 * 0.86 // = PITCH.width * 0.86 (Barrier/CameraRig)
export const BANDE_H = 0.24
export const TAFEL_FUGE = 0.012 // m — Fuge zwischen zwei Tafeln
const H_PX = 256

export type TafelArt = 'verein' | 'sponsor' | 'leer' | 'cta'
export interface Tafel {
  art: TafelArt
  /** Slot-Index (nur sponsor/leer) */
  slot: number
  canvas: HTMLCanvasElement
  tex: THREE.CanvasTexture
}

let tafeln: Tafel[] | null = null
let wappen: HTMLImageElement | null = null
let entwurfStand = -1

function neueTafel(art: TafelArt, slot: number): Tafel {
  const pw = BANDE_W / BANDE_PANELE - TAFEL_FUGE
  const cv = document.createElement('canvas')
  cv.height = H_PX
  cv.width = Math.round(H_PX * (pw / BANDE_H))
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8 // three begrenzt auf das Geräte-Maximum
  return { art, slot, canvas: cv, tex }
}

function zeichne(t: Tafel) {
  const ctx = t.canvas.getContext('2d')!
  const { width: w, height: h } = t.canvas
  ctx.clearRect(0, 0, w, h)
  if (t.art === 'verein') zeichneVerein(ctx, 0, 0, w, h, wappen)
  else if (t.art === 'cta') zeichneCta(ctx, 0, 0, w, h)
  else if (t.art === 'leer') {
    const e = entwurf()
    if (t.slot === FREIER_SLOT && entwurfAktiv(e)) zeichneEntwurf(ctx, w, h, e)
    else zeichneLeer(ctx, 0, 0, w, h, t.slot)
  } else {
    const s = BANDE_SPONSOREN[t.slot]
    // Sofort: Name auf hellem Grund; das Logo ersetzt ihn, sobald geladen.
    zeichneTafel(ctx, 0, 0, w, h, { name: s.name }, BANDE_3D)
    if (s.logoUrl) {
      ladeLogo(s.logoUrl)
        .then((logo) => {
          zeichneTafel(ctx, 0, 0, w, h, { name: s.name, logo }, BANDE_3D)
          t.tex.needsUpdate = true
        })
        .catch(() => {})
    }
  }
  t.tex.needsUpdate = true
}

function zeichneEntwurf(ctx: CanvasRenderingContext2D, w: number, h: number, e: EntwurfZustand) {
  zeichneTafel(ctx, 0, 0, w, h, { name: e.name, zeile2: e.zeile2, logo: e.logo, grund: e.grund }, BANDE_3D)
}

/** Alle Tafeln (einmalig erzeugt, danach aus dem Cache). */
export function bandeTafeln(): Tafel[] {
  if (tafeln) return tafeln
  const liste: Tafel[] = [neueTafel('verein', -1)]
  for (let i = 0; i < BANDE_SLOTS; i++) liste.push(neueTafel(i < BANDE_SPONSOREN.length ? 'sponsor' : 'leer', i))
  liste.push(neueTafel('cta', -1))
  tafeln = liste
  // dunkle Grundfläche sofort, Text erst mit geladenen Schriften
  for (const t of liste) {
    const ctx = t.canvas.getContext('2d')!
    ctx.fillStyle = '#141213'
    ctx.fillRect(0, 0, t.canvas.width, t.canvas.height)
  }
  schriftenBereit().then(() => {
    liste.forEach(zeichne)
    entwurfStand = entwurf().version
  })
  const img = new Image()
  img.onload = () => {
    wappen = img
    const v = liste[0]
    schriftenBereit().then(() => zeichne(v))
  }
  img.src = '/brand/wappen-180.png'
  return liste
}

/** Entwurf geändert → nur die freie Tafel neu zeichnen. */
export function entwurfAufBande() {
  if (!tafeln) return
  const e = entwurf()
  if (e.version === entwurfStand) return
  entwurfStand = e.version
  const t = tafeln.find((x) => x.art === 'leer' && x.slot === FREIER_SLOT)
  if (t) schriftenBereit().then(() => zeichne(t))
}
