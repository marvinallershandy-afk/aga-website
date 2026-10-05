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
  //     den Anstoßkreis, endet kontrolliert ÜBER dem Rasen. v9-E1: Blick-
  //     Ziel näher herangeholt (z −3.6 → −1.9), damit der Look-Bogen
  //     Hero(0.6)→Anstoß→Mannschaft(−0.5) nicht mehr weit „durchwhippt" —
  //     der Übergang wird ein Fluss statt eines sichtbaren Schwenks.
  { pos: new THREE.Vector3(0.35, 0.62, 2.75), look: new THREE.Vector3(-2.6, 1.15, -1.9) },
  // 2 · MANNSCHAFT — v14-D „Startelf-Flyover": KEINE Einzelpose mehr, sondern
  //     eine eigene Unterkurve (TEAM_KEYS unten). Hier steht nur ihr erster
  //     Keyframe, damit STATIONS weiter 8 Einträge hat (u-Raster 1/7 bleibt
  //     für Anstoß, Fanblock, Partyraum, Sponsoren, Finale unverändert).
  //     v14-M: Start HOCH über dem gegnerischen Strafraum, Blick zurück über
  //     die ganze Elf (Sturm vorn, Torwart hinten).
  { pos: new THREE.Vector3(4.8, 6.2, -3.3), look: new THREE.Vector3(-0.6, 0.2, 0.6) },
  // 3 · FANBLOCK (v9-E2, zurückgeholt) — Schwenk in die Süd-/SO-Kurve:
  //     Blick von der Platzmitte auf die Fans + wehendes AGA-URKNALL-
  //     Banner (FanBlock.tsx, CX=3.6 / z≈+3.95). Emotionaler Beat. y knapp
  //     über FIELD_FLOOR (1.45), damit der Boden-Clamp die Pose nicht hebt
  //     — robust auch wenn spätere Stationen die u-Lage verschieben.
  { pos: new THREE.Vector3(2.9, 1.55, 2.3), look: new THREE.Vector3(3.7, 0.55, 4.0) },
  // 4 · MUSIK — Anflug aufs Vereinsheim: die Kamera schwenkt zur Tür,
  //     dann schneidet der PartyDirector in den Partyraum (Dip-to-Black)
  { pos: new THREE.Vector3(4.6, 0.9, 1.5), look: new THREE.Vector3(7.1, 0.5, -0.35) },
  // 5 · TABELLE (v11-E5: Reihenfolge getauscht — Tabelle jetzt VOR Sponsoren) —
  //     Schwenk zum echten Vereinsheim hinter dem Ost-Tor (ruhiger Ergebnis-Beat).
  { pos: new THREE.Vector3(4.0, 0.95, 3.1), look: new THREE.Vector3(7.15, 0.32, -0.5) },
  // 6 · SPONSOREN (die Geld-Station, jetzt direkt vor „Mitmachen") — BANDEN-
  //     ZOOM auf die Süd-Bande (Barrier.tsx, z≈3.99). y knapp über CLUB_FLOOR
  //     (0.85), damit der Boden-Clamp die tiefe Pose nicht hebt.
  { pos: new THREE.Vector3(-0.5, 0.86, 3.05), look: new THREE.Vector3(-0.6, 0.12, 3.985) },
  // 7 · KONTAKT/FINALE — RAUSZOOM in die Vogelperspektive (v8-E4): die
  //     Kamera steigt aus der Platznähe auf und macht die ganze Welt zur
  //     Standort-Karte. Blick von oben-Süd auf Platz + Vereinsheim (+x),
  //     der LocationMarker („Hier sind wir") blendet über dem Vereinsheim
  //     ein, der Route-Button lebt im DOM (PlatzFinden). Höhe s.
  //     maxFlightYAt() — die globale Y-Decke wird zum Finale angehoben.
  // v11-E8: WEITER rauszoomen — der Platz + Vereinsheim werden zum kleinen
  //     Solitär auf der flachen 2D-Karte (y 13.5 → 19.5, etwas weiter weg).
  { pos: new THREE.Vector3(2.2, 19.5, 8.4), look: new THREE.Vector3(1.2, 0, -0.4) },
]

export const STATION_COUNT = STATIONS.length

// ─── Anstoß-Dramaturgie ──────────────────────────────────────
// Geteilter Fahrt-Zustand (pro Frame von CameraRig geschrieben,
// von Flutlicht/Ball/Staub gelesen — kein React-State).
export const cameraState = { u: 0 }

// Kurven-Parameter der Anstoß-Station
export const KICKOFF_U = 1 / (STATIONS.length - 1) // = 1/7 bei 8 Stationen

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


