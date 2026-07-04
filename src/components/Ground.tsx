import { GROUND_SIZE } from '../utils/constants'
import { COLORS } from '../theme/tokens'

// Dunkler Umraum-Rasen rund um den Platz, geht im Fog unter.
export function Ground() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <meshStandardMaterial color={COLORS.grassDark} roughness={1} metalness={0} />
    </mesh>
  )
}
