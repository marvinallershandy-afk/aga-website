import * as THREE from 'three'
import { mergeBufferGeometries } from 'three-stdlib'

// ─────────────────────────────────────────────────────────────
// v13-K2 „Menschen 2.0": EINE geteilte Low-Poly-Menschen-Silhouette
// (~120 Tris) für die instanzierte Kurve und die Detail-Figuren —
// Beine mit Lücke, Hüfte, tailliertem Rumpf, Schultern, hängende
// Arme. Ersetzt den nackten Zylinder („Trichter-Look").
//
// Konvention: Basis bei y=0, Gesamthöhe 0.9 (Kopf sitzt separat bei
// ~1.0 wie bisher) → alle bestehenden Instanz-Matrizen/Skalierungen
// funktionieren unverändert.
// ─────────────────────────────────────────────────────────────

let cached: THREE.BufferGeometry | null = null

export function getHumanBodyGeometry(): THREE.BufferGeometry {
  if (cached) return cached
  const parts: THREE.BufferGeometry[] = []
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, rz = 0) => {
    if (rz) g.rotateZ(rz)
    g.translate(x, y, z)
    parts.push(g)
  }
  // Beine (getrennt → Silhouette liest „steht", nicht „Kegel")
  add(new THREE.BoxGeometry(0.095, 0.42, 0.105), -0.062, 0.21, 0)
  add(new THREE.BoxGeometry(0.095, 0.42, 0.105), 0.062, 0.21, 0)
  // Hüfte
  add(new THREE.BoxGeometry(0.245, 0.12, 0.135), 0, 0.47, 0)
  // Rumpf: taillierter 7-Kant, in der Tiefe gestaucht → Brustkorb
  const torso = new THREE.CylinderGeometry(0.155, 0.112, 0.32, 7)
  torso.scale(1, 1, 0.78)
  add(torso, 0, 0.69, 0)
  // Hals
  add(new THREE.CylinderGeometry(0.045, 0.058, 0.07, 6), 0, 0.875, 0)
  // Arme: hängen leicht abgespreizt
  add(new THREE.CylinderGeometry(0.038, 0.046, 0.34, 6), -0.205, 0.655, 0, 0.12)
  add(new THREE.CylinderGeometry(0.038, 0.046, 0.34, 6), 0.205, 0.655, 0, -0.12)
  // Schulterkugeln (Übergang Rumpf→Arm)
  add(new THREE.SphereGeometry(0.055, 7, 6), -0.185, 0.815, 0)
  add(new THREE.SphereGeometry(0.055, 7, 6), 0.185, 0.815, 0)

  const merged = mergeBufferGeometries(parts)!
  parts.forEach((p) => p.dispose())
  cached = merged
  return merged
}
