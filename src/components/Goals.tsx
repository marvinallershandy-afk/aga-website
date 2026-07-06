import { useMemo } from 'react'
import * as THREE from 'three'
import { PITCH } from '../utils/constants'
import { AOBlob } from './AOBlob'

// Tore mit echter Netz-Andeutung: prozedurale Rauten-Netztextur auf
// schräger Rück-Plane + zwei Seiten-Dreiecken. Pfosten aus v1.
// v5.6 („Tore nicht realistisch"): Maßstab war das Problem — das alte
// Gitter hatte 8 Zellen über die Torbreite = ~90 cm Maschen, das las
// als Drahtmodell. Echte Netze: ~11-12 cm Rautenmaschen. Kachel wird
// jetzt weltmaßstäblich wiederholt (TILE_WORLD), Rauten statt Quadrate.

const NET_DEPTH = 0.16
const TILE_WORLD = 0.072   // Welt-Größe einer Kachel (6 Maschen à ~1,2 cm → ~12 cm real)

let netTex: THREE.CanvasTexture | null = null
function getNetTexture() {
  if (netTex) return netTex
  const N = 128
  const cv = document.createElement('canvas')
  cv.width = cv.height = N
  const ctx = cv.getContext('2d')!
  ctx.clearRect(0, 0, N, N)
  ctx.lineCap = 'round'
  // Rauten: zwei Scharen diagonaler Fäden (±45°), dünn + weich, damit
  // die Masche als geknüpftes Netz liest, nicht als CAD-Gitter.
  const step = N / 6
  const draw = (dir: 1 | -1, color: string, w: number) => {
    ctx.strokeStyle = color
    ctx.lineWidth = w
    for (let k = -6; k <= 12; k++) {
      const o = k * step
      ctx.beginPath()
      ctx.moveTo(o, 0)
      ctx.lineTo(o + dir * N, N)
      ctx.stroke()
    }
  }
  // leichter Doppelton: hellere Kernfäden + dunklerer Schatten-Versatz
  draw(1, 'rgba(210,218,228,0.30)', 2.4)
  draw(-1, 'rgba(210,218,228,0.30)', 2.4)
  draw(1, 'rgba(238,244,250,0.82)', 1.1)
  draw(-1, 'rgba(238,244,250,0.82)', 1.1)
  netTex = new THREE.CanvasTexture(cv)
  netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping
  netTex.anisotropy = 4
  return netTex
}

function sideGeometry(mirror: boolean): THREE.BufferGeometry {
  // Dreieck: Pfosten oben → Pfosten unten → Netz-Boden hinten
  const g = new THREE.BufferGeometry()
  const z = mirror ? 1 : -1
  const gh = PITCH.goalHeight
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    0, gh, 0,
    0, 0, 0,
    NET_DEPTH, 0, 0,
  ].map((v, i) => (i % 3 === 2 ? v * z : v)), 3))
  // UV weltmaßstäblich: vertikal gh, horizontal NET_DEPTH → echte Maschen
  const rv = gh / TILE_WORLD
  const rh = NET_DEPTH / TILE_WORLD
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, rv, 0, 0, rh, 0], 2))
  g.computeVertexNormals()
  return g
}

function Goal({ side }: { side: 1 | -1 }) {
  const x = (PITCH.width / 2) * side
  const gw = PITCH.goalWidth / 2
  const gh = PITCH.goalHeight
  const postR = 0.028
  const tex = useMemo(() => getNetTexture(), [])
  const sideL = useMemo(() => sideGeometry(false), [])
  const sideR = useMemo(() => sideGeometry(true), [])
  const backNet = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      0, gh, -gw,          // Latte links
      0, gh, gw,           // Latte rechts
      NET_DEPTH, 0, gw,    // Boden hinten rechts
      NET_DEPTH, 0, -gw,   // Boden hinten links
    ], 3))
    // UV weltmaßstäblich: u über die Torbreite, v über die Netz-Schräge
    const ru = PITCH.goalWidth / TILE_WORLD
    const rv = Math.hypot(NET_DEPTH, gh) / TILE_WORLD
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, rv, ru, rv, ru, 0, 0, 0], 2))
    g.setIndex([0, 1, 2, 0, 2, 3])
    g.computeVertexNormals()
    return g
  }, [gh, gw])

  return (
    <group position={[x, 0, 0]} rotation-y={side > 0 ? 0 : Math.PI}>
      {/* Pfosten + Latte */}
      {[-gw, gw].map((z) => (
        <mesh key={z} position={[0, gh / 2, z]}>
          <cylinderGeometry args={[postR, postR, gh, 16]} />
          <meshStandardMaterial color="#e8ecf0" metalness={0.55} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, gh, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[postR, postR, PITCH.goalWidth, 16]} />
        <meshStandardMaterial color="#e8ecf0" metalness={0.55} roughness={0.35} />
      </mesh>
      {/* Netz: schräge Rückwand (explizite Geometrie — Latte oben,
          Boden hinten unten; keine Rotations-Akrobatik) */}
      <mesh geometry={backNet}>
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
