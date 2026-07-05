import { useMemo } from 'react'
import * as THREE from 'three'

// Gebakener Kontaktschatten: ein geteiltes Radial-Gradient-Sprite
// als flache Plane unter Objekten. Schwebende Objekte sind der
// #1-Amateur-Verräter — das hier erdet alles für ~0 Kosten.

let shared: THREE.CanvasTexture | null = null
function getTexture() {
  if (shared) return shared
  const cv = document.createElement('canvas')
  cv.width = cv.height = 128
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64)
  g.addColorStop(0, 'rgba(0,0,0,0.85)')
  g.addColorStop(0.55, 'rgba(0,0,0,0.4)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  shared = new THREE.CanvasTexture(cv)
  return shared
}

let sharedGlow: THREE.CanvasTexture | null = null
function getGlowTexture() {
  if (sharedGlow) return sharedGlow
  const cv = document.createElement('canvas')
  cv.width = cv.height = 128
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  sharedGlow = new THREE.CanvasTexture(cv)
  return sharedGlow
}

interface Props {
  position: [number, number, number]
  scale: [number, number] // Welt-Größe x/z
  opacity?: number
}

export function AOBlob({ position, scale, opacity = 0.55 }: Props) {
  const tex = useMemo(getTexture, [])
  return (
    <mesh rotation-x={-Math.PI / 2} position={position} renderOrder={1}>
      <planeGeometry args={scale} />
      <meshBasicMaterial map={tex} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  )
}

/** Gebakene Licht-Lache am Boden (additiv, weicher Radial-Verlauf). */
export function LightPool({ position, scale, color, opacity = 0.3 }: Props & { color: string }) {
  const tex = useMemo(getGlowTexture, [])
  return (
    <mesh rotation-x={-Math.PI / 2} position={position} renderOrder={2}>
      <planeGeometry args={scale} />
      <meshBasicMaterial
        map={tex} color={color} transparent opacity={opacity}
        depthWrite={false} blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}
