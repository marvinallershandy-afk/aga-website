import * as THREE from 'three'
import { mergeBufferGeometries } from 'three-stdlib'

// ─────────────────────────────────────────────────────────────
// v14-E2 „Menschen 3.0": Die geteilte Low-Poly-Silhouette bekommt,
// was aus Pegs Publikum macht:
//  · FARBZONEN über Vertex-Colors — Beine/Hüfte sind dunkle Hose,
//    Rumpf/Arme sind weiß (= Instanzfarbe zeigt das Trikot). Ein
//    Material, ein Draw-Call, zwei Kleidungszonen.
//  · POSEN-VARIANTEN — idle (hängende Arme), point (eine Faust
//    hoch), cheer (beide Arme im V). Drei Silhouetten statt einer.
//  · HAAR-KAPPE als eigene Geometrie (instanzierbar) — der nackte
//    Kugelkopf ist der stärkste Spielzeug-Marker.
//
// Konvention bleibt: Basis y=0, Körper bis ~0.9, Kopf sitzt bei
// ~1.0 → alle bestehenden Instanz-Matrizen funktionieren.
//
// v14-B: Diese Posen-API bleibt als kompatible Legacy-Schnittstelle
// exportiert; die Kurve nutzt „Menschen 4.0" (getCrowdHumanGeometry,
// weiter unten), der Partyraum nur die Farbpaletten.
// ─────────────────────────────────────────────────────────────

export type HumanPose = 'idle' | 'point' | 'cheer'

const PANTS = new THREE.Color('#232025') // dunkle Hose (Vertex-Farbe)
const CLOTH = new THREE.Color('#ffffff') // Trikot-Zone → Instanzfarbe

function colorize(g: THREE.BufferGeometry, c: THREE.Color) {
  const n = g.getAttribute('position').count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return g
}

const cached: Partial<Record<HumanPose, THREE.BufferGeometry>> = {}

export function getHumanBodyGeometry(pose: HumanPose = 'idle'): THREE.BufferGeometry {
  const hit = cached[pose]
  if (hit) return hit
  const parts: THREE.BufferGeometry[] = []
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, rz = 0, cloth = true) => {
    colorize(g, cloth ? CLOTH : PANTS)
    if (rz) g.rotateZ(rz)
    g.translate(x, y, z)
    parts.push(g)
  }
  // Beine (getrennt → Silhouette liest „steht", nicht „Kegel") — HOSE
  add(new THREE.BoxGeometry(0.095, 0.42, 0.105), -0.062, 0.21, 0, 0, false)
  add(new THREE.BoxGeometry(0.095, 0.42, 0.105), 0.062, 0.21, 0, 0, false)
  // Hüfte — HOSE
  add(new THREE.BoxGeometry(0.245, 0.12, 0.135), 0, 0.47, 0, 0, false)
  // Rumpf: taillierter 7-Kant, in der Tiefe gestaucht → Brustkorb
  const torso = new THREE.CylinderGeometry(0.155, 0.112, 0.32, 7)
  torso.scale(1, 1, 0.78)
  add(torso, 0, 0.69, 0)
  // Hals
  add(new THREE.CylinderGeometry(0.045, 0.058, 0.07, 6), 0, 0.875, 0)

  // Arme je nach Pose — Schulterkugeln bleiben der Übergang Rumpf→Arm
  const arm = () => new THREE.CylinderGeometry(0.038, 0.046, 0.34, 6)
  const shoulder = (sx: number) => add(new THREE.SphereGeometry(0.055, 7, 6), sx, 0.815, 0)
  const armDown = (s: number) => add(arm(), s * 0.205, 0.655, 0, s * 0.12)
  // Arm HOCH: pivotiert an der Schulter, ragt schräg über den Kopf +
  // kleine Faust am Ende (liest als Jubel, nicht als Antenne)
  const armUp = (s: number) => {
    add(arm(), s * 0.245, 0.985, 0, s * (Math.PI - 0.38))
    add(new THREE.SphereGeometry(0.045, 6, 5), s * 0.305, 1.135, 0)
  }
  shoulder(-0.185)
  shoulder(0.185)
  if (pose === 'idle') { armDown(-1); armDown(1) }
  if (pose === 'point') { armDown(-1); armUp(1) }
  if (pose === 'cheer') { armUp(-1); armUp(1) }

  const merged = mergeBufferGeometries(parts)!
  parts.forEach((p) => p.dispose())
  cached[pose] = merged
  return merged
}

