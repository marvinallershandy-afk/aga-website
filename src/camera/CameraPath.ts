import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────
// Die geführte Kamerafahrt (Signature-Moment).
// Eine glatte Catmull-Rom-Kurve, abgetastet über den Scroll-
// Fortschritt 0..1. Vier Stationen = vier Sektionen. Zwischen
// den Stationen gleitet die Kamera cinematisch über den Platz.
// centripetal → kein Overshoot / Schlaufen.
// ─────────────────────────────────────────────────────────────

export interface Station {
  pos: THREE.Vector3
  look: THREE.Vector3
}

const STATIONS: Station[] = [
  // 0 · VEREIN — hohe, leicht gekippte Establishing-Shot über dem Anstoßkreis
  { pos: new THREE.Vector3(3.5, 12.5, 13), look: new THREE.Vector3(0, 0.4, 0) },
  // 1 · ANSTOSS (Signature-Beat, keine eigene Sektion) — Sturzflug auf
  //     Rasenhöhe hinter den Anstoßkreis, Blick über den Ball
  { pos: new THREE.Vector3(0.35, 0.26, 2.75), look: new THREE.Vector3(-4.2, 1.15, -3.6) },
  // 2 · MANNSCHAFT — tief, dynamisch, seitlich übers Mittelfeld gleitend
  { pos: new THREE.Vector3(-7.5, 2.6, 6.5), look: new THREE.Vector3(0.5, 1.0, -0.5) },
  // 3 · MUSIK — die Klinker-Hütte NW wird zur Musik-Ecke (Boombox)
  { pos: new THREE.Vector3(-1.6, 0.9, -1.2), look: new THREE.Vector3(-4.7, 0.35, -4.5) },
  // 4 · TABELLE — Schwenk zum echten Vereinsheim hinter dem Ost-Tor
  { pos: new THREE.Vector3(4.0, 0.85, 3.1), look: new THREE.Vector3(7.15, 0.32, -0.5) },
  // 4 · KONTAKT/FINALE — Schwenk in die Fanblock-Ecke SW:
  //     Banner + Figuren nah, der beleuchtete Platz im Hintergrund
  { pos: new THREE.Vector3(-5.7, 1.35, 1.35), look: new THREE.Vector3(-3.3, 0.28, 4.7) },
]

export const STATION_COUNT = STATIONS.length

// ─── Anstoß-Dramaturgie ──────────────────────────────────────
// Geteilter Fahrt-Zustand (pro Frame von CameraRig geschrieben,
// von Flutlicht/Ball/Staub gelesen — kein React-State).
export const cameraState = { u: 0 }

// Kurven-Parameter der Anstoß-Station
const KICKOFF_U = 1 / (STATIONS.length - 1) // 0.25

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

const posCurve = new THREE.CatmullRomCurve3(
  STATIONS.map((s) => s.pos),
  false,
  'centripetal',
  0.5,
)
const lookCurve = new THREE.CatmullRomCurve3(
  STATIONS.map((s) => s.look),
  false,
  'centripetal',
  0.5,
)

// Anker/Remap leben three-frei in ./anchors (Fallback-Ladepfad!)
export { setAnchors, scrollToU } from './anchors'

// Reusable scratch vectors (keine Allokation im Frame-Loop)
const _pos = new THREE.Vector3()
const _look = new THREE.Vector3()

/** Sample die Fahrt bei t∈[0,1]. Schreibt in die übergebenen Vektoren. */
export function sampleFlight(t: number, outPos: THREE.Vector3, outLook: THREE.Vector3) {
  const c = THREE.MathUtils.clamp(t, 0, 1)
  posCurve.getPoint(c, _pos)
  lookCurve.getPoint(c, _look)
  outPos.copy(_pos)
  outLook.copy(_look)
}

// Statischer Hero-Frame für den WebGL-/reduced-motion-Fallback
export const HERO_FRAME: Station = STATIONS[0]
