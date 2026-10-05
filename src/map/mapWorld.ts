// ─────────────────────────────────────────────────────────────
// v16-K: geteilter Laufzeit-Zustand zwischen Karten-Kamera (CameraRig,
// im Canvas) und der Welt bzw. dem DOM — pro Frame geschrieben, kein
// React-State (wie cameraState/teamState). three-frei.
// ─────────────────────────────────────────────────────────────

import type { PlaceId } from './places'

export const mapWorld = {
  /** 0..1: wie sehr die Kamera in der Karten-Totale steht (Tilt-Shift,
   *  Fan-Leerlauf, Marker sichtbar). */
  overview: 0,
  /** Fans bewegen sich in der Totale ruhig weiter (ohne Rauch/Fackeln). */
  fansIdle: 0,
  /** Stärke des Tilt-Shift-Randes 0..1. */
  tilt: 0,
  /** Warmer Schleier beim Verlassen des Partyraums (Schnitt) 0..1. */
  veil: 0,
  /** true, sobald die Live-3D-Karte mindestens einmal in der Totale
   *  gerendert hat (Poster darf ausblenden, Marker folgen der Projektion). */
  live: false,
  /** DEV/Poster: kein Atmen der Totale (exaktes Standbild). */
  still: false,
}

/** Projektion der Marker-Anker, pro Frame vom Projektor geschrieben. */
export interface MarkerSlot {
  el: HTMLElement | null
  x: number
  y: number
  visible: boolean
}
export const markerSlots = new Map<PlaceId, MarkerSlot>()

export function registerMarker(id: PlaceId, el: HTMLElement | null) {
  const s = markerSlots.get(id)
  if (s) s.el = el
  else markerSlots.set(id, { el, x: 0, y: 0, visible: false })
}

/** Ebene, die die Marker trägt (Klasse is-live, Sichtbarkeit). */
export const markerLayer: { el: HTMLElement | null } = { el: null }
