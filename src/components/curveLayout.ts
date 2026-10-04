import * as THREE from 'three'
import { PITCH } from '../utils/constants'
import { MOVE, GARMENT, PROP, REST_POINTS } from '../three/humanGeometry'
import { PAL, posedRightHandPoint } from '../three/crowdMaterial'

// ─────────────────────────────────────────────────────────────
// v14-B: Aufstellung der Meisterfeier — wer steht wo, wer macht
// was. Reine Daten (deterministisch, prerender-sicher). FanBlock
// baut daraus EIN Instanz-Mesh (Fans + Mannschaft) und dockt
// Fahnen, Bengalo-Rauch und Handy-Blitze an die passenden Hände.
// ─────────────────────────────────────────────────────────────

export const HH = PITCH.height / 2 + 0.55 // Reling-Linie Süd
export const CX = 3.6 // Block-Zentrum x (nahe SO-Ecke)

// Stehtraverse: 10 Reihen, je 0.112 tief, 14 cm Stufe (Maßstab 1:10)
export const ROWS = 10
export const ROW_Z0 = HH + 0.36
export const ROW_D = 0.112
export const STEP_H = 0.014
export const TERRACE_BACK = HH + 1.5
export const TERRACE_HALF_W = 2.5

export function terraceRow(z: number): number {
  return THREE.MathUtils.clamp(Math.round((z - ROW_Z0) / ROW_D), 0, ROWS - 1)
}
export function terraceY(z: number): number {
  if (z < ROW_Z0 - ROW_D / 2) return 0
  return terraceRow(z) * STEP_H
}

export function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Person {
  x: number; y: number; z: number; yaw: number; h: number
  mode: number; phase: number; tempo: number; amp: number
  hair: number; garment: number; prop: number; pants: number
  main: number; accent: number; skin: number; hairCol: number
  /** Detailstufe: vorne/Team voll, hintere Reihen grober */
  lod: 'high' | 'low'
}

// Foto-Schilder (Positionen wie bisher)
export const SIGN_SPOTS = [
  { x: CX - 1.5, z: HH + 0.6, y: 0.66, yaw: 0.14 },
  { x: CX + 0.15, z: HH + 0.72, y: 0.74, yaw: 0 },
  { x: CX + 1.65, z: HH + 0.6, y: 0.66, yaw: -0.14 },
]
export const SIGN_W = 0.4
export const SIGN_H = 0.3

// Fahnen an Masten in der Menge + Doppelhalter
export const WIND_FLAGS = [
  { x: CX - 2.15, z: HH + 0.7, poleH: 0.66, w: 0.32, h: 0.21, phase: 0.4 },
  { x: CX + 2.1, z: HH + 0.62, poleH: 0.74, w: 0.34, h: 0.22, phase: 2.1 },
  { x: CX + 0.9, z: HH + 1.05, poleH: 0.86, w: 0.3, h: 0.2, phase: 3.3 },
]
export const DOUBLE_HOLDERS = [
  { x: CX - 0.72, z: HH + 1.06, y: 0.4, w: 0.25, h: 0.15, kind: 0, phase: 0.7 },
  { x: CX + 0.95, z: HH + 0.8, y: 0.38, w: 0.24, h: 0.15, kind: 1, phase: 2.2 },
  { x: CX - 2.0, z: HH + 1.22, y: 0.41, w: 0.24, h: 0.15, kind: 2, phase: 4.1 },
]

// Bengalo-Halter (Positionen der Fans; der Rauch sitzt an ihrer Faust)
const FLARE_SPOTS = [
  { x: CX - 0.4, z: HH + 1.17 },
  { x: CX + 0.75, z: HH + 1.2 },
  { x: CX - 1.05, z: HH + 1.26 },
]

// Mannschaft vor der Kurve (Rasen-Auslauf zwischen Linie und Bande)
export const TEAM_Z = HH - 0.16
export const TEAM_X = CX - 0.35
export const TEAM_SPACING = 0.062

export interface CurveLayout {
  people: Person[]
  flares: THREE.Vector3[]
  phones: THREE.Vector3[]
  flagHand: THREE.Vector3
  teamCount: number
}

const pick = <T,>(arr: readonly T[], r: number) => arr[Math.floor(r * arr.length) % arr.length]

function instanceMatrix(p: Person, m = new THREE.Matrix4()) {
  return m.compose(
    new THREE.Vector3(p.x, p.y, p.z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw),
    new THREE.Vector3(p.h, p.h, p.h),
  )
}
export { instanceMatrix }

