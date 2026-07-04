import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PITCH, COLORS } from '../utils/constants'

// Vier Eckfahnen in SVA-Rot, die im Abendwind leicht wehen.
function Flag({ x, z }: { x: number; z: number }) {
  const flagRef = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    if (!flagRef.current) return
    const t = s.clock.elapsedTime
    flagRef.current.rotation.y = Math.sin(t * 2 + x + z) * 0.25
    flagRef.current.scale.x = 1 + Math.sin(t * 3 + x) * 0.06
  })
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.44, 6]} />
        <meshStandardMaterial color="#ddd" metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh ref={flagRef} position={[0.09, 0.38, 0]}>
        <planeGeometry args={[0.18, 0.12]} />
        <meshStandardMaterial color={COLORS.red} side={THREE.DoubleSide} roughness={0.7} emissive={COLORS.red} emissiveIntensity={0.15} />
      </mesh>
    </group>
  )
}

export function CornerFlags() {
  const hw = PITCH.width / 2
  const hh = PITCH.height / 2
  return (
    <group>
      <Flag x={-hw} z={-hh} />
      <Flag x={hw} z={-hh} />
      <Flag x={-hw} z={hh} />
      <Flag x={hw} z={hh} />
    </group>
  )
}
