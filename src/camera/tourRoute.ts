import * as THREE from 'three'
import { STOP_IDS, STOP_COUNT, STOP_INDEX, TEAM_ORDER, stopWorldU, type StopId } from './tourPlan'
import { STARTELF, TEAM_CARDS } from './teamLayout'
import { DOOR_STAND } from './partyPath'

// ─────────────────────────────────────────────────────────────
// v18-R „Rundgang mit Sinn": die Kamera-Route des Scroll-Rundgangs.
//
//  · Halte (tourPlan.STOP_IDS) in Geh-Reihenfolge über das Gelände.
//  · POSITION: je zusammenhängender Außen-Strecke EINE zentripetale
//    Catmull-Rom durch Halte + Zwischenpunkte (Überflug leicht angehoben,
//    um Karten/Zaun/Tore herum) → stetige Tangenten, keine Knicke.
//  · BLICK: separat — Blickrichtung wird zwischen den Halten per Slerp
//    gedreht (stärker geglättet als die Position), Blickweite linear.
//    Kein Look-Spline, der quer durchs Bild „peitscht".
//  · KOSTEN je Etappe = Weglänge + Drehwinkel·ANG_W (+ fester Wert für
//    die Tür-Durchfahrt). Der CameraRig glättet die Fahrt auf dieser
//    Kosten-Achse mit einer kritisch gedämpften Feder und Tempo-Grenze →
//    weiches An-/Abfahren, Dauer wächst mit der Distanz.
//  · Partyraum: eigene Etappen (rein → verweilen → raus) über partyPath;
//    die Kamera steht vorher und nachher VOR der Tür (DOOR_STAND).
// ─────────────────────────────────────────────────────────────

interface Pose {
  pos: THREE.Vector3
  look: THREE.Vector3
}
const P = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

// ─── Spieler-Posen: Kamera WESTLICH der Karte (Blick Richtung Gegner-
// tor), leicht erhöht — die Reihe dahinter liegt hinter/unter der Kamera,
// die Reihen davor stehen im Bildhintergrund. Karten drehen sich zur
// Kamera (PlayerCards3D). Abstand ~1.9 → Karte füllt ~70 % der Bildhöhe.
const CARD_ASPECT = 1.4
function playerPose(k: number): Pose {
  const c = TEAM_CARDS[TEAM_ORDER[k]]
  const h = c.w * CARD_ASPECT
  return {
    pos: P(Math.max(-5.85, c.x - 1.62), 1.42, c.z + 0.34),
    look: P(c.x + 0.1, h * 0.52, c.z),
  }
}

const DOOR: Pose = { pos: DOOR_STAND.pos.clone(), look: DOOR_STAND.look.clone() }

// v18-R: Der Rundgang beginnt IN der Karten-Totale (Pose je Bildklasse aus
// mapCamera.OVERVIEW, setzt der CameraRig per setRouteStart) — der erste
// Scroll auf der Karte fährt ohne Schnitt, Text oder Pause direkt los.
let KARTE: Pose = { pos: P(4.6, 21.5, 21.2), look: P(1.5, 0, 0.9) }
let KARTE_FOV = 30
// Hochformat-Totale steht im WESTEN (Poster „tall") → eigener Sinkflug
let KARTE_TALL = false
const VIAS_TALL_KARTE = [P(-16, 14, 2.6), P(-5.6, 4.0, 0.8)]

const FIXED: Record<string, Pose> = {
  // Totale hinter dem eigenen Tor: ganze Elf + Unterstand (wie v14-M)
  'team-totale': { pos: P(-10.4, 6.2, 0.5), look: P(0.4, -0.5, 1.1) },
  // Banden-Zoom auf die Süd-Bande, erste freie Tafel (Karussell verschiebt x)
  sponsoren: { pos: P(-2.16, 0.86, 3.05), look: P(-2.26, 0.12, 3.985) },
  // Südost-Kurve: Fans + Meister-Banner
  fanblock: { pos: P(2.9, 1.55, 2.3), look: P(3.7, 0.55, 4.0) },
  // Anzeigetafel am Vereinsheim (x 6.13 | z −0.35), Blick nach Nordost
  tabelle: { pos: P(3.15, 1.12, 2.05), look: P(6.15, 0.42, -0.45) },
  'musik-tuer': DOOR,
  'musik-raus': DOOR,
  // Finale: Aufstieg in die Anfahrts-Karte
  kontakt: { pos: P(2.2, 19.5, 8.4), look: P(1.2, 0, -0.4) },
}

