import { useMemo } from 'react'
import * as THREE from 'three'
import { PITCH } from '../utils/constants'

export function PitchLines() {
  const geometry = useMemo(() => {
    const points: number[] = []
    const hw = PITCH.width / 2
    const hh = PITCH.height / 2

    function addLine(x1: number, z1: number, x2: number, z2: number) {
      points.push(x1, 0, z1, x2, 0, z2)
    }

    // Outer boundary
    addLine(-hw, -hh, hw, -hh)
    addLine(hw, -hh, hw, hh)
    addLine(hw, hh, -hw, hh)
    addLine(-hw, hh, -hw, -hh)

    // Center line
    addLine(0, -hh, 0, hh)

    // Penalty areas (both sides)
    const pw = PITCH.penaltyWidth / 2
    const pd = PITCH.penaltyDepth
    // Left
    addLine(-hw, -pw, -hw + pd, -pw)
    addLine(-hw + pd, -pw, -hw + pd, pw)
    addLine(-hw + pd, pw, -hw, pw)
    // Right
    addLine(hw, -pw, hw - pd, -pw)
    addLine(hw - pd, -pw, hw - pd, pw)
    addLine(hw - pd, pw, hw, pw)

    // Goal areas (both sides)
    const gw = PITCH.goalAreaWidth / 2
    const gd = PITCH.goalAreaDepth
    // Left
    addLine(-hw, -gw, -hw + gd, -gw)
    addLine(-hw + gd, -gw, -hw + gd, gw)
    addLine(-hw + gd, gw, -hw, gw)
    // Right
    addLine(hw, -gw, hw - gd, -gw)
    addLine(hw - gd, -gw, hw - gd, gw)
    addLine(hw - gd, gw, hw, gw)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return geo
  }, [])

  // Center circle as separate geometry
  const circleGeometry = useMemo(() => {
    const segments = 48
    const points: number[] = []
    for (let i = 0; i < segments; i++) {
      const a1 = (i / segments) * Math.PI * 2
      const a2 = ((i + 1) / segments) * Math.PI * 2
      points.push(
        Math.cos(a1) * PITCH.centerRadius, 0, Math.sin(a1) * PITCH.centerRadius,
        Math.cos(a2) * PITCH.centerRadius, 0, Math.sin(a2) * PITCH.centerRadius,
      )
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return geo
  }, [])

  return (
    <group position={[0, 0.005, 0]}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color="#ffffff" linewidth={1} />
      </lineSegments>
      <lineSegments geometry={circleGeometry}>
        <lineBasicMaterial color="#ffffff" linewidth={1} />
      </lineSegments>
      {/* Center spot */}
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.05, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}
