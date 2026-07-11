import { useMemo } from 'react'
import * as THREE from 'three'

// Abenddämmerungs-Himmel als Gradient-Dome. Dunkel oben, warmer
// Horizont — passt zur Flutlicht-Stimmung.
export function SkyGradient() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 512
    const ctx = canvas.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 0, 512)
    // v13-F1: Zenit einen Hauch geöffnet — auf Mobil füllte der fast
    // schwarze Himmel große Flächen über den Stationen („Deckel"-Gefühl).
    g.addColorStop(0.0, '#0e1224')   // Zenit dunkles Nachtblau
    g.addColorStop(0.35, '#1a2038')  // Nachtblau
    g.addColorStop(0.6, '#2c2340')   // violetter Übergang
    g.addColorStop(0.8, '#5a3a3a')   // warmer Dunst
    g.addColorStop(0.92, '#3a2622')  // Horizont bräunlich
    g.addColorStop(1.0, '#181018')   // Erdanschluss
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 2, 512)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])

  return (
    <mesh scale={[1, 1, 1]}>
      <sphereGeometry args={[90, 24, 16]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  )
}