/** Pose eines Halts (für den Partyraum: die Tür-Pose davor). */
export function stopPose(id: StopId, outPos: THREE.Vector3, outLook: THREE.Vector3) {
  let p: Pose
  if (id === 'karte') p = KARTE
  else if (id.startsWith('team-') && id !== 'team-totale') p = playerPose(Number(id.slice(5)))
  else p = FIXED[id] ?? DOOR
  outPos.copy(p.pos)
  outLook.copy(p.look)
}

// ─── Zwischenpunkte je Etappe (a>b) ─────────────────────────
const VIAS: Record<string, THREE.Vector3[]> = {
  // aus der Karten-Totale über die Südseite hinab hinter den Torwart —
  // über den wachsenden Karten, westlich um das eigene Tor herum
  'karte>team-0': [P(1.6, 6.4, 9.6), P(-3.0, 2.7, 3.7), P(-5.55, 1.85, 1.6)],
  // Totale → Bande: über die Südwest-Ecke des Platzes absinken
  'team-totale>sponsoren': [P(-4.6, 2.0, 2.3)],
  // Anzeigetafel → Tür: am Ost-Tor vorbei (x < 5.25), westlich des Zauns (x 6.2)
  'tabelle>musik-tuer': [P(4.45, 0.92, -0.95)],
  // Tür → Karte: erst zurück und hoch, dann in die Vogelperspektive
  'musik-raus>kontakt': [P(3.9, 3.1, -0.9)],
}

type LegKind = 'fly' | 'party-in' | 'hold' | 'party-out'

// Blick-Timing je Etappe (Default: smootherstep, Drehung mittig):
//  'late'  — erst sinken, dann aufrichten (aus der Karte in den Anstoß:
//            der Blick bleibt länger auf dem Platz statt auf dem Wald)
//  'early' — erst nach unten kippen, dann steigen (Tür → Karte)
const LOOK_TIMING: Record<string, 'late' | 'early'> = {
  'musik-raus>kontakt': 'early',
}
interface Leg {
  kind: LegKind
  a: number
  b: number
  cost: number
  // fly: Segmente in der Kette
  chain: number
  seg0: number
  seg1: number
  len: number
  dirA: THREE.Vector3
  dirB: THREE.Vector3
  angle: number
  distA: number
  distB: number
  uA: number
  uB: number
  look: 'mid' | 'late' | 'early'
}

const ANG_W = 2.2 // Kosten je Radiant Drehung (≈ Weltmeter)
const PARTY_COST = 7.5
const SAMPLES = 24

interface Chain {
  curve: THREE.CatmullRomCurve3
  segs: number
  arc: Float32Array[] // je Segment: normierte kumulierte Bogenlänge
  segLen: number[]
}

const IDX = STOP_INDEX
const poseOf = (i: number): Pose => {
  const pos = new THREE.Vector3()
  const look = new THREE.Vector3()
  stopPose(STOP_IDS[i], pos, look)
  return { pos, look }
}
let POSES: Pose[] = []

function legKind(i: number): LegKind {
  const a = STOP_IDS[i]
  if (a === 'musik-tuer') return 'party-in'
  if (a === 'musik-raum') return 'hold'
  if (a === 'musik-raum-ende') return 'party-out'
  return 'fly'
}

