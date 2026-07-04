import { useMemo } from 'react'
import * as THREE from 'three'
import { PITCH } from '../utils/constants'

// Rasen mit Mäh-Streifen (heller/dunkler Wechsel) — der Klassiker,
// der den Platz sofort "echt gepflegt" wirken lässt.
export function Pitch() {
  const texture = useMemo(() => {
    const stripes = 14
    const w = 512
    const h = 512
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#2f6b2a' : '#276022'
      ctx.fillRect((i / stripes) * w, 0, w / stripes + 1, h)
    }
    // feine Rauschkörnung für Textur
    const img = ctx.getImageData(0, 0, w, h)
    for (let p = 0; p < img.data.length; p += 4) {
      const n = (Math.sin(p * 12.9898) * 43758.5453 % 1) * 14 - 7
      img.data[p] += n
      img.data[p + 1] += n
      img.data[p + 2] += n
    }
    ctx.putImageData(img, 0, 0)
    const tex = new THREE.CanvasTexture(canvas)
    tex.anisotropy = 4
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[PITCH.width, PITCH.height]} />
      <meshStandardMaterial map={texture} roughness={0.95} metalness={0} />
    </mesh>
  )
}