// Kopf leicht ellipsoid (weniger „Murmel"), Basis-Konvention y≈1.0
let headGeo: THREE.BufferGeometry | null = null
export function getHumanHeadGeometry(): THREE.BufferGeometry {
  if (headGeo) return headGeo
  const g = new THREE.SphereGeometry(0.088, 8, 7)
  g.scale(1, 1.14, 0.94)
  g.translate(0, 1.0, 0)
  headGeo = g
  return g
}

// Haar-/Mützen-Kappe: abgeflachte Halbkugel oben auf dem Kopf, minimal
// nach hinten gezogen (Haaransatz frei) — per Instanzfarbe Haar ODER
// CI-Beanie. Skala 0 = Glatze.
let hairGeo: THREE.BufferGeometry | null = null
export function getHairCapGeometry(): THREE.BufferGeometry {
  if (hairGeo) return hairGeo
  const g = new THREE.SphereGeometry(0.094, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55)
  g.scale(1, 0.82, 0.98)
  g.translate(0, 1.035, -0.008)
  hairGeo = g
  return g
}

// Farbpaletten für Varianz (deterministisch aus einem rand() gezogen)
export const SKIN_TONES = ['#c99a75', '#b98a66', '#a87757', '#8a5f43', '#d9ab84']
export const HAIR_TONES = ['#2a2320', '#3d2f24', '#171412', '#5a4630', '#8a7355', '#4a4a4e']
export const BEANIE_TONES = ['#c41824', '#1d1a1c', '#d8d4c9']

// ═════════════════════════════════════════════════════════════
// v14-B „Menschen 4.0" — EIN Mensch für die ganze Kurve.
//
// Statt starrer Posen-Silhouetten gibt es jetzt genau eine Rest-Pose-
// Geometrie (Arme hängend), die im Vertex-Shader (crowdMaterial.ts)
// pro Instanz und Frame posiert wird — wie ein Mini-Skelett mit
// 7 Knochen. Alles, was variiert (Frisuren, Kapuze, Jackenkragen,
// Schal, Meisterpokal, Handy, Bengalo), steckt als „Masken-Teil" in
// der Geometrie und wird pro Instanz ein- oder weggeklappt (auf einen
// Punkt kollabiert = degenerierte Dreiecke, kostet praktisch nichts).
// Farben kommen nicht als feste Vertex-Farben, sondern als ZONEN-ID —
// der Shader setzt pro Instanz Trikot, Akzent, Haut, Haar, Hose ein.
//
// Konvention (Körpereinheit H = 1.0 = Scheitel): Boden y=0, Hüftgelenk
// 0.53, Schultern 0.80, Kopfmitte ~0.94. Vorne = +z.
// Ein Draw-Call für die komplette Kurve inkl. Mannschaft.
// ═════════════════════════════════════════════════════════════

export const BONE = { LEGS: 0, SPINE: 1, HEAD: 2, L_UP: 3, L_LOW: 4, R_UP: 5, R_LOW: 6 } as const

export const ZONE = {
  SKIN: 0, MAIN: 1, ACCENT: 2, SLEEVE: 3, PANTS: 4, SHIN: 5, SOCK: 6, SHOE: 7,
  HAIR: 8, SCARF_A: 9, SCARF_B: 10, GOLD: 11, SHOULDER: 12, PHONE: 13, FLARE: 14,
} as const

// Masken: 0 = immer; 1–5 = Frisur-ID; 10 Kapuze; 11 Jacke; 12 Trikotkragen;
// 20+ = Requisit (iStyle.z = Maske − 19)
export const MASK = {
  ALWAYS: 0, HAIR_SHORT: 1, HAIR_LONG: 2, HAIR_BEANIE: 3, HAIR_CAP: 4, HAIR_CURLY: 5,
  HOOD: 10, JACKET: 11, JERSEY: 12,
  SCARF_NECK: 20, SCARF_HELD: 21, TROPHY: 22, PHONE: 23, FLARE: 24,
} as const

