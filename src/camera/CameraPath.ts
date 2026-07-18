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
  // 0 · VEREIN — Establishing. P5-E3/GATE-11 (docs/KAMERA_KONZEPT §Station 0):
  //     Register VOGELFLUG bleibt, aber etwas TIEFER & frontaler (y 7.0 → 6.2,
  //     z 15.2 → 14.0) → der Horizont/Vereinsschild trägt, die Flutlicht-Masten
  //     stechen nicht mehr frei in den Himmel. Look leicht angehoben (y 0.5 →
  //     0.9) → weniger „Tischmodell", mehr „vor seinem Verein stehen".
  { pos: new THREE.Vector3(4.2, 6.2, 14.0), look: new THREE.Vector3(0, 0.9, 0.6) },
  // 1 · ANSTOSS (Signature-Beat, keine eigene Sektion) — GATE-11 KERNUMBAU
  //     (KAMERA_KONZEPT §Station 1+2, „Aufsteigen über die Karten-Wand"): der
  //     Sturzflug endet NEU tief hinter dem West-Tor / hinter dem Torwart
  //     (TW-Seite, −x), Blick nach OSTEN die noch leere Aufstellung entlang.
  //     Das ist die STARTRAMPE des Mannschafts-Reveals: von hier steigt die
  //     Kamera über das Segment 1→2 auf und schwenkt herum, bis die volle
  //     Formation im Präsentationsblick steht — die Karten „wachsen" dem
  //     Besucher entgegen (Reveal steigt, Grammatik-Regel 4). Der Blick liegt
  //     tief am West-Ende der Formation (x≈−2.5) → die TW-Reihe steht nah/
  //     unten, die Wand staffelt sich nach hinten/oben hoch (passt zur E2-
  //     Lift-Staffelung). Ball rollt weiter aus dem Bild, Flutlicht steht dann
  //     voll. y=1.55 > FIELD_FLOOR (1.45) → Boden-Clamp greift nicht.
  { pos: new THREE.Vector3(-4.6, 1.55, 0.5), look: new THREE.Vector3(-2.5, 1.05, 0.4) },
  // 2 · MANNSCHAFT — Zielpose des Reveals = die komponierte E2-Endpose
  //     (4 Bänder + Staff-Reihe). BEWUSST UNVERÄNDERT (KAMERA_KONZEPT §Station 2
  //     Punkt 3 + §2): der Reveal führt von Station 1 GENAU hierher, damit die
  //     E2-Komposition & die Tap-Ziele der 3D-Karten erhalten bleiben. Marvin
  //     kann die Endpose später tiefer/näher ziehen (Konzept-Vorschlag
  //     ~(3.2,4.6,7.6)/look(−1.4,1.4,0.4)) — hier konservativ gehalten, damit
  //     der Reveal-Umbau die Kader-Interaktion nicht regressiert.
  { pos: new THREE.Vector3(5.6, 5.5, 7.2), look: new THREE.Vector3(-1.6, 0.75, 0.4) },
  // 3 · FANBLOCK (v9-E2, zurückgeholt) — Schwenk in die Süd-/SO-Kurve:
  //     Blick von der Platzmitte auf die Fans + wehendes AGA-URKNALL-
  //     Banner (FanBlock.tsx, CX=3.6 / z≈+3.95). Emotionaler Beat. y knapp
  //     über FIELD_FLOOR (1.45), damit der Boden-Clamp die Pose nicht hebt.
  //     GATE-11 (§Station 3): minimaler Seitwärts-Drift näher heran (z 2.3 →
  //     2.7) → das Banner „weht", Leben statt Standbild.
  { pos: new THREE.Vector3(2.9, 1.55, 2.7), look: new THREE.Vector3(3.7, 0.55, 4.0) },
  // 4 · MUSIK — Anflug aufs Vereinsheim: die Kamera schwenkt zur Tür, dann
  //     übernimmt der partyPath die DURCHFAHRT. GATE-11 (§Station 4): Anflug
  //     jetzt in KOPFHÖHE (y 0.9 → 1.6) statt in Zaun-/Sockelnähe zu skimmen —
  //     die 0.9 ließ die Kamera an der Nahgeometrie entlangschaben (Katalog #5).
  //     ⚠️ partyPath.ts (approachPos[0]) ist synchron auf y=1.6 nachgezogen,
  //     damit der Übergang Flug→Durchfahrt nahtlos bleibt.
  { pos: new THREE.Vector3(4.6, 1.6, 1.5), look: new THREE.Vector3(7.1, 0.5, -0.35) },
  // 5 · TABELLE (v11-E5: Reihenfolge getauscht — Tabelle jetzt VOR Sponsoren) —
  //     Schwenk zum echten Vereinsheim hinter dem Ost-Tor (ruhiger Ergebnis-Beat).
  //     GATE-11 (§Station 5): Register STANDPUNKT leicht angehoben (y 0.95 → 1.8,
  //     look.y 0.32 → 0.5) → der Blick „steht drüber", die H2 „DIE WAHRHEIT"
  //     läuft nicht mehr unters SVA-Logo. y=1.8 > CLUB_FLOOR (0.85) → clampfrei.
  { pos: new THREE.Vector3(4.0, 1.8, 3.1), look: new THREE.Vector3(7.15, 0.5, -0.5) },
  // 6 · SPONSOREN (die Geld-Station, jetzt direkt vor „Mitmachen") — BANDEN-
  //     ZOOM auf die Süd-Bande (Barrier.tsx, z≈3.99). y knapp über CLUB_FLOOR
  //     (0.85), damit der Boden-Clamp die tiefe Pose nicht hebt. BEWUSST
  //     UNVERÄNDERT: das v12-E6-Sponsoren-Karussell (CameraRig) übersteuert
  //     pos.x/look.x nahe dieser Station — ein „Parallelstand" (Konzept
  //     §Station 6) würde gegen das Karussell arbeiten. → Marvins Feintuning.
  { pos: new THREE.Vector3(-0.5, 0.86, 3.05), look: new THREE.Vector3(-0.6, 0.12, 3.985) },
  // 7 · KONTAKT/FINALE — RAUSZOOM in die Vogelperspektive (v8-E4): die
  //     Kamera steigt aus der Platznähe auf und macht die ganze Welt zur
  //     Standort-Karte. Blick von oben-Süd auf Platz + Vereinsheim (+x),
  //     der LocationMarker („Hier sind wir") blendet über dem Vereinsheim
  //     ein, der Route-Button lebt im DOM (PlatzFinden). Höhe s. maxFlightYAt().
  // v11-E8: WEITER rauszoomen (y 19.5). GATE-11 (§Station 7): Look leicht auf
  //     das Vereinsheim (+x) gewichtet (x 1.2 → 1.7 = zum LocationMarker) →
  //     der Abschied „lädt ein", statt neutral auf die Platzmitte zu zielen.
  { pos: new THREE.Vector3(2.2, 19.5, 8.4), look: new THREE.Vector3(1.7, 0, -0.45) },
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
function maxFlightYAt(u: number): number {
  if (u <= FINALE_U) return MAX_FLIGHT_Y
  const k = THREE.MathUtils.clamp((u - FINALE_U) / (1 - FINALE_U), 0, 1)
  return THREE.MathUtils.lerp(MAX_FLIGHT_Y, FINALE_MAX_Y, k * k * (3 - 2 * k))
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

/** Sample die Fahrt bei t∈[0,1]. Schreibt in die übergebenen Vektoren. */
export function sampleFlight(t: number, outPos: THREE.Vector3, outLook: THREE.Vector3) {
  const c = THREE.MathUtils.clamp(t, 0, 1)
  // Bogenlängen-korrigiert → gleichmäßiges gefühltes Tempo (v6-E1)
  const uc = arcLengthU(c)
  posCurve.getPoint(uc, _pos)
  lookCurve.getPoint(uc, _look)
  // Höhen-Klammer: Boden (nie in den Rasen) + Deckel (Finale hebt ihn)
  _pos.y = THREE.MathUtils.clamp(_pos.y, flightFloorAt(c), maxFlightYAt(c))
  outPos.copy(_pos)
  outLook.copy(_look)
}

// Statischer Hero-Frame für den WebGL-/reduced-motion-Fallback
export const HERO_FRAME: Station = STATIONS[0]
