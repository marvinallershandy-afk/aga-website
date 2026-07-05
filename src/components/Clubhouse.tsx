import { useMemo } from 'react'
import * as THREE from 'three'
import { PITCH, COLORS } from '../utils/constants'
import { AOBlob, LightPool } from './AOBlob'

// Vereinsheim in Halbdistanz: dunkle Wände, Satteldach mit Überstand,
// warm leuchtende Fenster — liest sich als "Leben im Verein", nicht
// als Spielzeugkiste. Details verschwimmen bewusst im Fog.

const X = PITCH.width / 2 + 3.4
const BODY_W = 2.6
const BODY_H = 1.25
const BODY_D = 3.4
const ROOF_A = 0.48 // Dachneigung

function GableEnds() {
  const geo = useMemo(() => {
    const half = BODY_W / 2 + 0.02
    const rise = Math.tan(ROOF_A) * half
    const shape = new THREE.Shape()
    shape.moveTo(-half, 0)
    shape.lineTo(half, 0)
    shape.lineTo(0, rise)
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [])
  return (
    <>
      <mesh geometry={geo} position={[0, BODY_H, BODY_D / 2]}>
        <meshStandardMaterial color="#3a3531" roughness={0.95} />
      </mesh>
      <mesh geometry={geo} position={[0, BODY_H, -BODY_D / 2]} rotation-y={Math.PI}>
        <meshStandardMaterial color="#3a3531" roughness={0.95} />
      </mesh>
    </>
  )
}

export function Clubhouse() {
  const half = BODY_W / 2
  const rise = Math.tan(ROOF_A) * half
  const slabLen = Math.hypot(half + 0.3, rise + Math.tan(ROOF_A) * 0.3)

  return (
    <group position={[X, 0, 0]}>
      {/* Korpus */}
      <mesh position={[0, BODY_H / 2, 0]}>
        <boxGeometry args={[BODY_W, BODY_H, BODY_D]} />
        <meshStandardMaterial color="#413c36" roughness={0.95} />
      </mesh>
      <GableEnds />
      {/* Satteldach mit Überstand */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * (half + 0.3) * 0.5, BODY_H + rise / 2 + 0.03, 0]}
          rotation-z={-s * ROOF_A}
        >
          <boxGeometry args={[slabLen, 0.07, BODY_D + 0.5]} />
          <meshStandardMaterial color="#232022" roughness={0.85} metalness={0.15} />
        </mesh>
      ))}
      {/* Roter First-Akzent */}
      <mesh position={[0, BODY_H + rise + 0.05, 0]}>
        <boxGeometry args={[0.09, 0.05, BODY_D + 0.5]} />
        <meshStandardMaterial color={COLORS.red} emissive={COLORS.red} emissiveIntensity={0.25} roughness={0.6} />
      </mesh>
      {/* Warm leuchtende Fenster + Tür (zum Platz hin) */}
      {[-1.05, -0.35, 0.55].map((z) => (
        <mesh key={z} position={[-half - 0.005, 0.68, z]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[0.42, 0.34]} />
          <meshStandardMaterial
            color="#ffb765" emissive="#ff9d3f" emissiveIntensity={1.7}
            toneMapped={false} roughness={1}
          />
        </mesh>
      ))}
      <mesh position={[-half - 0.005, 0.42, 1.25]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.34, 0.84]} />
        <meshStandardMaterial color="#171412" roughness={1} />
      </mesh>
      {/* Warmes "Streulicht" als gebakene Licht-Lache statt echtem
          Licht (jedes zusätzliche Licht kostet ALLE Materialien) */}
      <LightPool position={[-half - 0.8, 0.008 - 0.02, 0]} scale={[2.4, 2.8]} color="#ff9d4a" opacity={0.28} />
      <AOBlob position={[0, 0.006 - 0.02, 0]} scale={[BODY_W + 1.6, BODY_D + 1.6]} opacity={0.6} />
    </group>
  )
}