export const GARMENT = { JERSEY: 0, HOODIE: 1, JACKET: 2, TEAM: 3 } as const
export const PROP = { NONE: 0, SCARF_NECK: 1, SCARF_HELD: 2, TROPHY: 3, PHONE: 4, FLARE: 5 } as const

// Animations-Modi (Vertex-Shader, crowdMaterial.ts)
export const MOVE = {
  STAND: 0, JUMP_V: 1, CLAP: 2, SCARF: 3, FIST: 4, ARMLOCK: 5, TROPHY: 6,
  HOLD: 7, LEAN: 8, FLAG: 9, PHONE: 10, SIGN: 11, FLARE: 12,
  ARMLOCK_END_L: 13, ARMLOCK_END_R: 14,
} as const

// Skelett-Pivots (Rest-Pose) — identisch im Shader.
export const RIG = {
  HIP: new THREE.Vector3(0, 0.53, 0),
  NECK: new THREE.Vector3(0, 0.855, 0),
  SHOULDER_X: 0.115,
  SHOULDER_Y: 0.8,
  ELBOW_Y: 0.635,
  HAND_Y: 0.455,
} as const

interface PartOpts {
  bone: number
  zone: number
  mask?: number
  /** Zweitknochen für Requisiten zwischen beiden Händen (Schal, Pokal) */
  bone2?: number
  /** Gewicht von bone2 (konstant) oder pro Vertex aus der Rest-Position */
  w?: number | ((x: number, y: number, z: number) => number)
}

function tagPart(g: THREE.BufferGeometry, o: PartOpts): THREE.BufferGeometry {
  const geo = g
  geo.deleteAttribute('uv')
  const pos = geo.getAttribute('position')
  const n = pos.count
  const info = new Float32Array(n * 4)
  const mask = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const w = typeof o.w === 'function' ? o.w(pos.getX(i), pos.getY(i), pos.getZ(i)) : o.w ?? 0
    info[i * 4] = o.bone
    info[i * 4 + 1] = o.bone2 ?? o.bone
    info[i * 4 + 2] = w
    info[i * 4 + 3] = o.zone
    mask[i] = o.mask ?? 0
  }
  geo.setAttribute('aInfo', new THREE.BufferAttribute(info, 4))
  geo.setAttribute('aMask', new THREE.BufferAttribute(mask, 1))
  return geo
}

const v2 = (x: number, y: number) => new THREE.Vector2(x, y)

const crowdGeo: Partial<Record<'high' | 'low', THREE.BufferGeometry>> = {}

/**
 * Die Rest-Pose-Geometrie für alle animierten Menschen (Fans + Team).
 * Attribute: position, normal, aInfo (boneA, boneB, wB, zone), aMask.
 */
