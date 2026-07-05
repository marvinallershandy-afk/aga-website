import { useMemo } from 'react'
import * as THREE from 'three'
import { COLORS } from '../utils/constants'
import { AOBlob, LightPool } from './AOBlob'

// ─────────────────────────────────────────────────────────────
// Das echte Vereinsheim (Mehrzweckhalle) nach REFERENZ_MODELL:
// langgestreckt HINTER dem Ost-Tor, weiße Fassade, flaches dunkles
// Satteldach mit Ziegel-Schornstein, flacher Anbau zur Platzseite
// mit blauem Fascia-Band, blauer Tür und warmen Fenstern, davor
// Terrasse mit Biertisch-Andeutung. Maßstabsgetreu (~42 m lang).
// Beleg: dji_…0155…/f020.jpg, Bildschirmfoto…13.24.16.png
// ─────────────────────────────────────────────────────────────

export const CLUBHOUSE_POS = { x: 7.15, z: -0.3 } as const

const LEN = 4.2      // Länge entlang z (Nord-Süd)
const DEPTH = 0.85
const EAVES = 0.34   // Traufhöhe
const RISE = 0.24    // Firstanhebung
const ANNEX_H = 0.24
const ANNEX_D = 0.3

function GableEnds() {
  const geo = useMemo(() => {
    const half = DEPTH / 2 + 0.01
    const shape = new THREE.Shape()
    shape.moveTo(-half, 0)
    shape.lineTo(half, 0)
    shape.lineTo(0, RISE)
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [])
  return (
    <>
      <mesh geometry={geo} position={[0, EAVES, LEN / 2]} rotation-y={Math.PI / 2}>
        <meshStandardMaterial color="#c9c5ba" roughness={0.95} />
      </mesh>
      <mesh geometry={geo} position={[0, EAVES, -LEN / 2]} rotation-y={-Math.PI / 2}>
        <meshStandardMaterial color="#b5b1a6" roughness={0.95} />
      </mesh>
    </>
  )
}

export function Clubhouse() {
  const slabLen = Math.hypot(DEPTH / 2 + 0.12, RISE + 0.04)
  const roofA = Math.atan2(RISE, DEPTH / 2)

  return (
    <group position={[CLUBHOUSE_POS.x, 0, CLUBHOUSE_POS.z]}>
      {/* Hauptkorpus — weiße Fassade */}
      <mesh position={[0, EAVES / 2, 0]}>
        <boxGeometry args={[DEPTH, EAVES, LEN]} />
        <meshStandardMaterial color="#d6d2c6" roughness={0.92} />
      </mesh>
      <GableEnds />
      {/* Flaches Satteldach (First entlang z) */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * (DEPTH / 4 + 0.03), EAVES + RISE / 2 + 0.015, 0]}
          rotation-z={s * roofA}
        >
          <boxGeometry args={[slabLen, 0.05, LEN + 0.25]} />
          <meshStandardMaterial color="#26262a" roughness={0.8} metalness={0.1} />
        </mesh>
      ))}
      {/* Ziegel-Schornstein */}
      <mesh position={[0, EAVES + RISE + 0.1, 0.55]}>
        <boxGeometry args={[0.16, 0.28, 0.2]} />
        <meshStandardMaterial color="#7a4030" roughness={0.95} />
      </mesh>
      {/* dunkles Fensterband auf der Platz-Fassade (Obergeschoss) */}
      <mesh position={[-DEPTH / 2 - 0.004, 0.26, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[LEN - 0.5, 0.09]} />
        <meshStandardMaterial color="#1c2026" roughness={0.5} metalness={0.2} />
      </mesh>

      {/* Flacher Anbau zur Platzseite (Westen) mit blauem Fascia-Band */}
      <group position={[-DEPTH / 2 - ANNEX_D / 2, 0, 0.4]}>
        <mesh position={[0, ANNEX_H / 2, 0]}>
          <boxGeometry args={[ANNEX_D, ANNEX_H, LEN * 0.55]} />
          <meshStandardMaterial color="#ccc8bd" roughness={0.92} />
        </mesh>
        {/* blaues Fascia-Band (Dachkante des Anbaus) */}
        <mesh position={[0, ANNEX_H + 0.015, 0]}>
          <boxGeometry args={[ANNEX_D + 0.03, 0.035, LEN * 0.55 + 0.03]} />
          <meshStandardMaterial color="#3d6e9e" roughness={0.6} />
        </mesh>
        {/* warme Fenster + blaue Tür (zum Platz) */}
        {[-0.75, -0.25, 0.35].map((z) => (
          <mesh key={z} position={[-ANNEX_D / 2 - 0.004, 0.13, z]} rotation-y={-Math.PI / 2}>
            <planeGeometry args={[0.22, 0.12]} />
            <meshStandardMaterial
              color="#ffb765" emissive="#ff9d3f" emissiveIntensity={1.6}
              toneMapped={false} roughness={1}
            />
          </mesh>
        ))}
        <mesh position={[-ANNEX_D / 2 - 0.004, 0.1, 0.85]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[0.12, 0.2]} />
          <meshStandardMaterial color="#2f5d8a" roughness={0.8} />
        </mesh>
      </group>

      {/* Terrasse: zwei Biertisch-Andeutungen */}
      {[-0.1, 0.9].map((z) => (
        <group key={z} position={[-DEPTH / 2 - ANNEX_D - 0.25, 0, z]}>
          <mesh position={[0, 0.075, 0]}>
            <boxGeometry args={[0.14, 0.02, 0.5]} />
            <meshStandardMaterial color="#8a6a42" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.035, 0]}>
            <boxGeometry args={[0.04, 0.07, 0.44]} />
            <meshStandardMaterial color="#5a4630" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* warmes Licht vor dem Anbau (gebakene Lache) + Erdung */}
      <LightPool position={[-DEPTH / 2 - 0.55, -0.011, 0.4]} scale={[2, 2.6]} color="#ff9d4a" opacity={0.26} />
      <AOBlob position={[-0.05, -0.012, 0]} scale={[DEPTH + 1.4, LEN + 1]} opacity={0.6} />

      {/* Fahnenmasten (SVA rot-schwarz + gedimmte zweite) */}
      {[{ z: -1.6, flag: COLORS.red }, { z: -1.95, flag: '#2c2c30' }].map(({ z, flag }, i) => (
        <group key={i} position={[-DEPTH / 2 - 0.5, 0, z]}>
          <mesh position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.012, 0.016, 0.84, 6]} />
            <meshStandardMaterial color="#c8ccd2" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0.07, 0.76, 0]}>
            <planeGeometry args={[0.14, 0.09]} />
            <meshStandardMaterial color={flag} side={THREE.DoubleSide} roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
