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
  // 0 · VEREIN — Establishing. v6-E1: Startwinkel deutlich gesenkt
  //     (y 12.5 → 7.0), schräger/immersiver statt Vogelperspektive —
  //     nimmt den „Tischmodell"-Eindruck (Marvin) und verkürzt zugleich
  //     das überlange erste Bein (Tempo-Spitze beim Swoop).
  { pos: new THREE.Vector3(4.2, 7.0, 15.2), look: new THREE.Vector3(0, 0.5, 0.6) },
  // 1 · ANSTOSS (Signature-Beat, keine eigene Sektion) — Sturzflug hinter
  //     den Anstoßkreis, endet kontrolliert ÜBER dem Rasen (v5-Review:
  //     nicht mehr „im Gras"), Blick über den Ball
  { pos: new THREE.Vector3(0.35, 0.5, 2.75), look: new THREE.Vector3(-4.2, 1.15, -3.6) },
  // 2 · MANNSCHAFT — tief, dynamisch, seitlich übers Mittelfeld gleitend
  { pos: new THREE.Vector3(-7.5, 2.6, 6.5), look: new THREE.Vector3(0.5, 1.0, -0.5) },
  // 3 · MUSIK — Anflug aufs Vereinsheim: die Kamera schwenkt zur Tür,
  //     dann schneidet der PartyDirector in den Partyraum (Dip-to-Black)
  { pos: new THREE.Vector3(4.6, 0.9, 1.5), look: new THREE.Vector3(7.1, 0.5, -0.35) },
  // 4 · TABELLE — Schwenk zum echten Vereinsheim hinter dem Ost-Tor
  { pos: new THREE.Vector3(4.0, 0.95, 3.1), look: new THREE.Vector3(7.15, 0.32, -0.5) },
  // 5 · KONTAKT/FINALE — Schwenk in die Fanblock-Ecke SO (v5-Review:
  //     richtige Seite, aber Tor-Ende am Vereinsheim): das AGA-URKNALL-
  //     Banner lesbar in der rechten Bildhälfte (DOM lebt links),
  //     dahinter Ost-Tor und Ballfangzaun
  { pos: new THREE.Vector3(2.2, 0.95, 0.9), look: new THREE.Vector3(4.5, 0.4, 3.2) },
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

// ─── Bogenlängen-Korrektur pro Segment (v6-E1) ───────────────
// Problem: getPoint(u) tastet die Catmull-Rom PARAMETRISCH ab —
// die Kamera beschleunigt durch die Kontrollpunkte („zerrt"). Fix:
// für jedes Stations-Segment eine Bogenlängen-Tabelle; gleicher
// Scroll-Delta → gleiche Weltdistanz. Die STATIONEN bleiben exakt
// gepinnt (Segmentgrenzen unverändert) → Beat-Timing & Content-
// Alignment (Anstoß, Partyraum-Hop) bleiben unberührt.
const SEG_COUNT = STATIONS.length - 1
const SAMPLES_PER_SEG = 28
const segArc: Float32Array[] = []
{
  const p = new THREE.Vector3()
  const prev = new THREE.Vector3()
  for (let s = 0; s < SEG_COUNT; s++) {
    const cum = new Float32Array(SAMPLES_PER_SEG + 1)
    posCurve.getPoint(s / SEG_COUNT, prev)
    let total = 0
    for (let k = 1; k <= SAMPLES_PER_SEG; k++) {
      posCurve.getPoint((s + k / SAMPLES_PER_SEG) / SEG_COUNT, p)
      total += p.distanceTo(prev)
      cum[k] = total
      prev.copy(p)
    }
    const inv = total || 1
    for (let k = 0; k <= SAMPLES_PER_SEG; k++) cum[k] /= inv
    segArc.push(cum)
  }
}

/** Bogenanteil a∈[0,1] eines Segments → parametrischer localT. */
function arcToParam(seg: number, a: number): number {
  const cum = segArc[seg]
  for (let k = 0; k < SAMPLES_PER_SEG; k++) {
    if (a <= cum[k + 1]) {
      const span = cum[k + 1] - cum[k] || 1
      return (k + (a - cum[k]) / span) / SAMPLES_PER_SEG
    }
  }
  return 1
}

/** u (scroll-linear, Stationen gepinnt) → bogenlängen-korrigiertes u. */
function arcLengthU(u: number): number {
  const c = THREE.MathUtils.clamp(u, 0, 1)
  const seg = Math.min(SEG_COUNT - 1, Math.floor(c * SEG_COUNT))
  const localA = c * SEG_COUNT - seg
  return (seg + arcToParam(seg, localA)) / SEG_COUNT
}

// Anker/Remap leben three-frei in ./anchors (Fallback-Ladepfad!)
export { setAnchors, scrollToU } from './anchors'

// ─── Mindest-Kamerahöhe (v5-Review) ──────────────────────────
// Die Fahrt darf nie „in den Rasen" — harte Untergrenze über der
// ganzen Kurve (fängt auch Catmull-Rom-Durchhänger zwischen den
// Stationen). Einzige Ausnahme: das Sturzflug-Fenster um den
// Anstoß-Beat, dort sinkt der Boden weich auf die komponierte
// Endhöhe des Sturzflugs ab. Pure Funktion von u → reversibel.
export const MIN_FLIGHT_Y = 0.9
const DIVE_FLOOR_Y = 0.5
const DIVE_HALF_WIDTH = 0.14
// v6-E1: Maximalhöhe fängt Catmull-Durchhänger/Überschwinger nach oben
// (der Establishing-Shot sitzt bei y=7.0 → Marge bis 7.6).
const MAX_FLIGHT_Y = 7.6

function flightFloorAt(u: number): number {
  const d = Math.abs(u - KICKOFF_U) / DIVE_HALF_WIDTH
  if (d >= 1) return MIN_FLIGHT_Y
  const w = 1 - d
  const s = w * w * (3 - 2 * w)
  return THREE.MathUtils.lerp(MIN_FLIGHT_Y, DIVE_FLOOR_Y, s)
}

// Reusable scratch vectors (keine Allokation im Frame-Loop)
const _pos = new THREE.Vector3()
const _look = new THREE.Vector3()

/** Sample die Fahrt bei t∈[0,1]. Schreibt in die übergebenen Vektoren. */
export function sampleFlight(t: number, outPos: THREE.Vector3, outLook: THREE.Vector3) {
  const c = THREE.MathUtils.clamp(t, 0, 1)
  // Bogenlängen-korrigiert → gleichmäßiges gefühltes Tempo (v6-E1)
  const uc = arcLengthU(c)
  posCurve.getPoint(uc, _pos)
  lookCurve.getPoint(uc, _look)
  // Höhen-Klammer: Boden (nie in den Rasen) + Deckel (kein Überschwinger)
  _pos.y = THREE.MathUtils.clamp(_pos.y, flightFloorAt(c), MAX_FLIGHT_Y)
  outPos.copy(_pos)
  outLook.copy(_look)
}

// Statischer Hero-Frame für den WebGL-/reduced-motion-Fallback
export const HERO_FRAME: Station = STATIONS[0]
