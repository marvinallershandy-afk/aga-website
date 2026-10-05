import * as THREE from 'three'
import type { Player, Staff } from '../data/players'
import {
  CARD_RATIO,
  drawPlayerCard,
  drawStaffCard,
  loadCardAssets,
  type CardAssets,
} from '../ui/cardArt'

// ─────────────────────────────────────────────────────────────
// v14-D „Karten 2.0" als 3D-Textur. Dasselbe Design wie die DOM-
// HoloCard und der Story-Export (gemeinsamer Renderer ui/cardArt.ts):
// Freisteller in Farbe (das alte Rot-Multiply ist entfallen). v15-P:
// der Kopf bleibt IM Kartenrahmen → kein transparenter Pop-Bereich mehr,
// die Textur ist exakt die Karte. Auflösung pro Kartengröße wählbar
// (Nahsicht im Flyover), Texturen werden pro Person + Auflösung gecacht.
// ─────────────────────────────────────────────────────────────

/** Seitenverhältnis der Textur (Höhe / Breite) = Kartenformat. */
export const CARD_TEX_ASPECT = CARD_RATIO

export interface CardTex {
  texture: THREE.CanvasTexture
}

const cache = new Map<string, CardTex>()

function makeCanvas(width: number) {
  const cv = document.createElement('canvas')
  cv.width = width
  cv.height = Math.round(width * CARD_TEX_ASPECT)
  return cv
}

function makeTexture(cv: HTMLCanvasElement, anisotropy: number) {
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = anisotropy
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  return tex
}

function paint(
  cv: HTMLCanvasElement,
  tex: THREE.CanvasTexture,
  draw: (ctx: CanvasRenderingContext2D, assets: CardAssets) => void,
  assets: CardAssets,
) {
  const ctx = cv.getContext('2d')!
  ctx.clearRect(0, 0, cv.width, cv.height)
  draw(ctx, assets)
  tex.needsUpdate = true
}

const EMPTY: CardAssets = { figure: null, crest: null, wappen: null }

/** Spielerkarte als Textur. width = Texturbreite in Pixeln. */
export function makePlayerCardTexture(player: Player, width = 640, anisotropy = 8): CardTex {
  const key = `p:${player.id}:${width}`
  const hit = cache.get(key)
  if (hit) return hit
  const cv = makeCanvas(width)
  const tex = makeTexture(cv, anisotropy)
  const draw = (ctx: CanvasRenderingContext2D, a: CardAssets) =>
    drawPlayerCard(ctx, 0, 0, width, player, a)
  // Sofort ein Grundbild (Name/Nummer), dann mit Foto + Schriften final.
  paint(cv, tex, draw, EMPTY)
  void loadCardAssets(player.cutoutUrl ?? player.photoUrl).then((a) => paint(cv, tex, draw, a))
  const out = { texture: tex }
  cache.set(key, out)
  return out
}

/** Trainerstab-Karte als Textur. */
export function makeStaffCardTexture(member: Staff, width = 384, anisotropy = 8): CardTex {
  const key = `s:${member.id}:${width}`
  const hit = cache.get(key)
  if (hit) return hit
  const cv = makeCanvas(width)
  const tex = makeTexture(cv, anisotropy)
  const draw = (ctx: CanvasRenderingContext2D, a: CardAssets) =>
    drawStaffCard(ctx, 0, 0, width, member, a)
  paint(cv, tex, draw, EMPTY)
  void loadCardAssets(member.cutoutUrl ?? member.photoUrl).then((a) => paint(cv, tex, draw, a))
  const out = { texture: tex }
  cache.set(key, out)
  return out
}
