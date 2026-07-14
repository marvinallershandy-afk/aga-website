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
