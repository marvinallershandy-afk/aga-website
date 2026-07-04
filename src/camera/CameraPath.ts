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

// Station i wird bei Scroll-Fraction i/(n-1) erreicht.
const STATIONS: Station[] = [
  // 0 · VEREIN — hohe, leicht gekippte Establishing-Shot über dem Anstoßkreis
  { pos: new THREE.Vector3(3.5, 12.5, 13), look: new THREE.Vector3(0, 0.4, 0) },
  // 1 · MANNSCHAFT — tief, dynamisch, seitlich übers Mittelfeld gleitend
  { pos: new THREE.Vector3(-7.5, 2.6, 6.5), look: new THREE.Vector3(0.5, 1.0, -0.5) },
  // 2 · TABELLE — Schwenk zur Vereinsheim-Seite, mittlere Höhe
  { pos: new THREE.Vector3(8.5, 4.2, 7.5), look: new THREE.Vector3(7.6, 1.1, 0) },
  // 3 · KONTAKT — weiter Beauty-Shot in der Abenddämmerung, Rückzug
  { pos: new THREE.Vector3(0, 6.5, 15.5), look: new THREE.Vector3(0, 1.4, 0) },
]

export const STATION_COUNT = STATIONS.length

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

// Scroll-Fraction, bei der jede Sektion mittig steht (DOM-Zentren).
// Damit rasten die Kamera-Stationen genau dann ein, wenn die
// zugehörige Sektion im Blick ist — statt linear daneben.
const ANCHORS = [0.15, 0.5, 0.83, 1.0]

/** Bildet den Scroll-Fortschritt auf den Kurven-Parameter u∈[0,1] ab. */
export function scrollToU(p: number): number {
  const n = ANCHORS.length
  if (p <= ANCHORS[0]) return 0
  for (let i = 1; i < n; i++) {
    if (p <= ANCHORS[i]) {
      const seg = (p - ANCHORS[i - 1]) / (ANCHORS[i] - ANCHORS[i - 1])
      return (i - 1 + seg) / (n - 1)
    }
  }
  return 1
}

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
