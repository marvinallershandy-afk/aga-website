import { useMemo } from 'react'
import * as THREE from 'three'
import { AOBlob } from './AOBlob'

// Geräteschuppen an der NW-Ecke (Unterstand mit Bank) — Beleg:
// dji_…142906_0158…/f001, Satellit (oranges Dach NW).
// v19-3D (§2.10.1): vom „Monopoly-Haus" auf Geräteschuppen-Niveau
// aufgewertet (nicht gelöscht): Holz-Bretter-Textur, Dachkante mit
// Überstand + Firstbalken, echte Tür mit Rahmen, kleines warmes Fenster.

const POS = { x: -4.6, z: -4.6 }
const W = 0.78
const D = 0.58
const EAVES = 0.28
const RISE = 0.17

// Vertikale Holzbretter (verwittert) — eine kleine Textur im Modul-Cache.
let plankTex: THREE.CanvasTexture | null = null
function getPlankTexture(): THREE.CanvasTexture {
  if (plankTex) return plankTex
  const cv = document.createElement('canvas')
  cv.width = 96
  cv.height = 64
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#6a5640'
  ctx.fillRect(0, 0, 96, 64)
  for (let x = 0; x < 96; x += 12) {
    const shade = 0.82 + Math.sin(x * 2.3) * 0.12
    ctx.fillStyle = `rgba(${90 * shade},${74 * shade},${52 * shade},1)`
    ctx.fillRect(x, 0, 11, 64)
    // Fuge
    ctx.fillStyle = 'rgba(30,22,14,0.55)'
    ctx.fillRect(x + 11, 0, 1.4, 64)
    // Maserung
    for (let k = 0; k < 4; k++) {
      ctx.strokeStyle = `rgba(40,30,18,${0.1 + Math.random() * 0.12})`
      ctx.lineWidth = 0.6
      const yy = Math.random() * 64
      ctx.beginPath()
      ctx.moveTo(x, yy)
      ctx.bezierCurveTo(x + 4, yy + 2, x + 8, yy - 2, x + 11, yy + 1)
      ctx.stroke()
    }
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(2, 1)
  t.anisotropy = 4
  plankTex = t
  return plankTex
}

export function BrickHut() {
  const gable = useMemo(() => {
    const half = D / 2 + 0.01
    const s = new THREE.Shape()
    s.moveTo(-half, 0); s.lineTo(half, 0); s.lineTo(0, RISE); s.closePath()
    return new THREE.ShapeGeometry(s)
  }, [])
  const roofA = Math.atan2(RISE, D / 2)
  const slab = Math.hypot(D / 2 + 0.09, RISE + 0.02)
  const plank = getPlankTexture()

  return (
    <group position={[POS.x, 0, POS.z]} rotation-y={0.35}>
      {/* Bretterwand-Korpus */}
      <mesh position={[0, EAVES / 2, 0]}>
        <boxGeometry args={[W, EAVES, D]} />
        <meshStandardMaterial map={plank} color="#8a7050" roughness={0.95} />
      </mesh>
      {/* Giebel */}
      <mesh geometry={gable} position={[W / 2, EAVES, 0]} rotation-y={Math.PI / 2}>
        <meshStandardMaterial color="#5a4632" roughness={0.95} />
      </mesh>
      <mesh geometry={gable} position={[-W / 2, EAVES, 0]} rotation-y={-Math.PI / 2}>
        <meshStandardMaterial color="#51402d" roughness={0.95} />
      </mesh>
      {/* Dach mit Überstand (ragt über die Wände) + dunkle Dachpappe */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, EAVES + RISE / 2, s * (D / 4 + 0.015)]} rotation-x={-s * roofA}>
          <boxGeometry args={[W + 0.14, 0.03, slab]} />
          <meshStandardMaterial color="#2b2824" roughness={0.9} metalness={0.05} />
        </mesh>
      ))}
      {/* Firstbalken */}
      <mesh position={[0, EAVES + RISE + 0.012, 0]}>
        <boxGeometry args={[W + 0.16, 0.02, 0.04]} />
        <meshStandardMaterial color="#1f1c18" roughness={0.9} />
      </mesh>
      {/* Tür mit Rahmen (leicht eingelassen) */}
      <group position={[-0.12, 0, D / 2 + 0.002]}>
        <mesh position={[0, 0.115, 0]}>
          <planeGeometry args={[0.2, 0.23]} />
          <meshStandardMaterial color="#3a2c1c" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.112, 0.004]}>
          <planeGeometry args={[0.16, 0.2]} />
          <meshStandardMaterial color="#4a3a26" roughness={0.85} />
        </mesh>
        {/* senkrechte Brett-Fuge auf der Tür */}
        <mesh position={[0, 0.112, 0.006]}>
          <planeGeometry args={[0.006, 0.2]} />
          <meshStandardMaterial color="#2a2014" roughness={0.9} />
        </mesh>
        {/* Klinke */}
        <mesh position={[0.05, 0.11, 0.008]}>
          <boxGeometry args={[0.02, 0.012, 0.008]} />
          <meshStandardMaterial color="#20201f" metalness={0.5} roughness={0.5} />
        </mesh>
      </group>
      {/* kleines warmes Fenster neben der Tür */}
      <mesh position={[0.2, 0.16, D / 2 + 0.003]}>
        <planeGeometry args={[0.12, 0.1]} />
        <meshStandardMaterial color="#e2ded2" roughness={0.85} />
      </mesh>
      <mesh position={[0.2, 0.16, D / 2 + 0.005]}>
        <planeGeometry args={[0.1, 0.08]} />
        <meshStandardMaterial color="#ffb765" emissive="#ff9d3f" emissiveIntensity={1.0} toneMapped={false} />
      </mesh>
      {/* Bank davor */}
      <mesh position={[0.3, 0.05, D / 2 + 0.14]}>
        <boxGeometry args={[0.3, 0.02, 0.08]} />
        <meshStandardMaterial color="#6f5838" roughness={0.9} />
      </mesh>
      {[-0.12, 0.12].map((x) => (
        <mesh key={x} position={[0.3 + x, 0.025, D / 2 + 0.14]}>
          <boxGeometry args={[0.02, 0.05, 0.06]} />
          <meshStandardMaterial color="#4a3a24" roughness={0.9} />
        </mesh>
      ))}
      <AOBlob position={[0, 0.005 - 0.02, 0]} scale={[W + 0.8, D + 0.8]} opacity={0.55} />
    </group>
  )
}
