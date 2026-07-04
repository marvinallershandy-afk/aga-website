import { useMemo } from 'react'
import * as THREE from 'three'
import { PITCH, COLORS } from '../utils/constants'

// Vier Flutlichtmasten in den Ecken. Emissive Lampenköpfe + je ein
// warmer SpotLight aufs Feld → Abendspiel-Stimmung. Bewusst wenige
// echte Lichter (Budget); der Rest ist gefakte Emission.
const MAST_H = 5.2

function Mast({ x, z, target }: { x: number; z: number; target: THREE.Object3D }) {
  const headTilt = Math.atan2(z, x)
  return (
    <group position={[x, 0, z]}>
      {/* Mast */}
      <mesh position={[0, MAST_H / 2, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.1, MAST_H, 8]} />
        <meshStandardMaterial color="#2a2a30" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Lampenträger */}
      <group position={[0, MAST_H, 0]} rotation={[0, -headTilt, 0]}>
        <mesh position={[0, 0.15, -0.35]}>
          <boxGeometry args={[1.4, 0.5, 0.12]} />
          <meshStandardMaterial color="#17171b" metalness={0.6} roughness={0.5} />
        </mesh>
        {/* 6 leuchtende Lampen */}
        {[-0.5, 0, 0.5].map((lx) =>
          [-0.12, 0.12].map((ly) => (
            <mesh key={`${lx}-${ly}`} position={[lx, 0.15 + ly, -0.42]}>
              <boxGeometry args={[0.36, 0.22, 0.06]} />
              <meshStandardMaterial
                color={COLORS.floodWarm}
                emissive={COLORS.floodWarm}
                emissiveIntensity={3.2}
                toneMapped={false}
              />
            </mesh>
          )),
        )}
      </group>
      {/* Ein echter Spot pro Mast */}
      <spotLight
        position={[0, MAST_H + 0.1, 0]}
        target={target}
        angle={0.62}
        penumbra={0.6}
        distance={26}
        intensity={190}
        color={COLORS.floodWarm}
        castShadow={false}
      />
    </group>
  )
}

export function Floodlights() {
  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(0, 0, 0)
    return o
  }, [])

  const hw = PITCH.width / 2 + 1.6
  const hh = PITCH.height / 2 + 1.6

  return (
    <group>
      <primitive object={target} />
      <Mast x={-hw} z={-hh} target={target} />
      <Mast x={hw} z={-hh} target={target} />
      <Mast x={-hw} z={hh} target={target} />
      <Mast x={hw} z={hh} target={target} />
    </group>
  )
}
