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
  // v10-E1: hochauflösend (1280×288 ≈ Banner-Proportion) → scharf.
  cv.width = 1280; cv.height = 288
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#8f1620' // CI: Banner-Slot in Vereinsrot
  ctx.fillRect(0, 0, 1280, 288)
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 8
  ctx.setLineDash([30, 20]); ctx.strokeRect(28, 28, 1224, 232); ctx.setLineDash([])
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.font = '800 128px Archivo, system-ui, sans-serif'
  ctx.fillText('DEIN BANNER?', 640, 128)
  ctx.font = '700 44px Archivo, system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText('WERDE SPONSOR · PER WHATSAPP', 640, 214)
  bannerTex = new THREE.CanvasTexture(cv)
  bannerTex.colorSpace = THREE.SRGBColorSpace
  bannerTex.anisotropy = 16
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
        // v10-E1: klar VOR das Gitter (x=−0.07, Platzseite), größer, leicht
        // selbstleuchtend + renderOrder → Maschendraht verdeckt die Werbung
        // nicht mehr.
        <mesh position={[-0.07, 0.31, 0.1]} rotation-y={-Math.PI / 2} renderOrder={3}>
          <planeGeometry args={[0.92, 0.2]} />
          <meshStandardMaterial map={bannerTex2} emissiveMap={bannerTex2} emissive="#ffffff" emissiveIntensity={0.22} roughness={0.75} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

export function BallStopFence() {
  // v9-E3 (Referenzfoto dji_…0181): der Ost-Ballfangzaun ist DURCHGEHEND,
  // KEINE Öffnung (die v8-Lücke war falsch). Der Kamera-Anflug zur
  // Vereinsheim-Tür führt jetzt NÖRDLICH um das Zaun-Ende herum („um die
  // Ecke", s. camera/partyPath.ts) — die Tür sitzt am linken/hinteren
  // Gebäudeteil, nördlich des Zauns. Beide Seiten wieder EIN Panel.
  return (
    <group>
      <FencePanel x={FENCE_X} zCenter={-0.45} width={WIDTH} banner />
      <FencePanel x={-FENCE_X} zCenter={0} width={WIDTH} />
    </group>
  )
}
