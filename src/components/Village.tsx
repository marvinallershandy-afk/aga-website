import { useMemo } from 'react'
import * as THREE from 'three'

// Dorf-Silhouetten an der offenen NORD-Seite (Agathenburg liegt
// hinterm Platz Richtung Schulstraße) — dunkle Giebelhäuser mit
// vereinzelt warm erleuchteten Fenstern, im Fog halb versunken.
// Beleg: dji_…142306_0154…/f001, Satellit.

const HOUSES: { x: number; z: number; w: number; d: number; h: number; rot: number; lit: boolean }[] = [
  { x: -5.5, z: -7.2, w: 1.1, d: 0.8, h: 0.5, rot: 0.15, lit: true },
  { x: -2.8, z: -8.1, w: 1.3, d: 0.9, h: 0.55, rot: -0.1, lit: false },
  { x: 0.2, z: -7.6, w: 1.0, d: 0.75, h: 0.48, rot: 0.3, lit: true },
  { x: 3.1, z: -8.4, w: 1.2, d: 0.85, h: 0.52, rot: -0.2, lit: false },
  { x: 5.8, z: -7.0, w: 0.95, d: 0.7, h: 0.45, rot: 0.4, lit: true },
]

function House({ x, z, w, d, h, rot, lit }: (typeof HOUSES)[number]) {
  const gable = useMemo(() => {
    const half = d / 2
    const s = new THREE.Shape()
    s.moveTo(-half, 0); s.lineTo(half, 0); s.lineTo(0, h * 0.55); s.closePath()
    return new THREE.ShapeGeometry(s)
  }, [d, h])

  return (
    <group position={[x, 0, z]} rotation-y={rot}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#171310" roughness={1} />
      </mesh>
      <mesh geometry={gable} position={[w / 2, h, 0]} rotation-y={Math.PI / 2}>
        <meshStandardMaterial color="#141110" roughness={1} />
      </mesh>
      <mesh geometry={gable} position={[-w / 2, h, 0]} rotation-y={-Math.PI / 2}>
        <meshStandardMaterial color="#141110" roughness={1} />
      </mesh>
      {/* Dach als Prisma-Platten */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[0, h + h * 0.28, s * (d / 4)]}
          rotation-x={-s * Math.atan2(h * 0.55, d / 2)}
        >
          <boxGeometry args={[w + 0.08, 0.03, Math.hypot(d / 2, h * 0.55) + 0.03]} />
          <meshStandardMaterial color="#100d0c" roughness={1} />
        </mesh>
      ))}
      {lit && (
        <mesh position={[0, h * 0.4, d / 2 + 0.004]}>
          <planeGeometry args={[0.1, 0.08]} />
          <meshStandardMaterial color="#ffb765" emissive="#ff9d3f" emissiveIntensity={1.1} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

export function Village() {
  return (
    <group>
      {HOUSES.map((h, i) => (
        <House key={i} {...h} />
      ))}
    </group>
  )
}
