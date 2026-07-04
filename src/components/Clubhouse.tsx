import { PITCH, COLORS } from '../utils/constants'

export function Clubhouse() {
  const x = PITCH.width / 2 + 2.5

  return (
    <group position={[x, 0, 0]}>
      {/* Main building */}
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[2.5, 1.5, 3]} />
        <meshLambertMaterial color="#e8e0d0" />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 1.65, 0]}>
        <boxGeometry args={[2.8, 0.3, 3.3]} />
        <meshLambertMaterial color={COLORS.red} />
      </mesh>
      {/* Door */}
      <mesh position={[-1.251, 0.5, 0]}>
        <boxGeometry args={[0.02, 1, 0.6]} />
        <meshLambertMaterial color={COLORS.deepBlack} />
      </mesh>
    </group>
  )
}
