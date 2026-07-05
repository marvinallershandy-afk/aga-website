import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PITCH } from '../utils/constants'
import { floodLevels } from '../three/floodState'

let dotTex: THREE.CanvasTexture | null = null
function getDotTexture() {
  if (dotTex) return dotTex
  const cv = document.createElement('canvas')
  cv.width = cv.height = 32
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 16)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.6, 'rgba(255,255,255,0.4)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 32, 32)
  dotTex = new THREE.CanvasTexture(cv)
  return dotTex
}

// Dezenter Staub in den Lichtkegeln: EIN Points-Draw (240 Punkte),
// Opacity hängt am Flutlicht-Level, langsame Drift über die Zeit
// (ambient, nicht Erzähl-relevant → darf zeitbasiert sein).

const PER_MAST = 60

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function ConeDust() {
  const matRef = useRef<THREE.PointsMaterial>(null)
  const geo = useMemo(() => {
    const rng = mulberry32(99)
    const hw = PITCH.width / 2 + 1.7
    const hh = PITCH.height / 2 + 1.7
    const heads: [number, number][] = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]
    const pos: number[] = []
    for (const [mx, mz] of heads) {
      const head = new THREE.Vector3(mx, 5.2, mz)
      const base = new THREE.Vector3(mx * 0.35, 0.2, mz * 0.35)
      for (let i = 0; i < PER_MAST; i++) {
        const t = Math.pow(rng(), 0.7) // dichter am Kopf
        const p = head.clone().lerp(base, t)
        const spread = 0.15 + t * 1.5
        p.x += (rng() - 0.5) * spread
        p.y += (rng() - 0.5) * spread * 0.6
        p.z += (rng() - 0.5) * spread
        pos.push(p.x, p.y, p.z)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return g
  }, [])

  useFrame((state) => {
    if (!matRef.current) return
    const lvl = (floodLevels[0] + floodLevels[1] + floodLevels[2] + floodLevels[3]) / 4
    const pulse = 0.85 + Math.sin(state.clock.elapsedTime * 0.7) * 0.15
    matRef.current.opacity = 0.28 * lvl * pulse
  })

  return (
    <points geometry={geo}>
      <pointsMaterial
        ref={matRef}
        map={getDotTexture()}
        alphaTest={0.01}
        color="#ffe2ae"
        size={0.035}
        sizeAttenuation
        transparent
        opacity={0.28}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