/** Zwischenpunkte einer Etappe; Spieler → Spieler mit Reihenwechsel: kleiner Bogen nach oben. */
function viasOf(i: number): THREE.Vector3[] {
  const a = STOP_IDS[i]
  const b = STOP_IDS[i + 1]
  if (a === 'karte' && KARTE_TALL) return VIAS_TALL_KARTE
  const v = VIAS[`${a}>${b}`]
  if (v) return v
  if (/^team-\d+$/.test(a) && /^team-\d+$/.test(b)) {
    const ka = Number(a.slice(5))
    const kb = Number(b.slice(5))
    const ra = STARTELF[TEAM_ORDER[ka]].slot.role
    const rb = STARTELF[TEAM_ORDER[kb]].slot.role
    if (ra !== rb) {
      const m = POSES[i].pos.clone().lerp(POSES[i + 1].pos, 0.5)
      m.y += 0.32
      return [m]
    }
  }
  return []
}

// Ketten: zusammenhängende Außen-Strecken (vor und nach dem Partyraum).
let chains: Chain[] = []
let legs: Leg[] = []
let cum: number[] = [0]
export let ROUTE_LEN = 0

function build() {
  POSES = STOP_IDS.map((_, i) => poseOf(i))
  chains = []
  legs = []
  let pts: THREE.Vector3[] = []
  let pending: { i: number; seg0: number; seg1: number }[] = []
  const flush = () => {
    if (pts.length < 2) {
      pts = []
      pending = []
      return
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5)
    const segs = pts.length - 1
    const arc: Float32Array[] = []
    const segLen: number[] = []
    const p = new THREE.Vector3()
    const prev = new THREE.Vector3()
    for (let s = 0; s < segs; s++) {
      const cum = new Float32Array(SAMPLES + 1)
      curve.getPoint(s / segs, prev)
      let total = 0
      for (let k = 1; k <= SAMPLES; k++) {
        curve.getPoint((s + k / SAMPLES) / segs, p)
        total += p.distanceTo(prev)
        cum[k] = total
        prev.copy(p)
      }
      for (let k = 0; k <= SAMPLES; k++) cum[k] /= total || 1
      arc.push(cum)
      segLen.push(total)
    }
    const ci = chains.length
    chains.push({ curve, segs, arc, segLen })
    for (const pl of pending) {
      const leg = legs[pl.i]
      leg.chain = ci
      leg.seg0 = pl.seg0
      leg.seg1 = pl.seg1
      let len = 0
      for (let s = pl.seg0; s < pl.seg1; s++) len += segLen[s]
      leg.len = len
      leg.cost = len + leg.angle * ANG_W
    }
    pts = []
    pending = []
  }
  for (let i = 0; i < STOP_COUNT - 1; i++) {
    const A = POSES[i]
    const B = POSES[i + 1]
    const kind = legKind(i)
    const dirA = A.look.clone().sub(A.pos)
    const dirB = B.look.clone().sub(B.pos)
    const distA = dirA.length()
    const distB = dirB.length()
    dirA.normalize()
    dirB.normalize()
    const leg: Leg = {
      kind,
      a: i,
      b: i + 1,
      cost: kind === 'hold' ? 0 : PARTY_COST,
      chain: -1,
      seg0: 0,
      seg1: 0,
      len: 0,
      dirA,
      dirB,
      angle: Math.acos(THREE.MathUtils.clamp(dirA.dot(dirB), -1, 1)),
      distA,
      distB,
      uA: stopWorldU(STOP_IDS[i]),
      uB: stopWorldU(STOP_IDS[i + 1]),
      look: LOOK_TIMING[`${STOP_IDS[i]}>${STOP_IDS[i + 1]}`] ?? 'mid',
    }
    legs.push(leg)
    if (kind !== 'fly') {
      flush()
      continue
    }
    if (pts.length === 0) pts.push(A.pos.clone())
    const seg0 = pts.length - 1
    for (const v of viasOf(i)) pts.push(v.clone())
    pts.push(B.pos.clone())
    pending.push({ i, seg0, seg1: pts.length - 1 })
  }
  flush()
  cum = [0]
  for (const l of legs) cum.push(cum[cum.length - 1] + l.cost)
  ROUTE_LEN = cum[cum.length - 1]
}
build()

