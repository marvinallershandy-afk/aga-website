import { useMemo } from 'react'
import * as THREE from 'three'
import { PITCH } from '../utils/constants'

// Ballfangzäune hinter beiden Toren (hohe Maschendraht-Wände mit
// dunklen Pfosten) — nach REFERENZ (dji_…0155…/f020, IMG_6082).
// Am Ost-Zaun ein blaues Banner (Referenz: mohr-sports-Platz) als
// neutraler „DEIN BANNER?"-Slot.

const FENCE_X = PITCH.width / 2 + 0.95
const WIDTH = 2.6
const HEIGHT = 0.55

let meshTex: THREE.CanvasTexture | null = null
function getMeshTexture() {
  if (meshTex) return meshTex
  const cv = document.createElement('canvas')
  cv.width = cv.height = 64
  const ctx = cv.getContext('2d')!
  ctx.strokeStyle = 'rgba(150,158,168,0.5)'
  ctx.lineWidth = 1.2
  for (let i = 0; i <= 64; i += 6) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 64); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(64, i); ctx.stroke()
  }
  meshTex = new THREE.CanvasTexture(cv)
  meshTex.wrapS = meshTex.wrapT = THREE.RepeatWrapping
  meshTex.repeat.set(10, 3)
  return meshTex
}

let bannerTex: THREE.CanvasTexture | null = null
function getBannerTexture() {
  if (bannerTex) return bannerTex
  const cv = document.createElement('canvas')
  cv.width = 512; cv.height = 96
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#8f1620' // v5.5 CI-Pass: Banner-Slot in Vereinsrot
  ctx.fillRect(0, 0, 512, 96)
  ctx.fillStyle = '#fff'
  ctx.font = '800 40px Archivo, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('DEIN BANNER?', 256, 52)
  bannerTex = new THREE.CanvasTexture(cv)
  bannerTex.colorSpace = THREE.SRGBColorSpace
  return bannerTex
}

// Ein Zaun-Panel beliebiger Breite an fester x-Ebene, zentriert auf zCenter.
function FencePanel({ x, zCenter, width, banner }: { x: number; zCenter: number; width: number; banner?: boolean }) {
  const tex = useMemo(() => getMeshTexture(), [])
  const bannerTex2 = useMemo(() => getBannerTexture(), [])
  // Pfosten ~0.65 m Abstand
  const n = Math.max(2, Math.round(width / 0.65))
  const posts = Array.from({ length: n + 1 }, (_, i) => -width / 2 + (width * i) / n)
  return (
    <group position={[x, 0, zCenter]}>
      {posts.map((z) => (
        <mesh key={z} position={[0, HEIGHT / 2, z]}>
          <cylinderGeometry args={[0.015, 0.015, HEIGHT, 5]} />
          <meshStandardMaterial color="#2c2f34" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, HEIGHT / 2, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[width, HEIGHT]} />
        <meshBasicMaterial map={tex} transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {banner && (
        <mesh position={[-0.01, 0.3, 0.1]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[0.7, 0.14]} />
          <meshStandardMaterial map={bannerTex2} roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

export function BallStopFence() {
  // West: durchgehendes Panel hinter dem West-Tor.
  // Ost (v8-E2): ZWEI Panels mit Öffnung dazwischen — durch diese Lücke
  // (Welt z≈−0.55) führt der Kamera-Anflug zur nach links verlegten
  // Vereinsheim-Tür (s. camera/partyPath.ts DOOR, Clubhouse.tsx). Das
  // Süd-Panel deckt weiterhin das Tor (z ±0.37); die Öffnung liegt
  // NÖRDLICH davon. Öffnung = Spalt [−0.9 … −0.2].
  return (
    <group>
      <FencePanel x={FENCE_X} zCenter={0.4} width={1.2} banner />
      <FencePanel x={FENCE_X} zCenter={-1.55} width={1.3} />
      <FencePanel x={-FENCE_X} zCenter={0} width={WIDTH} />
    </group>
  )
}
