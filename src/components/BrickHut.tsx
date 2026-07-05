import { useMemo } from 'react'
import * as THREE from 'three'
import { AOBlob } from './AOBlob'

// Rote Klinker-Hütte mit Ziegel-Satteldach an der NW-Ecke
// (Geräte/Unterstand mit Bank) — Beleg: dji_…142906_0158…/f001,
// Satellit (oranges Dach NW).

const POS = { x: -4.6, z: -4.6 }
const W = 0.75
const D = 0.55
const EAVES = 0.26
const RISE = 0.16

export function BrickHut() {
  const gable = useMemo(() => {
    const half = D / 2 + 0.01
    const s = new THREE.Shape()
    s.moveTo(-half, 0); s.lineTo(half, 0); s.lineTo(0, RISE); s.closePath()
    return new THREE.ShapeGeometry(s)
  }, [])
  const roofA = Math.atan2(RISE, D / 2)
  const slab = Math.hypot(D / 2 + 0.06, RISE + 0.02)

  return (
    <group position={[POS.x, 0, POS.z]} rotation-y={0.35}>
      {/* Klinker-Korpus */}
      <mesh position={[0, EAVES / 2, 0]}>
        <boxGeometry args={[W, EAVES, D]} />
        <meshStandardMaterial color="#6e3a2c" roughness={0.95} />
      </mesh>
      {/* Giebel */}
      <mesh geometry={gable} position={[W / 2, EAVES, 0]} rotation-y={Math.PI / 2}>
        <meshStandardMaterial color="#62342a" roughness={0.95} />
      </mesh>
      <mesh geometry={gable} position={[-W / 2, EAVES, 0]} rotation-y={-Math.PI / 2}>
        <meshStandardMaterial color="#5a3026" roughness={0.95} />
      </mesh>
      {/* Ziegeldach */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, EAVES + RISE / 2, s * (D / 4 + 0.015)]} rotation-x={-s * roofA}>
          <boxGeometry args={[W + 0.12, 0.035, slab]} />
          <meshStandardMaterial color="#8a4434" roughness={0.9} />
        </mesh>
      ))}
      {/* offene blaue Tür (warm erleuchtet) */}
      <mesh position={[0, 0.11, D / 2 + 0.004]}>
        <planeGeometry args={[0.14, 0.22]} />
        <meshStandardMaterial color="#ffb765" emissive="#ff9d3f" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      {/* Bank davor */}
      <mesh position={[0.28, 0.05, D / 2 + 0.12]}>
        <boxGeometry args={[0.3, 0.02, 0.08]} />
        <meshStandardMaterial color="#7a6244" roughness={0.9} />
      </mesh>
      <AOBlob position={[0, 0.005 - 0.02, 0]} scale={[W + 0.7, D + 0.7]} opacity={0.55} />
    </group>
  )
}