// ─── v14-D/M: Startelf-Flyover (Unterkurve der Mannschafts-Station) ────
// v14-M „Ganzer Platz, ruhig": Die Elf steht über die volle Feldlänge, die
// Kamera bleibt HOCH und weit weg (y ≈ 6.2–7.3, Abstand zur Elf 8–12) und
// beschreibt EINEN weiten, ruhigen Bogen über die (offene) Nordseite: Start über dem
// gegnerischen Strafraum (Blick zurück über den Sturm), Zurückgleiten über
// die Mittellinie, Ende in der erhöhten Totale hinter dem eigenen Tor —
// der ganze Platz inkl. Unterstand an der Südlinie (= rechts) im Bild, wie
// im abgenommenen Konzept. Wenige Keyframes, ein Drehsinn → kein Hin und Her.
// Die Keyframes liegen IN der Hauptkurve (zwischen Anstoß und Fanblock):
// eine einzige Catmull-Rom → die Tangenten an den Übergängen sind stetig,
// Ein- und Ausflug laufen ohne Knick. Alle Höhen ≥ FIELD_FLOOR (1.45),
// ≤ MAX_FLIGHT_Y (7.6).
const TEAM_KEYS: Station[] = [
  STATIONS[2],
  { pos: new THREE.Vector3(-2.2, 7.3, -8.8), look: new THREE.Vector3(-0.8, 0.0, 1.0) },
  // Innen am NW-Flutlichtmast (−6.95 | −5.1, Kopf y 5.2) vorbei — der Mast
  // bleibt links hinter der Kamera statt als schwarzer Block ins Bild zu ragen.
  { pos: new THREE.Vector3(-7.0, 6.9, -2.4), look: new THREE.Vector3(0.0, -0.2, 1.0) },
  { pos: new THREE.Vector3(-10.4, 6.2, 0.5), look: new THREE.Vector3(0.4, -0.5, 1.1) },
]
const TEAM_SEGS = TEAM_KEYS.length - 1

// Kontrollpunkte der Gesamtfahrt: Hero, Anstoß, Flyover-Keys, Fanblock … Finale.
const CURVE_POINTS: Station[] = [STATIONS[0], STATIONS[1], ...TEAM_KEYS, ...STATIONS.slice(3)]
const SEG_COUNT = CURVE_POINTS.length - 1 // = 7 + TEAM_SEGS

const posCurve = new THREE.CatmullRomCurve3(
  CURVE_POINTS.map((s) => s.pos),
  false,
  'centripetal',
  0.5,
)
const lookCurve = new THREE.CatmullRomCurve3(
  CURVE_POINTS.map((s) => s.look),
  false,
  'centripetal',
  0.5,
)

// ─── Bogenlängen-Korrektur pro Segment (v6-E1) ───────────────
// Problem: getPoint(u) tastet die Catmull-Rom PARAMETRISCH ab —
// die Kamera beschleunigt durch die Kontrollpunkte („zerrt"). Fix:
// für jedes Segment eine Bogenlängen-Tabelle; gleicher Scroll-Delta →
// gleiche Weltdistanz. Die STATIONEN bleiben exakt gepinnt.
// v14-D: Über die Flyover-Segmente wird die Bogenlänge GEMEINSAM
// verteilt — gleichmäßiges Tempo über die ganze Fahrt über die Elf.
const SAMPLES_PER_SEG = 28
const segArc: Float32Array[] = []
const segLen: number[] = []
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
    segLen.push(total)
  }
}
const TEAM_SEG0 = 2 // erstes Flyover-Segment in der Gesamtkurve
const teamCum: number[] = [0]
for (let i = 0; i < TEAM_SEGS; i++) teamCum.push(teamCum[i] + segLen[TEAM_SEG0 + i])
const TEAM_LEN = teamCum[TEAM_SEGS] || 1

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

/** Flyover-Tempo: kurzes, weiches Anfahren aus dem Establishing-Shot,
 *  Ankunft in der Totale vor dem Sektionsende (ruhiger Halt). */
function teamEase(s: number): number {
  const a = THREE.MathUtils.clamp((s - 0.015) / (0.9 - 0.015), 0, 1)
  return 0.45 * a + 0.55 * a * a * (3 - 2 * a)
}

/** g (Stations-Einheiten, s. anchors.ts) → Kurvenparameter t∈[0,1],
 *  bogenlängen-korrigiert. */
function gToCurveT(g: number): number {
  const c = THREE.MathUtils.clamp(g, 0, 8)
  if (c > 2 && c < 3) {
    // Flyover: gemeinsame Bogenlänge über alle Team-Segmente
    const d = teamEase(c - 2) * TEAM_LEN
    let i = 0
    while (i < TEAM_SEGS - 1 && d > teamCum[i + 1]) i++
    const local = (d - teamCum[i]) / (segLen[TEAM_SEG0 + i] || 1)
    const seg = TEAM_SEG0 + i
    return (seg + arcToParam(seg, THREE.MathUtils.clamp(local, 0, 1))) / SEG_COUNT
  }
  // Außerhalb: Segment-Index in der Gesamtkurve
  const idx = c <= 2 ? c : c - 1 + TEAM_SEGS
  const seg = Math.min(SEG_COUNT - 1, Math.floor(idx))
  const localA = idx - seg
  return (seg + arcToParam(seg, localA)) / SEG_COUNT
}