let routeKey = ''
/** Start-Pose (Karten-Totale) der aktuellen Bildklasse setzen; baut die
 *  Route nur neu, wenn sich die Pose ändert (Drehen des Geräts). */
export function setRouteStart(pos: THREE.Vector3, look: THREE.Vector3, fov: number, tall: boolean) {
  const key = `${pos.x},${pos.y},${pos.z},${look.x},${look.y},${look.z},${fov.toFixed(2)},${tall}`
  if (key === routeKey) return
  routeKey = key
  KARTE = { pos: pos.clone(), look: look.clone() }
  KARTE_FOV = fov
  KARTE_TALL = tall
  build()
}

/** Halt-Parameter s (Halt-Einheiten) → Routen-Kosten D. */
export function routeDAtStop(s: number): number {
  const c = THREE.MathUtils.clamp(s, 0, STOP_COUNT - 1)
  const i = Math.min(legs.length - 1, Math.floor(c))
  return cum[i] + (c - i) * legs[i].cost
}

const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
/** Positions-Ease je Etappe: weich an Halten (Ankommen), kein Stillstand
 *  beim Durchscrollen. */
const easePos = (f: number) => f + (smoother(f) - f) * 0.7

function arcToParam(ch: Chain, seg: number, a: number): number {
  const c = ch.arc[seg]
  for (let k = 0; k < SAMPLES; k++) {
    if (a <= c[k + 1]) {
      const span = c[k + 1] - c[k] || 1
      return (k + (a - c[k]) / span) / SAMPLES
    }
  }
  return 1
}

const _dir = new THREE.Vector3()
const _axis = new THREE.Vector3()
function slerpDir(a: THREE.Vector3, b: THREE.Vector3, angle: number, t: number, out: THREE.Vector3) {
  if (angle < 1e-4) return out.copy(a)
  if (Math.PI - angle < 1e-3) {
    // Gegenrichtung: um die Hochachse drehen
    _axis.set(0, 1, 0)
    return out.copy(a).applyAxisAngle(_axis, angle * t)
  }
  const s = Math.sin(angle)
  const wa = Math.sin((1 - t) * angle) / s
  const wb = Math.sin(t * angle) / s
  return out.copy(a).multiplyScalar(wa).addScaledVector(b, wb)
}

export interface RouteSample {
  pos: THREE.Vector3
  look: THREE.Vector3
  /** Weltparameter u für Flutlicht/Karten/Fans/Karten-Fade. */
  u: number
  /** Halt-Parameter (Halt-Einheiten, inkl. Bruchteil). */
  s: number
  /** Partyraum-Fortschritt 0…1 auf den Party-Etappen, sonst 0. */
  party: number
  /** Brennweite (vertikales fov): Karten-Tele → 46°. */
  fov: number
  /** 1 = in der Karten-Totale, 0 ab dem Anstoß (Tilt-Shift, Fans, Atmen). */
  karte: number
}

export function createRouteSample(): RouteSample {
  return { pos: new THREE.Vector3(), look: new THREE.Vector3(), u: 0, s: 0, party: 0, fov: 46, karte: 0 }
}

/** Route bei Kosten D abtasten. Party-Etappen liefern nur `party`
 *  (die Pose rechnet der CameraRig über partyPath). */
