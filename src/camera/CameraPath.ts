import * as THREE from 'three'
import { cameraState, KICKOFF_U } from './rigState'

// ─────────────────────────────────────────────────────────────
// Anstoß-Dramaturgie (Flutlicht, Ball) als pure Funktionen des
// Welt-Parameters u. Die Kamerafahrt selbst: ./tourRoute (v18-R).
// ─────────────────────────────────────────────────────────────

export interface Station {
  pos: THREE.Vector3
  look: THREE.Vector3
}

// v18-R: Die Route selbst lebt in ./tourRoute (Halte in Geh-Reihenfolge,
// Catmull-Rom + Blick-Slerp). Hier bleiben die Anstoß-Dramaturgie und das
// klassische 8er-Raster des Welt-Parameters u (FAN_U = 3/7 usw.), das die
// Welt-Effekte lesen.
export const STATION_COUNT = 8

// ─── Anstoß-Dramaturgie ──────────────────────────────────────
// Geteilter Fahrt-Zustand (pro Frame von CameraRig geschrieben,
// von Flutlicht/Ball/Staub gelesen — kein React-State).
// v16-K: cameraState/KICKOFF_U leben three-frei in ./rigState (DOM-Pfad).
export { cameraState, KICKOFF_U }
if (import.meta.env.DEV && KICKOFF_U !== 1 / (STATION_COUNT - 1)) {
  console.warn('[SVA] KICKOFF_U passt nicht mehr zur Stationszahl')
}

/** Anstoß-Phase 0..1 (rein aus u abgeleitet → scroll-reversibel). */
export function kickoffPhase(u: number): number {
  return THREE.MathUtils.clamp((u - 0.07) / (KICKOFF_U - 0.07), 0, 1)
}

/** Flutlicht-Level je Mast: Dämmer-Glimmen → sequenzielles Aufflackern. */
export function floodLevelAt(u: number, i: number): number {
  const k = kickoffPhase(u)
  const t = 0.1 + i * 0.19          // 4 Beats, Mast für Mast
  const s = THREE.MathUtils.clamp((k - t) / 0.16, 0, 1)
  if (s <= 0) return 0.42           // Dämmerung: Lampen glimmen
  if (s >= 1) return 1
  // deterministisches Flackern (pure Funktion von k → rückwärts identisch)
  const n = Math.sin(s * 47 + i * 13.7) * Math.sin(s * 89 + i * 5.3)
  const on = n > -0.35 ? 1 : 0.12
  return 0.42 + 0.58 * s * on
}

/** Ball-Roll-Fortschritt 0..1 (rollt beim Anstoß an der Kamera vorbei). */
export function ballRollAt(u: number): number {
  return THREE.MathUtils.clamp((u - KICKOFF_U + 0.02) / 0.1, 0, 1)
}

/** Aufglüh-Surge je Mast: Glockenkurve über das Flacker-Fenster —
 *  die Lampenfläche selbst blitzt auf (Emissive-Puls), BEVOR die
 *  Rasen-Lache voll da ist. Pure Funktion von u → reversibel. */
export function floodSurgeAt(u: number, i: number): number {
  const k = kickoffPhase(u)
  const t = 0.1 + i * 0.19
  const s = THREE.MathUtils.clamp((k - t) / 0.16, 0, 1)
  if (s <= 0 || s >= 1) return 0
  return Math.sin(s * Math.PI)
}


// Statischer Hero-Frame für den WebGL-/reduced-motion-Fallback und die
// Start-Kamera der Bühne (= erster Halt der Route).
export const HERO_FRAME: Station = {
  pos: new THREE.Vector3(4.2, 7.0, 15.2),
  look: new THREE.Vector3(0, 0.5, 0.6),
}