export function getCrowdHumanGeometry(lod: 'high' | 'low' = 'high'): THREE.BufferGeometry {
  const hit = crowdGeo[lod]
  if (hit) return hit
  // LOD „low" für die hinteren Reihen: gleiche Knochen/Zonen/Masken,
  // grobere Segmente, ohne Kleinteile (Ohren, Kiefer, Kordeln, Bündchen,
  // Pokal).
  const L = lod === 'low'
  const q = (hi: number, lo: number) => (L ? lo : hi)
  const parts: THREE.BufferGeometry[] = []
  const add = (g: THREE.BufferGeometry, o: PartOpts) => parts.push(tagPart(g, o))
  const { SHOULDER_X: SX, SHOULDER_Y: SY, ELBOW_Y: EY, HAND_Y: HY } = RIG

  // ── Beine: je drei Lathe-Segmente (Socke/Wade · Knie · Oberschenkel),
  //    getrennt, damit Zonengrenzen scharf bleiben (Shorts vs. Jeans).
  for (const s of [-1, 1]) {
    const lx = s * 0.052
    const sock = new THREE.LatheGeometry([v2(0.021, 0.035), v2(0.025, 0.08), v2(0.034, 0.16), v2(0.031, 0.262)], q(6, 4))
    sock.translate(lx, 0, 0)
    add(sock, { bone: BONE.LEGS, zone: ZONE.SOCK })
    const knee = new THREE.LatheGeometry([v2(0.031, 0.26), v2(0.031, 0.3), v2(0.036, 0.335), v2(0.041, 0.372)], q(6, 4))
    knee.translate(lx, 0, 0)
    add(knee, { bone: BONE.LEGS, zone: ZONE.SHIN })
    const thigh = new THREE.LatheGeometry([v2(0.041, 0.37), v2(0.047, 0.42), v2(0.051, 0.48), v2(0.05, 0.535)], q(6, 4))
    thigh.translate(lx, 0, 0)
    add(thigh, { bone: BONE.LEGS, zone: ZONE.PANTS })
    // Schuh: liegende Kapsel, Spitze nach vorn
    const shoe = new THREE.SphereGeometry(0.03, q(6, 4), q(4, 3))
    shoe.scale(0.85, 0.62, 1.75)
    shoe.translate(s * 0.055, 0.019, 0.02)
    add(shoe, { bone: BONE.LEGS, zone: ZONE.SHOE })
  }
  // Becken/Hosenbund (statisch mit den Beinen)
  const pelvis = new THREE.LatheGeometry([v2(0, 0.45), v2(0.06, 0.455), v2(0.09, 0.48), v2(0.097, 0.53), v2(0.094, 0.585)], q(10, 6))
  pelvis.scale(1, 1, 0.72)
  add(pelvis, { bone: BONE.LEGS, zone: ZONE.PANTS })

  // ── Rumpf: taillierter Lathe-Körper, in der Tiefe gestaucht →
  //    Brustkorb, Taille, abfallende Trapez-Linie zum Hals.
  const torso = new THREE.LatheGeometry([
    v2(0.102, 0.53), v2(0.1, 0.56), v2(0.091, 0.61), v2(0.093, 0.66), v2(0.1, 0.72),
    v2(0.101, 0.77), v2(0.095, 0.8), v2(0.077, 0.828), v2(0.046, 0.848), v2(0.03, 0.86),
  ], q(11, 7))
  torso.scale(1, 1, 0.68)
  add(torso, { bone: BONE.SPINE, zone: ZONE.MAIN })
  // Trikotkragen (Trikot + Teamkit)
  const collar = new THREE.TorusGeometry(0.033, 0.0065, 3, q(10, 6))
  collar.rotateX(Math.PI / 2 - 0.3)
  collar.translate(0, 0.849, 0.006)
  add(collar, { bone: BONE.SPINE, zone: ZONE.ACCENT, mask: MASK.JERSEY })
  // Kapuze: weicher Wulst im Nacken + zwei helle Kordeln vorn
  const hood = new THREE.SphereGeometry(0.058, q(8, 5), q(5, 3))
  hood.scale(1.05, 0.62, 0.62)
  hood.translate(0, 0.835, -0.05)
  add(hood, { bone: BONE.SPINE, zone: ZONE.MAIN, mask: MASK.HOOD })
  if (!L) for (const s of [-1, 1]) {
    const cord = new THREE.BoxGeometry(0.0045, 0.055, 0.0045)
    cord.translate(s * 0.017, 0.8, 0.064)
    add(cord, { bone: BONE.SPINE, zone: ZONE.ACCENT, mask: MASK.HOOD })
  }
  // Jacke: Stehkragen + Reißverschluss-Linie
  const jCollar = new THREE.CylinderGeometry(0.041, 0.05, 0.036, q(10, 6), 1, true)
  jCollar.translate(0, 0.856, 0)
  add(jCollar, { bone: BONE.SPINE, zone: ZONE.MAIN, mask: MASK.JACKET })
  const zip = new THREE.BoxGeometry(0.006, 0.27, 0.006)
  zip.translate(0, 0.69, 0.066)
  if (!L) add(zip, { bone: BONE.SPINE, zone: ZONE.ACCENT, mask: MASK.JACKET })
  // Schal um den Hals: Ring + zwei rot-weiß geringelte Enden
  const sRing = new THREE.TorusGeometry(0.04, 0.014, q(5, 3), q(10, 6))
  sRing.rotateX(Math.PI / 2)
  sRing.translate(0, 0.842, 0)
  add(sRing, { bone: BONE.SPINE, zone: ZONE.SCARF_A, mask: MASK.SCARF_NECK })
  for (const [ex, len] of [[-0.026, 4], [0.022, 3]] as const) {
    for (let i = 0; i < len; i++) {
      const seg = new THREE.PlaneGeometry(0.028, 0.03)
      seg.translate(ex, 0.805 - i * 0.03, 0.074 - i * 0.002)
      add(seg, { bone: BONE.SPINE, zone: i % 2 ? ZONE.SCARF_B : ZONE.SCARF_A, mask: MASK.SCARF_NECK })
    }
  }

  // ── Kopf: Hals (dreht mit dem Kopf), leicht ovaler Schädel + Kiefer
  //    nach vorn, Ohren. Bewusst KEIN Gesicht (Kunstrichtung).
  const neck = new THREE.CylinderGeometry(0.028, 0.032, 0.07, q(7, 5), 1, true)
  neck.translate(0, 0.865, 0)
  add(neck, { bone: BONE.HEAD, zone: ZONE.SKIN })
  const skull = new THREE.SphereGeometry(0.06, q(10, 7), q(7, 5))
  skull.scale(0.9, 1.08, 1.0)
  skull.translate(0, 0.942, 0.0)
  add(skull, { bone: BONE.HEAD, zone: ZONE.SKIN })
  const jaw = new THREE.SphereGeometry(0.044, 7, 5)
  jaw.scale(0.95, 0.85, 1.0)
  jaw.translate(0, 0.905, 0.017)
  if (!L) add(jaw, { bone: BONE.HEAD, zone: ZONE.SKIN })
  if (!L) for (const s of [-1, 1]) {
    const ear = new THREE.SphereGeometry(0.013, 4, 3)
    ear.scale(0.45, 1, 0.75)
    ear.translate(s * 0.054, 0.935, -0.002)
    add(ear, { bone: BONE.HEAD, zone: ZONE.SKIN })
  }

  // ── Frisuren (Maske = Frisur-ID)
  const cap = (r: number, thetaLen: number, sx: number, sy: number, sz: number, tilt: number, y: number, z: number) => {
    const g = new THREE.SphereGeometry(r, q(9, 6), q(5, 3), 0, Math.PI * 2, 0, thetaLen)
    g.scale(sx, sy, sz)
    g.rotateX(tilt)
    g.translate(0, y, z)
    return g
  }
  // 1 · kurz: Kappe nach hinten gekippt (Stirn frei, Nacken bedeckt)
  add(cap(0.064, Math.PI * 0.52, 0.92, 0.98, 1.04, -0.42, 0.946, -0.004), { bone: BONE.HEAD, zone: ZONE.HAIR, mask: MASK.HAIR_SHORT })
  // 2 · lang: Kappe + Volumen über den Rücken bis auf die Schultern
  add(cap(0.065, Math.PI * 0.52, 0.94, 1.0, 1.05, -0.38, 0.946, -0.004), { bone: BONE.HEAD, zone: ZONE.HAIR, mask: MASK.HAIR_LONG })
  const back = new THREE.SphereGeometry(0.058, q(7, 5), q(5, 3))
  back.scale(1.0, 1.35, 0.6)
  back.translate(0, 0.895, -0.03)
  add(back, { bone: BONE.HEAD, zone: ZONE.HAIR, mask: MASK.HAIR_LONG })
  // 3 · Mütze: Kuppel + Umschlag-Wulst + Bommel
  add(cap(0.068, Math.PI * 0.5, 0.92, 1.08, 1.02, -0.12, 0.948, -0.002), { bone: BONE.HEAD, zone: ZONE.HAIR, mask: MASK.HAIR_BEANIE })
  const rim = new THREE.TorusGeometry(0.06, 0.011, 3, q(12, 7))
  rim.rotateX(Math.PI / 2)
  rim.scale(0.93, 1, 1.03)
  rim.translate(0, 0.952, -0.002)
  add(rim, { bone: BONE.HEAD, zone: ZONE.HAIR, mask: MASK.HAIR_BEANIE })
  const bommel = new THREE.SphereGeometry(0.018, q(6, 4), 3)
  bommel.translate(0, 1.025, -0.012)
  add(bommel, { bone: BONE.HEAD, zone: ZONE.SCARF_B, mask: MASK.HAIR_BEANIE })
  // 4 · Basecap: Kuppel + halbrunder Schirm nach vorn
  add(cap(0.066, Math.PI * 0.47, 0.93, 0.95, 1.03, -0.05, 0.95, 0), { bone: BONE.HEAD, zone: ZONE.HAIR, mask: MASK.HAIR_CAP })
  const brim = new THREE.CylinderGeometry(0.052, 0.052, 0.006, q(8, 4), 1, false, -Math.PI / 2, Math.PI)
  brim.scale(0.9, 1, 1)
  brim.rotateX(0.14)
  brim.translate(0, 0.958, 0.03)
  add(brim, { bone: BONE.HEAD, zone: ZONE.HAIR, mask: MASK.HAIR_CAP })
  // 5 · Locken/voll: größere Kuppel
  add(cap(0.072, Math.PI * 0.58, 0.95, 0.92, 1.0, -0.3, 0.945, -0.006), { bone: BONE.HEAD, zone: ZONE.HAIR, mask: MASK.HAIR_CURLY })

  // ── Arme: Deltamuskel (Schulterzone → Teamkit schwarz), Ärmel,
  //    Bündchen, Unterarm (Haut bei Kurzarm, Stoff bei Hoodie/Jacke),
  //    Faust. Hängen in der Rest-Pose senkrecht unter dem Pivot.
  for (const s of [-1, 1]) {
    const up = s < 0 ? BONE.L_UP : BONE.R_UP
    const low = s < 0 ? BONE.L_LOW : BONE.R_LOW
    const x = s * SX
    const delt = new THREE.SphereGeometry(0.039, q(7, 5), q(5, 3))
    delt.scale(1.0, 1.0, 0.9)
    delt.translate(x, SY - 0.004, 0)
    add(delt, { bone: up, zone: ZONE.SHOULDER })
    const sleeve = new THREE.CylinderGeometry(0.034, 0.031, 0.1, q(7, 5), 1, true)
    sleeve.translate(x, SY - 0.05, 0)
    add(sleeve, { bone: up, zone: ZONE.MAIN })
    const cuff = new THREE.TorusGeometry(0.031, 0.0055, 3, 8)
    cuff.rotateX(Math.PI / 2)
    cuff.translate(x, SY - 0.1, 0)
    if (!L) add(cuff, { bone: up, zone: ZONE.ACCENT, mask: MASK.JERSEY })
    const lowerUp = new THREE.CylinderGeometry(0.029, 0.026, 0.07, q(7, 5), 1, true)
    lowerUp.translate(x, (SY - 0.1 + EY) / 2, 0)
    add(lowerUp, { bone: up, zone: ZONE.SLEEVE })
    const elbow = new THREE.SphereGeometry(0.026, 6, 4)
    elbow.translate(x, EY, 0)
    if (!L) add(elbow, { bone: low, zone: ZONE.SLEEVE })
    const fore = new THREE.CylinderGeometry(0.0255, 0.021, EY - HY - 0.03, q(7, 5), 1, true)
    fore.translate(x, (EY + HY + 0.03) / 2, 0)
    add(fore, { bone: low, zone: ZONE.SLEEVE })
    const hand = new THREE.SphereGeometry(0.025, q(6, 4), q(4, 3))
    hand.scale(0.85, 1.25, 0.75)
    hand.translate(x, HY, 0.002)
    add(hand, { bone: low, zone: ZONE.SKIN })
  }

  // ── Requisiten ──────────────────────────────────────────────
  // Hochgehaltener Schal: Streifenband zwischen beiden Fäusten.
  // Gewicht linear über x → spannt sich beim Hochreißen zwischen den Händen.
  const segN = q(8, 6)
  for (let i = 0; i < segN; i++) {
    const w = (2 * SX) / segN
    // zweiseitig: zwei Planes Rücken an Rücken (Material bleibt FrontSide)
    for (const back of [false, true]) {
      const seg = new THREE.PlaneGeometry(w + 0.001, 0.05)
      if (back) seg.rotateY(Math.PI)
      seg.translate(-SX + w * (i + 0.5), HY - 0.005, back ? 0.0115 : 0.0125)
      add(seg, {
        bone: BONE.L_LOW, bone2: BONE.R_LOW,
        w: (px) => THREE.MathUtils.clamp((px + SX) / (2 * SX), 0, 1),
        zone: i % 2 ? ZONE.SCARF_B : ZONE.SCARF_A, mask: MASK.SCARF_HELD,
      })
    }
  }
  // Meisterpokal: in der Rest-Pose KOPFÜBER unter den Händen definiert —
  // die Arme drehen beim Hochstemmen um ~π, dann steht er aufrecht über
  // dem Kopf. Gewicht 0.5 = genau zwischen beiden Händen.
  if (!L) {
    const cup = new THREE.LatheGeometry([
      v2(0, 0), v2(0.048, 0), v2(0.05, 0.012), v2(0.03, 0.026), v2(0.012, 0.04), v2(0.011, 0.075),
      v2(0.02, 0.088), v2(0.05, 0.11), v2(0.066, 0.15), v2(0.072, 0.2), v2(0.078, 0.215), v2(0.066, 0.212), v2(0.06, 0.2),
    ], 9)
    const handles: THREE.BufferGeometry[] = []
    for (const s of [-1, 1]) {
      const h = new THREE.TorusGeometry(0.03, 0.007, 4, 6, Math.PI)
      h.rotateZ(s < 0 ? Math.PI / 2 : -Math.PI / 2)
      h.translate(s * 0.068, 0.165, 0)
      handles.push(h)
    }
    const flip = (g: THREE.BufferGeometry) => {
      // etwas größer als „echt" — der Pokal muss aus der Kurvenansicht lesbar sein
      g.translate(0, -0.165, 0)
      g.scale(1.35, 1.35, 1.35)
      g.translate(0, 0.165, 0)
      g.rotateZ(Math.PI) // kopfüber
      g.translate(0, HY + 0.165 + 0.02, 0.0) // Henkelhöhe ≈ Fausthöhe
      return g
    }
    add(flip(cup), { bone: BONE.L_LOW, bone2: BONE.R_LOW, w: 0.5, zone: ZONE.GOLD, mask: MASK.TROPHY })
    for (const h of handles) add(flip(h), { bone: BONE.L_LOW, bone2: BONE.R_LOW, w: 0.5, zone: ZONE.GOLD, mask: MASK.TROPHY })
  }
  // Handy in der rechten Hand (filmt die Feier)
  const phone = new THREE.BoxGeometry(0.022, 0.042, 0.005)
  phone.translate(SX, HY - 0.03, 0.022)
  add(phone, { bone: BONE.R_LOW, zone: ZONE.PHONE, mask: MASK.PHONE })
  // Bengalo-Hülse: ragt in der Rest-Pose nach unten aus der Faust →
  // bei gerecktem Arm senkrecht nach oben. Spitze = FLARE_TIP.
  const flare = new THREE.CylinderGeometry(0.009, 0.01, 0.15, 5)
  flare.translate(SX, HY - 0.06, 0.004)
  add(flare, { bone: BONE.R_LOW, zone: ZONE.FLARE, mask: MASK.FLARE })

  const merged = mergeBufferGeometries(parts)!
  parts.forEach((p) => p.dispose())
  merged.computeBoundingSphere()
  crowdGeo[lod] = merged
  return merged
}

/** Rest-Pose-Punkte (Körpereinheiten) für CPU-Spiegelung statischer Arme */
export const REST_POINTS = {
  FLARE_TIP: new THREE.Vector3(RIG.SHOULDER_X, RIG.HAND_Y - 0.135, 0.004),
  PHONE: new THREE.Vector3(RIG.SHOULDER_X, RIG.HAND_Y - 0.03, 0.03),
  HAND_R: new THREE.Vector3(RIG.SHOULDER_X, RIG.HAND_Y, 0),
} as const
