import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// ─────────────────────────────────────────────────────────────
// Waldrand aus echten CC0-Bäumen (v7-E1): Kenney „Nature Kit" (CC0),
// Kiefern in EINEM Pack-Stil. Als InstancedMesh je Variante (1 Draw-
// Call/Variante statt Wald aus Einzel-Meshes) — Perf-Leitplanke.
// Steht als dimensionaler Saum VOR der bestehenden Silhouetten-
// Treeline (Tiefe). Nacht-Tönung: Blätter → Waldgrün, Rinde → Braun,
// damit die teal-grünen Pack-Farben ins SVA-Abendbild passen.
// Kompass: +x Ost, +z Süd, Nord (−z) offen zum Dorf.
// Lizenz: ASSETS_CREDITS.md
// ─────────────────────────────────────────────────────────────

const MODELS = [
  '/models/tree_pineDefaultA.glb',
  '/models/tree_pineDefaultB.glb',
  '/models/tree_pineRoundA.glb',
]

const LEAF = new THREE.Color('#425c30') // Waldgrün (liest bei Nacht, ohne Tag-Optik)
const BARK = new THREE.Color('#46331f') // dunkle Rinde, warm

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// GLB (2 Primitives: Blätter + Rinde) → EINE Geometrie mit gebackenen
// Nacht-Vertex-Colors, damit die Variante als 1 InstancedMesh läuft.
function bakeTree(scene: THREE.Object3D): THREE.BufferGeometry {
  scene.updateMatrixWorld(true)
  const geos: THREE.BufferGeometry[] = []
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const g = m.geometry.clone()
    g.applyMatrix4(m.matrixWorld)
    const mat = m.material as THREE.MeshStandardMaterial
    const name = (mat.name || '').toLowerCase()
    const isLeaf = name.includes('leaf') || name.includes('leafs')
    const base = isLeaf ? LEAF : name.includes('wood') || name.includes('bark') ? BARK : null
    // Fallback: helle Ausgangsfarbe = Blätter, dunkle = Rinde
    const src = base ?? (mat.color && mat.color.g > mat.color.r ? LEAF : BARK)
    const n = g.attributes.position.count
    const colors = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      colors[i * 3] = src.r
      colors[i * 3 + 1] = src.g
      colors[i * 3 + 2] = src.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    for (const k of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k)
    }
    geos.push(g)
  })
  return mergeGeometries(geos, false)
}

interface Placement {
  variant: number
  x: number
  z: number
  rot: number
  scale: number
}

function usePlacements(): Placement[] {
  return useMemo(() => {
    const rng = mulberry32(4711)
    const out: Placement[] = []
    const RINGS = [
      { r: 11.4, count: 82, sMin: 1.3, sMax: 2.0 }, // naher Saum, dicht (~2–3 m)
      { r: 15.5, count: 46, sMin: 1.8, sMax: 2.8 }, // hintere, höhere Reihe
    ]
    for (const ring of RINGS) {
      for (let i = 0; i < ring.count; i++) {
        const a = (i / ring.count) * Math.PI * 2 + (rng() - 0.5) * 0.06
        const z0 = Math.sin(a)
        // Nord-Lücke (−z) offen zum Dorf: dort keine Bäume
        if (z0 < -0.34) continue
        const r = ring.r + (rng() - 0.5) * 1.7
        out.push({
          variant: Math.floor(rng() * MODELS.length),
          x: Math.cos(a) * r,
          z: z0 * r,
          rot: rng() * Math.PI * 2,
          scale: ring.sMin + rng() * (ring.sMax - ring.sMin),
        })
      }
    }
    return out
  }, [])
}

export function ForestTrees() {
  const gltfs = useGLTF(MODELS)
  const placements = usePlacements()

  const geometries = useMemo(
    () => gltfs.map((g) => bakeTree(g.scene.clone(true))),
    [gltfs],
  )

  // Instanz-Matrizen je Variante bündeln
  const perVariant = useMemo(() => {
    const buckets: THREE.Matrix4[][] = MODELS.map(() => [])
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    const up = new THREE.Vector3(0, 1, 0)
    for (const pl of placements) {
      q.setFromAxisAngle(up, pl.rot)
      s.setScalar(pl.scale)
      p.set(pl.x, -0.05, pl.z)
      buckets[pl.variant].push(m.clone().compose(p, q, s))
    }
    return buckets
  }, [placements])

  // Kontaktschatten (v7-E2): flache AO-Scheibe unter jedem Baum, damit
  // der Saum am Boden klebt statt zu schweben — EIN InstancedMesh, ~0 Kosten.
  const aoTex = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 64
    const ctx = cv.getContext('2d')!
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32)
    g.addColorStop(0, 'rgba(0,0,0,0.7)')
    g.addColorStop(0.6, 'rgba(0,0,0,0.3)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(cv)
  }, [])
  const aoMatrices = useMemo(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    return placements.map((pl) => {
      const rad = 0.7 + pl.scale * 0.7
      s.set(rad, rad, rad)
      p.set(pl.x, 0.02, pl.z)
      return m.clone().compose(p, q, s)
    })
  }, [placements])

  return (
    <group>
      {/* Kontaktschatten-Scheiben (erst, damit Bäume darüber liegen) */}
      <instancedMesh
        args={[undefined, undefined, aoMatrices.length]}
        renderOrder={1}
        ref={(inst) => {
          if (!inst) return
          aoMatrices.forEach((mm, i) => inst.setMatrixAt(i, mm))
          inst.instanceMatrix.needsUpdate = true
        }}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={aoTex} transparent depthWrite={false} opacity={0.5} />
      </instancedMesh>

      {geometries.map((geo, vi) => {
        const mats = perVariant[vi]
        if (!mats.length) return null
        return (
          <instancedMesh
            key={vi}
            args={[geo, undefined, mats.length]}
            ref={(inst) => {
              if (!inst) return
              mats.forEach((mm, i) => inst.setMatrixAt(i, mm))
              inst.instanceMatrix.needsUpdate = true
            }}
          >
            <meshStandardMaterial vertexColors roughness={0.92} metalness={0} />
          </instancedMesh>
        )
      })}
    </group>
  )
}

MODELS.forEach((m) => useGLTF.preload(m))