export function sampleRoute(D: number, out: RouteSample) {
  const d = THREE.MathUtils.clamp(D, 0, ROUTE_LEN)
  let i = 0
  while (i < legs.length - 1 && d > cum[i + 1]) i++
  const leg = legs[i]
  const f = leg.cost > 0 ? THREE.MathUtils.clamp((d - cum[i]) / leg.cost, 0, 1) : 1
  out.s = i + f
  // Erste Etappe (Karte → Torwart): sofort mit dem ersten Scroll-Pixel
  // losfahren (Ease-OUT), nur am Ziel weich ankommen
  const e = i === 0 ? 1 - (1 - f) * (1 - f) : easePos(f)
  out.u = THREE.MathUtils.lerp(leg.uA, leg.uB, e)
  out.party = 0
  out.fov = 46
  out.karte = 0
  if (i === 0) {
    // erste Etappe: aus der Karten-Totale (Tele) in die 46°-Fahrt
    out.karte = 1 - e
    out.fov = THREE.MathUtils.lerp(KARTE_FOV, 46, e)
  }
  if (leg.kind === 'party-in') {
    out.party = e
    return out
  }
  if (leg.kind === 'hold') {
    out.party = 1
    return out
  }
  if (leg.kind === 'party-out') {
    out.party = 1 - e
    return out
  }
  // Position: Bogenlänge über alle Segmente der Etappe
  const ch = chains[leg.chain]
  let dist = e * leg.len
  let s = leg.seg0
  while (s < leg.seg1 - 1 && dist > ch.segLen[s]) {
    dist -= ch.segLen[s]
    s++
  }
  const local = THREE.MathUtils.clamp(dist / (ch.segLen[s] || 1), 0, 1)
  ch.curve.getPoint((s + arcToParam(ch, s, local)) / ch.segs, out.pos)
  if (out.pos.y < 0.45) out.pos.y = 0.45
  keepInClearing(out.pos)
  // Blick: Richtung slerpen (kräftiger geglättet), Blickweite linear
  const el = leg.look === 'late' ? smoother(f * f) : leg.look === 'early' ? smoother(1 - (1 - f) * (1 - f)) : smoother(f)
  if (i === 0) {
    // Aus der Karte: Blickpunkt wandert auf dem Platz (Mitte → Torwart),
    // die Kamera bleibt darauf gerichtet, egal von welcher Seite sie kommt
    out.look.lerpVectors(POSES[0].look, POSES[1].look, smoother(f))
    return out
  }
  slerpDir(leg.dirA, leg.dirB, leg.angle, el, _dir)
  out.look.copy(out.pos).addScaledVector(_dir, THREE.MathUtils.lerp(leg.distA, leg.distB, el))
  return out
}

/** Kamera unterhalb der Baumkronen in der Lichtung halten (forestLayout
 *  CLEARING: Platz x −6.9…6.45, Süd z ≤ 5.15; Vereinsheim-Hof x ≤ 8.35
 *  nördlich z 2.45) — mit Abstand für die Kronen. */
export function keepInClearing(p: THREE.Vector3) {
  if (p.y > 3.8) return
  if (p.x < -5.85) p.x = -5.85
  if (p.z > 4.6) p.z = 4.6
  if (p.z > 2.0 && p.x > 5.9) p.x = 5.9
}

/** Abstand (Halt-Einheiten) zum Halt `id` — für Stations-Effekte. */
export function stopDistance(s: number, id: StopId): number {
  return Math.abs(s - IDX[id])
}

// ─── Kritisch gedämpfte Feder (SmoothDamp) ───────────────────
// Stetige Geschwindigkeit → kein Ruck beim Anfahren (die alte
// Exponential-Dämpfung startete jeden Rad-Tick mit Maximaltempo).
export function smoothDamp(
  cur: number,
  target: number,
  vel: { v: number },
  smoothTime: number,
  maxSpeed: number,
  dt: number,
): number {
  const st = Math.max(1e-4, smoothTime)
  const omega = 2 / st
  const x = omega * dt
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const orig = target
  const maxChange = maxSpeed * st
  const change = THREE.MathUtils.clamp(cur - target, -maxChange, maxChange)
  const tgt = cur - change
  const temp = (vel.v + omega * change) * dt
  vel.v = (vel.v - omega * temp) * exp
  let out = tgt + (change + temp) * exp
  if (orig - cur > 0 === out > orig) {
    out = orig
    vel.v = dt > 0 ? (out - orig) / dt : 0
  }
  return out
}
