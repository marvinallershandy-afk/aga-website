import { useMemo } from 'react'
import * as THREE from 'three'
import { PITCH } from '../utils/constants'
import { AOBlob } from './AOBlob'

// Tore mit echter Netz-Andeutung: prozedurale Gitter-Textur auf
// schräger Rück-Plane + zwei Seiten-Dreiecken. Pfosten aus v1.

const NET_DEPTH = 0.16

let netTex: THREE.CanvasTexture | null = null
function getNetTexture() {
  if (netTex) return netTex
  const cv = document.createElement('canvas')
  cv.width = cv.height = 64
  const ctx = cv.getContext('2d')!
  ctx.clearRect(0, 0, 64, 64)
  ctx.strokeStyle = 'rgba(225,232,240,0.75)'
  ctx.lineWidth = 1.6
  for (let i = 0; i <= 64; i += 8) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 64); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(64, i); ctx.stroke()
  }
  netTex = new THREE.CanvasTexture(cv)
  netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping
  return netTex
}

function sideGeometry(mirror: boolean): THREE.BufferGeometry {
  // Dreieck: Pfosten oben → Pfosten unten → Netz-Boden hinten
  const g = new THREE.BufferGeometry()
  const z = mirror ? 1 : -1
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    0, PITCH.goalHeight, 0,
    0, 0, 0,
    NET_DEPTH, 0, 0,
  ].map((v, i) => (i % 3 === 2 ? v * z : v)), 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0], 2))
  g.computeVertexNormals()
  return g
}

function Goal({ side }: { side: 1 | -1 }) {
  const x = (PITCH.width / 2) * side
  const gw = PITCH.goalWidth / 2
  const gh = PITCH.goalHeight
  const postR = 0.028
  const tex = useMemo(getNetTexture, [])
  const sideL = useMemo(() => sideGeometry(false), [])
  const sideR = useMemo(() => sideGeometry(true), [])
  const slant = Math.hypot(NET_DEPTH, gh)

  return (
    <group position={[x, 0, 0]} rotation-y={side > 0 ? 0 : Math.PI}>
      {/* Pfosten + Latte */}
      {[-gw, gw].map((z) => (
        <mesh key={z} position={[0, gh / 2, z]}>
          <cylinderGeometry args={[postR, postR, gh, 8]} />
          <meshStandardMaterial color="#e8ecf0" metalness={0.55} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, gh, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[postR, postR, PITCH.goalWidth, 8]} />
        <meshStandardMaterial color="#e8ecf0" metalness={0.55} roughness={0.35} />
      </mesh>
      {/* Netz: schräge Rückwand */}
      <mesh
        position={[NET_DEPTH / 2, gh / 2, 0]}
        rotation={[0, Math.PI / 2, Math.atan2(NET_DEPTH, gh)]}
      >
        <planeGeometry args={[PITCH.goalWidth, slant]} />
        <meshBasicMaterial map={tex} transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Netz: Seiten-Dreiecke */}
      {[{ g: sideL, z: -gw }, { g: sideR, z: gw }].map(({ g, z }, i) => (
        <mesh key={i} geometry={g} position={[0, 0, z]} rotation-y={-Math.PI / 2 + Math.PI / 2}>
          <meshBasicMaterial map={tex} transparent side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      <AOBlob position={[0.04, 0.004, 0]} scale={[0.6, PITCH.goalWidth + 0.3]} opacity={0.4} />
    </group>
  )
}

export function Goals() {
  return (
    <group>
      <Goal side={1} />
      <Goal side={-1} />
    </group>
  )
}
