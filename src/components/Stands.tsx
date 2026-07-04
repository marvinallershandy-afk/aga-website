import { useMemo } from 'react'
import { PITCH, COLORS } from '../utils/constants'

// Angedeutete Tribüne (eine Längsseite) + umlaufende Bande/Werbe-
// banden in SVA-Farben. Bewusst simpel & low-poly.
export function Stands() {
  const hw = PITCH.width / 2
  const hh = PITCH.height / 2

  // Bande: Segmente entlang der vier Seiten, abwechselnd Rot/Schwarz.
  const boards = useMemo(() => {
    const items: { pos: [number, number, number]; size: [number, number, number]; red: boolean }[] = []
    const seg = 1.0
    const push = (x: number, z: number, sx: number, sz: number, i: number) =>
      items.push({ pos: [x, 0.14, z], size: [sx, 0.28, sz], red: i % 2 === 0 })
    // lange Seiten
    let i = 0
    for (let x = -hw + seg / 2; x < hw; x += seg) {
      push(x, -hh - 0.5, seg * 0.94, 0.08, i++)
      push(x, hh + 0.5, seg * 0.94, 0.08, i++)
    }
    // kurze Seiten
    for (let z = -hh + seg / 2; z < hh; z += seg) {
      push(-hw - 0.5, z, 0.08, seg * 0.94, i++)
      push(hw + 0.5, z, 0.08, seg * 0.94, i++)
    }
    return items
  }, [hw, hh])

  // Tribüne auf der hinteren Längsseite (z negativ)
  const tiers = 5
  const standZ = -hh - 2.2

  return (
    <group>
      {/* Bande */}
      {boards.map((b, i) => (
        <mesh key={i} position={b.pos}>
          <boxGeometry args={b.size} />
          <meshStandardMaterial
            color={b.red ? COLORS.red : COLORS.black}
            emissive={b.red ? COLORS.red : '#000'}
            emissiveIntensity={b.red ? 0.12 : 0}
            roughness={0.6}
          />
        </mesh>
      ))}

      {/* Gestufte Tribüne */}
      <group position={[0, 0, standZ]}>
        {Array.from({ length: tiers }).map((_, t) => (
          <mesh key={t} position={[0, 0.18 + t * 0.28, -t * 0.42]}>
            <boxGeometry args={[PITCH.width + 2, 0.28, 0.5]} />
            <meshStandardMaterial color={t % 2 ? '#2b2b31' : '#232329'} roughness={0.9} />
          </mesh>
        ))}
        {/* Rückwand */}
        <mesh position={[0, 1.1, -tiers * 0.42 - 0.2]}>
          <boxGeometry args={[PITCH.width + 2.4, 2.2, 0.15]} />
          <meshStandardMaterial color={COLORS.deepBlack} roughness={1} />
        </mesh>
        {/* Dach */}
        <mesh position={[0, 2.15, -tiers * 0.21]} rotation={[0.18, 0, 0]}>
          <boxGeometry args={[PITCH.width + 2.6, 0.08, tiers * 0.55]} />
          <meshStandardMaterial color={COLORS.black} metalness={0.3} roughness={0.7} />
        </mesh>
        {/* Roter Dachrand-Akzent */}
        <mesh position={[0, 1.98, tiers * 0.21 - 0.02]}>
          <boxGeometry args={[PITCH.width + 2.6, 0.1, 0.06]} />
          <meshStandardMaterial color={COLORS.red} emissive={COLORS.red} emissiveIntensity={0.3} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
