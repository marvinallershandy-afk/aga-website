import { useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '../store/useStore'

// ─────────────────────────────────────────────────────────────
// Feine Bodennebel-Schicht in der Tiefe (v5 Kino-Ebene, Punkt
// „Licht in der Luft"): drei große, weiche Alpha-Quads knapp über
// dem Rasen an Waldrand/Süd und hinterm Ost-Tor. Gebaked, kein
// Licht, depthWrite aus — 3 Draw-Calls, praktisch gratis.
// ─────────────────────────────────────────────────────────────

function makeMistTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 256
  cv.height = 64
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(128, 32, 4, 128, 32, 120)
  g.addColorStop(0, 'rgba(186,199,214,0.55)')
  g.addColorStop(0.55, 'rgba(186,199,214,0.22)')
  g.addColorStop(1, 'rgba(186,199,214,0)')
  ctx.fillStyle = g
  ctx.save()
  ctx.scale(1, 0.5)
  ctx.translate(0, 32)
  ctx.fillRect(0, 0, 256, 128)
  ctx.restore()
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// v14-E3: einen Hauch präsenter + eine vierte Bahn an der Nord-Seite —
// die Lichtkegel stehen jetzt „in etwas", nicht über blankem Boden.
const SHEETS: { pos: [number, number, number]; scale: [number, number]; opacity: number }[] = [
  { pos: [-2.5, 0.09, 3.6], scale: [7, 1.6], opacity: 0.46 },  // Süd-Reling / Waldrand
  { pos: [-4.8, 0.12, -2.2], scale: [6, 1.8], opacity: 0.4 },  // Nordwest-Tiefe
  { pos: [5.9, 0.1, -1.6], scale: [5, 1.4], opacity: 0.44 },   // hinterm Ost-Tor
  { pos: [1.6, 0.11, -3.4], scale: [6.5, 1.5], opacity: 0.34 }, // Nord-Tiefe
]

export function GroundMist() {
  const on = useStore((s) => s.cinemaFx.mist)
  const tex = useMemo(() => makeMistTexture(), [])
  if (!on) return null
  return (
    <group>
      {SHEETS.map((s, i) => (
        <mesh key={i} position={s.pos} rotation-x={-Math.PI / 2} renderOrder={40}>
          <planeGeometry args={s.scale} />
          <meshBasicMaterial map={tex} transparent opacity={s.opacity} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}