export function buildCurveLayout(lite: boolean): CurveLayout {
  const rand = mulberry32(20260626)
  const people: Person[] = []

  // ── Fan-Garderobe ────────────────────────────────────────────
  const dressFan = (r: () => number) => {
    const g = r()
    const garment = g < 0.5 ? GARMENT.JERSEY : g < 0.72 ? GARMENT.HOODIE : GARMENT.JACKET
    let main: number
    let accent: number
    const c = r()
    if (garment === GARMENT.JERSEY) {
      main = c < 0.55 ? PAL.RED : c < 0.75 ? PAL.BLACK : c < 0.94 ? PAL.WHITE : PAL.RED_DARK
      accent = main === PAL.BLACK || main === PAL.WHITE ? PAL.RED : r() < 0.5 ? PAL.WHITE : PAL.BLACK
    } else if (garment === GARMENT.HOODIE) {
      main = c < 0.4 ? PAL.BLACK : c < 0.65 ? PAL.GREY : PAL.RED
      accent = PAL.WHITE
    } else {
      main = c < 0.35 ? PAL.BLACK : c < 0.62 ? PAL.NAVY : c < 0.84 ? PAL.RED_DARK : PAL.OLIVE
      accent = r() < 0.5 ? PAL.GREY : PAL.WHITE
    }
    const hr = r()
    const hair = hr < 0.34 ? 1 : hr < 0.48 ? 2 : hr < 0.66 ? 3 : hr < 0.76 ? 4 : hr < 0.84 ? 5 : 0
    const hairCol = hair === 3 || hair === 4 ? pick(PAL.BEANIE, r()) : pick(PAL.HAIR, r())
    return {
      garment, main, accent, hair, hairCol,
      pants: r() < 0.55 ? PAL.JEANS : PAL.DARK_PANTS,
      skin: pick(PAL.SKIN, r()),
    }
  }

  // ── Hand-platzierte Rollen (ersetzen die alten Einzel-Fans) ──
  const specials: Person[] = []
  const special = (x: number, z: number, mode: number, h: number, yawOff: number, over: Partial<Person> = {}) => {
    const d = dressFan(rand)
    const p: Person = {
      x, z, y: terraceY(z), yaw: Math.PI + yawOff, h,
      mode, phase: rand() * 6, tempo: 2, amp: 1, lod: 'high',
      prop: PROP.NONE, ...d, ...over,
    }
    specials.push(p)
    return p
  }
  // Banner-Halter (AGA URKNALL)
  special(CX - 0.72, HH + 0.27, MOVE.HOLD, 0.19, 0.1, { garment: GARMENT.JERSEY, main: PAL.RED, accent: PAL.BLACK })
  special(CX + 0.72, HH + 0.27, MOVE.HOLD, 0.185, -0.1, { garment: GARMENT.JERSEY, main: PAL.BLACK, accent: PAL.RED })
  // Fahnenträger
  const flagFan = special(CX - 1.15, HH + 0.34, MOVE.FLAG, 0.18, 0.25, { garment: GARMENT.JERSEY, main: PAL.RED, accent: PAL.WHITE })
  // An der Reling lehnen zwei
  special(CX - 2.0, HH + 0.13, MOVE.LEAN, 0.185, 0.25, { garment: GARMENT.HOODIE, main: PAL.RED })
  special(CX + 1.9, HH + 0.13, MOVE.LEAN, 0.185, -0.2, { garment: GARMENT.JACKET, main: PAL.BLACK })
  // Schal-Schwenker + Jubler vorne
  special(CX + 1.25, HH + 0.34, MOVE.SCARF, 0.18, 0, { prop: PROP.SCARF_HELD })
  special(CX + 1.1, HH + 0.4, MOVE.JUMP_V, 0.178, -0.2, { main: PAL.WHITE, garment: GARMENT.JERSEY, accent: PAL.RED })
  special(CX + 1.47, HH + 0.3, MOVE.FIST, 0.172, 0.2)
  special(CX - 1.5, HH + 0.42, MOVE.JUMP_V, 0.183, 0.3)
  // Schild-Halter unter den drei Foto-Schildern
  for (const s of SIGN_SPOTS) special(s.x, s.z, MOVE.SIGN, 0.19, s.yaw * 0.5)
  // Bengalo-Fans
  const flareFans = FLARE_SPOTS.slice(0, lite ? 2 : 3).map((s, i) =>
    special(s.x, s.z, MOVE.FLARE, 0.19, (i - 1) * 0.15, { prop: PROP.FLARE, garment: i === 1 ? GARMENT.HOODIE : GARMENT.JACKET, main: PAL.BLACK }),
  )

  // ── Die Menge auf der Traverse ───────────────────────────────
  const STEP = lite ? 0.15 : 0.094
  const phones: Person[] = []
  for (let r = 0; r < ROWS; r++) {
    const z = ROW_Z0 + r * ROW_D
    const spanHalf = 2.36 - r * 0.04
    const rowShift = (r % 2) * (STEP / 2)
    for (let x = CX - spanHalf + rowShift; x <= CX + spanHalf; x += STEP) {
      const px = x + (rand() - 0.5) * 0.04
      const pz = z + (rand() - 0.5) * 0.07
      if (specials.some((s) => Math.hypot(s.x - px, s.z - pz) < 0.085)) continue
      const d = dressFan(rand)
      const pr = rand()
      let mode: number = pr < 0.13 ? MOVE.STAND : pr < 0.42 ? MOVE.JUMP_V : pr < 0.55 ? MOVE.CLAP : pr < 0.71 ? MOVE.SCARF : MOVE.FIST
      let prop: number = mode === MOVE.SCARF ? PROP.SCARF_HELD : rand() < 0.22 ? PROP.SCARF_NECK : PROP.NONE
      if (r <= 3 && phones.length < 6 && rand() < 0.04) {
        mode = MOVE.PHONE
        prop = PROP.PHONE
      }
      // Phase: räumliche Welle (Nachbarn hüpfen fast gemeinsam, über die
      // Kurve läuft der Takt durch) + etwas Zufall
      const phase = (px - CX) * 0.85 + r * 0.33 + rand() * 0.3
      const p: Person = {
        x: px, z: pz, y: r * STEP_H, yaw: Math.PI + (rand() - 0.5) * 0.45,
        h: 0.168 + rand() * 0.034,
        mode, phase,
        tempo: mode === MOVE.STAND ? 1 : 1.9 + rand() * 0.25,
        amp: 0.75 + rand() * 0.25,
        lod: !lite && r <= 3 ? 'high' : 'low',
        prop, ...d,
      }
      if (mode === MOVE.PHONE) phones.push(p)
      people.push(p)
    }
  }
  people.push(...specials)

  // ── Die Mannschaft feiert vor der Kurve ──────────────────────
  // Zehn Arm in Arm (Humba, alle im selben Takt), in der Mitte vorne der
  // Kapitän mit dem Meisterpokal, außen zwei, die frei hochspringen.
  const teamRand = mulberry32(2026)
  const team: Person[] = []
  const kit = (over: Partial<Person>): Person => {
    const hr = teamRand()
    const hair = hr < 0.55 ? 1 : hr < 0.7 ? 5 : hr < 0.75 ? 2 : 0
    return {
      x: 0, y: 0, z: TEAM_Z, yaw: (teamRand() - 0.5) * 0.12, h: 0.178 + teamRand() * 0.02,
      mode: MOVE.ARMLOCK, phase: 0, tempo: 2.0, amp: 1, lod: 'high',
      hair, garment: GARMENT.TEAM, prop: PROP.NONE, pants: PAL.BLACK,
      main: PAL.TEAM_RED, accent: PAL.BLACK,
      skin: pick(PAL.SKIN, teamRand()), hairCol: pick(PAL.HAIR, teamRand()),
      ...over,
    }
  }
  for (let i = 0; i < 10; i++) {
    const mode = i === 0 ? MOVE.ARMLOCK_END_L : i === 9 ? MOVE.ARMLOCK_END_R : MOVE.ARMLOCK
    team.push(kit({ x: TEAM_X + (i - 4.5) * TEAM_SPACING, z: TEAM_Z + Math.sin(i * 1.7) * 0.006, mode }))
  }
  team.push(kit({ x: TEAM_X, z: TEAM_Z - 0.085, mode: MOVE.TROPHY, prop: PROP.TROPHY, h: 0.188, yaw: 0, hair: 1 }))
  team.push(kit({ x: TEAM_X - 5 * TEAM_SPACING - 0.1, z: TEAM_Z - 0.02, mode: MOVE.JUMP_V, phase: 0.5, yaw: 0.35 }))
  team.push(kit({ x: TEAM_X + 5 * TEAM_SPACING + 0.1, z: TEAM_Z - 0.03, mode: MOVE.FIST, phase: 0.5, yaw: -0.35 }))
  people.push(...team)

  // ── Andockpunkte (CPU-Spiegel der statischen Arme) ───────────
  const m = new THREE.Matrix4()
  const toWorld = (p: Person, rest: THREE.Vector3) =>
    posedRightHandPoint(p.mode, rest).applyMatrix4(instanceMatrix(p, m))
  const flares = flareFans.map((p) => toWorld(p, REST_POINTS.FLARE_TIP))
  const phonePts = phones.map((p) => toWorld(p, REST_POINTS.PHONE))
  const flagHand = toWorld(flagFan, REST_POINTS.HAND_R)

  return { people, flares, phones: phonePts, flagHand, teamCount: team.length }
}
