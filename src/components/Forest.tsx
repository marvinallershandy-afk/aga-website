import { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'

// Seeded PRNG for deterministic tree placement
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TREE_COUNT = 120

export function Forest() {
  const canopyRef = useRef<THREE.InstancedMesh>(null)
  const trunkRef = useRef<THREE.InstancedMesh>(null)

  const treeData = useMemo(() => {
    const rng = mulberry32(42)
    const trees: {
      x: number; z: number
      scale: number; canopyScaleY: number
      rotation: number; colorShift: number
    }[] = []

    for (let i = 0; i < TREE_COUNT; i++) {
      const angle = (i / TREE_COUNT) * Math.PI * 2 + (rng() - 0.5) * 0.4
      const radius = 7 + rng() * 6
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius

      // Skip clubhouse zone
      if (x > 5.5 && Math.abs(z) < 3.5) continue

      trees.push({
        x,
        z,
        scale: 0.8 + rng() * 1.0,         // overall 0.8-1.8x
        canopyScaleY: 0.7 + rng() * 0.6,   // squash/stretch canopy for variety
        rotation: rng() * Math.PI * 2,
        colorShift: rng(),
      })
    }
    return trees
  }, [])

  const count = treeData.length

  useEffect(() => {
    if (!canopyRef.current || !trunkRef.current) return

    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const color = new THREE.Color()

    for (let i = 0; i < count; i++) {
      const tree = treeData[i]

      // Trunk — tall cylinder
      const trunkHeight = tree.scale * 0.9
      position.set(tree.x, trunkHeight / 2, tree.z)
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tree.rotation)
      scale.set(tree.scale * 0.5, tree.scale, tree.scale * 0.5)
      matrix.compose(position, quaternion, scale)
      trunkRef.current.setMatrixAt(i, matrix)
      // Warm brown trunk colors
      color.setHSL(0.07 + tree.colorShift * 0.03, 0.35, 0.25 + tree.colorShift * 0.1)
      trunkRef.current.setColorAt(i, color)

      // Canopy — sphere, sitting on top of trunk
      const canopyY = trunkHeight + tree.scale * tree.canopyScaleY * 0.4
      position.set(tree.x, canopyY, tree.z)
      scale.set(
        tree.scale * 1.0,
        tree.scale * tree.canopyScaleY,
        tree.scale * 1.0,
      )
      matrix.compose(position, quaternion, scale)
      canopyRef.current.setMatrixAt(i, matrix)
      // Varied greens — from dark forest green to lighter olive
      color.setHSL(
        0.25 + tree.colorShift * 0.1,        // hue: 0.25-0.35 (green range)
        0.4 + tree.colorShift * 0.2,          // saturation: 0.4-0.6
        0.22 + tree.colorShift * 0.15,        // lightness: 0.22-0.37 (visible greens!)
      )
      canopyRef.current.setColorAt(i, color)
    }

    trunkRef.current.instanceMatrix.needsUpdate = true
    canopyRef.current.instanceMatrix.needsUpdate = true
    if (trunkRef.current.instanceColor) trunkRef.current.instanceColor.needsUpdate = true
    if (canopyRef.current.instanceColor) canopyRef.current.instanceColor.needsUpdate = true
  }, [treeData, count])

  return (
    <group>
      {/* Trunks */}
      <instancedMesh ref={trunkRef} args={[undefined, undefined, count]}>
        <cylinderGeometry args={[0.08, 0.12, 1, 6]} />
        <meshLambertMaterial vertexColors />
      </instancedMesh>

      {/* Canopies — SPHERES for deciduous/Laubbaum look */}
      <instancedMesh ref={canopyRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[0.6, 8, 6]} />
        <meshLambertMaterial vertexColors />
      </instancedMesh>
    </group>
  )
}
