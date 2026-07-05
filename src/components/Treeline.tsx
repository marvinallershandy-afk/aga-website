import { useMemo } from 'react'
import * as THREE from 'three'

// Ersetzt die v1-Kugel-Bäume: zwei dunkle, gezackte Baumreihen-
// Silhouetten-Ringe rund um den Platz. Unlit (Basic-Material),
// der abgestufte Fog erledigt Tiefe und Weichheit. 2 Draw-Calls.

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildRing(seed: number, radius: number, hMin: number, hMax: number): THREE.BufferGeometry {
  const rng = mulberry32(seed)
  const N = 200
  // Geclusterte Kronen-Höhen: Basisprofil + Nachbar-Glättung
  const raw = Array.from({ length: N }, () => hMin + rng() * (hMax - hMin))
  const h = raw.map((_, i) => (raw[(i + N - 1) % N] + raw[i] * 2 + raw[(i + 1) % N]) / 4)

  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    const r = radius + (rng() - 0.5) * 1.6
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    pos.push(x, -0.3, z)      // unten (leicht im Boden)
    pos.push(x, h[i], z)      // Kronenkante
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2
    const b = ((i + 1) % N) * 2
    idx.push(a, b, a + 1, b, b + 1, a + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  return g
}

export function Treeline() {
  const inner = useMemo(() => buildRing(11, 15, 1.4, 2.6), [])
  const outer = useMemo(() => buildRing(23, 19, 2.2, 4.2), [])
  return (
    <group>
      <mesh geometry={inner}>
        <meshBasicMaterial color="#0e150f" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={outer}>
        <meshBasicMaterial color="#0a0f0b" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