// Anker/Remap leben three-frei in ./anchors (Fallback-Ladepfad!)
export { setAnchors, scrollToU, scrollToG, gToU, gToTeam } from './anchors'

// ─── Mindest-Kamerahöhe (v5-Review) ──────────────────────────
// Die Fahrt darf nie „in den Rasen" — harte Untergrenze über der
// ganzen Kurve (fängt auch Catmull-Rom-Durchhänger zwischen den
// Stationen). Einzige Ausnahme: das Sturzflug-Fenster um den
// Anstoß-Beat, dort sinkt der Boden weich auf die komponierte
// Endhöhe des Sturzflugs ab. Pure Funktion von u → reversibel.
export const MIN_FLIGHT_Y = 0.9
// v9-E1: Sturzflug weniger tief (0.5 → 0.95) und breiteres, weicheres
// Ein-/Ausblend-Fenster (0.14 → 0.185) — „Höhe nicht zu tief", der Dive
// wird ein sanfter Bogen statt eines scharfen V (Marvin: Übergang sichtbar).
const DIVE_FLOOR_Y = 0.95
const DIVE_HALF_WIDTH = 0.185
// v6-E1: Maximalhöhe fängt Catmull-Durchhänger/Überschwinger nach oben
// (der Establishing-Shot sitzt bei y=7.0 → Marge bis 7.6).
const MAX_FLIGHT_Y = 7.6
// v8-E4: Zum FINALE (u→1) steigt die Decke, damit der Rauszoom in die
// Vogelperspektive (Station 5, y=13.5) möglich ist — der Rest der Fahrt
// bleibt bei 7.6 gedeckelt.
const FINALE_U = 0.86
const FINALE_MAX_Y = 21 // v11-E8: höhere Decke → der Finale-Rauszoom trägt weiter
// v14-D: Das Mannschafts-Fenster mit angehobener Decke (Draufsicht y=10.9)
// ist entfallen — der Flyover bleibt tief (y ≤ 3.5).
function maxFlightYAt(u: number): number {
  if (u > FINALE_U) {
    const k = THREE.MathUtils.clamp((u - FINALE_U) / (1 - FINALE_U), 0, 1)
    return THREE.MathUtils.lerp(MAX_FLIGHT_Y, FINALE_MAX_Y, k * k * (3 - 2 * k))
  }
  return MAX_FLIGHT_Y
}
// v8-E1: Boden ZONENWEISE. Über dem offenen Feld (Hero→Mannschaft→
// Anflug) höher, damit die Fahrt nicht „im Rasen skimmt" (Marvin);
// am Vereinsheim (u≳0.55, Musik/Tabelle/Kontakt, Tür-Anflug) tief.
const FIELD_FLOOR = 1.45
const CLUB_FLOOR = 0.85
const CLUB_U = 0.55

function flightFloorAt(u: number): number {
  // Grundboden: Feld hoch → Vereinsheim tief (weicher Übergang)
  let base = FIELD_FLOOR
  if (u > CLUB_U) {
    const k = THREE.MathUtils.clamp((u - CLUB_U) / 0.12, 0, 1)
    base = THREE.MathUtils.lerp(FIELD_FLOOR, CLUB_FLOOR, k * k * (3 - 2 * k))
  }
  // Anstoß-Sturzflug: einziges gewolltes Rasen-Nah-Fenster
  const d = Math.abs(u - KICKOFF_U) / DIVE_HALF_WIDTH
  if (d >= 1) return base
  const w = 1 - d
  const s = w * w * (3 - 2 * w)
  return THREE.MathUtils.lerp(base, DIVE_FLOOR_Y, s)
}

// Reusable scratch vectors (keine Allokation im Frame-Loop)
const _pos = new THREE.Vector3()
const _look = new THREE.Vector3()

/** Sample die Fahrt bei g ∈ [0,8] (Stations-Einheiten inkl. Flyover). */
export function sampleFlightG(g: number, outPos: THREE.Vector3, outLook: THREE.Vector3) {
  const t = gToCurveT(g)
  posCurve.getPoint(t, _pos)
  lookCurve.getPoint(t, _look)
  // Höhen-Klammer: Boden (nie in den Rasen) + Deckel (Finale hebt ihn)
  const u = g <= 2 ? g / 7 : g < 3 ? 2 / 7 : (g - 1) / 7
  _pos.y = THREE.MathUtils.clamp(_pos.y, flightFloorAt(u), maxFlightYAt(u))
  outPos.copy(_pos)
  outLook.copy(_look)
}

/** Kompatibel: Sample bei u (klassisches 8-Stationen-Raster, ohne Flyover). */
export function sampleFlight(u: number, outPos: THREE.Vector3, outLook: THREE.Vector3) {
  const c = THREE.MathUtils.clamp(u, 0, 1) * 7
  sampleFlightG(c <= 2 ? c : c + 1, outPos, outLook)
}

// Statischer Hero-Frame für den WebGL-/reduced-motion-Fallback
export const HERO_FRAME: Station = STATIONS[0]
