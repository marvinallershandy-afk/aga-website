import * as THREE from 'three'
import type { Player, Staff } from '../data/players'
import { KARTE_RATIO } from '../karten/geometrie'
import { ladeKartenAssets, zeichneKarte, type KartenAssets } from '../karten/zeichnen'
import { vonSpieler, vonStab } from '../karten/adapter'
import { playerMedia } from '../data/playerMedia'
import type { KartenDaten } from '../karten/typen'

// ─────────────────────────────────────────────────────────────
// v20-K: 3D-Kartentextur im Rundgang = die gemeinsame Sammelkarte
// (src/karten/zeichnen.ts), also dasselbe Design wie Album, Galerie und
// Story. Schild-Form per Alpha (Material: transparent + alphaTest).
// Freisteller in 640er-Auflösung (Textur ≤ 640 px breit). Texturen pro
// Person + Auflösung gecacht; das endgültige Zeichnen läuft in Leerlauf-
// Zeit (requestIdleCallback, je Karte ein Slot) → kein Ruckler beim
// Laden, wenn 30 Karten gleichzeitig fertig werden.
// ─────────────────────────────────────────────────────────────

/** Seitenverhältnis der Textur (Höhe / Breite) = Kartenformat. */
export const CARD_TEX_ASPECT = KARTE_RATIO

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

const leer: KartenAssets = { figur: null, foto: null, logo: null, wappen: null, praegung: null, guilloche: null, buerstung: null, rauten: null, funkeln: null }

// Leerlauf-Warteschlange: eine Karte pro Slot
const schlange: (() => void)[] = []
let laeuft = false
function inLeerlauf(fn: () => void) {
  schlange.push(fn)
  if (laeuft) return
  laeuft = true
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  const naechste = () => {
    const f = schlange.shift()
    if (!f) {
      laeuft = false
      return
    }
    f()
    if (ric) ric(naechste, { timeout: 400 })
    else setTimeout(naechste, 16)
  }
  if (ric) ric(naechste, { timeout: 400 })
  else setTimeout(naechste, 16)
}

function textur(key: string, d: KartenDaten, width: number, anisotropy: number): CardTex {
  const hit = cache.get(key)
  if (hit) return hit
  const cv = makeCanvas(width)
  const tex = makeTexture(cv, anisotropy)
  const malen = (a: KartenAssets) => {
    const ctx = cv.getContext('2d')!
    ctx.clearRect(0, 0, cv.width, cv.height)
    zeichneKarte(ctx, d, a, 0, 0, width, { zeit: 3 })
    tex.needsUpdate = true
  }
  // Sofort ein Grundbild (Material + Name), dann mit Bild + Schriften final.
  malen(leer)
  void ladeKartenAssets(d).then((a) => inLeerlauf(() => malen(a)))
  const out = { texture: tex }
  cache.set(key, out)
  return out
}

/** Spielerkarte als Textur. width = Texturbreite in Pixeln. */
export function makePlayerCardTexture(player: Player, width = 640, anisotropy = 8): CardTex {
  // 640er-Freisteller genügt für ≤ 640 px Textur (spart Dekodieren)
  const d = vonSpieler(player, { figur: playerMedia(player.id, player).figure, loop: null })
  return textur(`p:${player.id}:${width}`, d, width, anisotropy)
}

/** Trainerstab-Karte als Textur. */
export function makeStaffCardTexture(member: Staff, width = 384, anisotropy = 8): CardTex {
  const d = vonStab(member, { figur: playerMedia(member.id, member).figure, loop: null })
  return textur(`s:${member.id}:${width}`, d, width, anisotropy)
}
