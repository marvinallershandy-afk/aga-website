import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { cameraState } from '../camera/CameraPath'
import { COLORS } from '../utils/constants'

// ─────────────────────────────────────────────────────────────
// E4-Finale: Der Rauszoom in die Vogelperspektive macht die ganze
// 3D-Welt zur Standort-Karte. Dieser Marker („Hier sind wir")
// blendet erst am Ende (u→1) über dem Vereinsheim ein:
//   · gepulster Boden-Ring  — aus der Vogelperspektive lesbar
//   · billboard Pin (Tropfen, SVA-Rot) — zeigt auf den Ort
//   · Label „SV Agathenburg-Dollern · Waldsportplatz"
// Der Route-Button lebt weiter im DOM (PlatzFinden). Das Erscheinen
// ist eine reine Funktion von cameraState.u (scroll-reversibel);
// nur das Pulsieren nutzt die Clock. Im Fallback/reduced-motion
// existiert kein 3D → Marker inaktiv, die SVG-Karte trägt.
// ─────────────────────────────────────────────────────────────

const ANCHOR = new THREE.Vector3(7.0, 0, -0.3) // über dem Vereinsheim
const FADE_START = 0.84
const FADE_SPAN = 0.12

function makePinTexture(): THREE.CanvasTexture {
  const W = 160, H = 240
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')!
  ctx.translate(W / 2, 96)
  // Tropfenform (wie der SVG-Marker in PlatzFinden)
  ctx.beginPath()
  ctx.moveTo(0, 130)
  ctx.bezierCurveTo(-58, 44, -62, -12, -62, -40)
  ctx.arc(0, -40, 62, Math.PI, 0, false)
  ctx.bezierCurveTo(62, -12, 58, 44, 0, 130)
  ctx.closePath()
  ctx.fillStyle = COLORS.red
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 16
  ctx.shadowOffsetY = 6
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.lineWidth = 6
  ctx.strokeStyle = '#14100f'
  ctx.stroke()
  // weißer Kern
  ctx.beginPath()
  ctx.arc(0, -40, 22, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function makeLabelTexture(): THREE.CanvasTexture {
  const W = 512, H = 128
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')!
  // Pille
  const r = 26
  ctx.beginPath()
  ctx.moveTo(r, 8)
  ctx.arcTo(W - 4, 8, W - 4, H - 8, r)
  ctx.arcTo(W - 4, H - 8, 4, H - 8, r)
  ctx.arcTo(4, H - 8, 4, 8, r)
  ctx.arcTo(4, 8, W - 4, 8, r)
  ctx.closePath()
  ctx.fillStyle = 'rgba(20,16,15,0.92)'
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = COLORS.red
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.font = '800 34px Archivo, system-ui, sans-serif'
  ctx.fillText('SV AGATHENBURG-DOLLERN', W / 2, 48)
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '600 24px Archivo, system-ui, sans-serif'
  ctx.fillText('Waldsportplatz · Hier sind wir', W / 2, 88)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

export function LocationMarker() {
  const group = useRef<THREE.Group>(null)
  const billboard = useRef<THREE.Group>(null)
  const pinMat = useRef<THREE.MeshBasicMaterial>(null)
  const labelMat = useRef<THREE.MeshBasicMaterial>(null)
  const ringA = useRef<THREE.Mesh>(null)
  const ringB = useRef<THREE.Mesh>(null)
  const pinTex = useMemo(() => makePinTexture(), [])
  const labelTex = useMemo(() => makeLabelTexture(), [])

  useFrame((state) => {
    const g = group.current
    if (!g) return
    const vis = THREE.MathUtils.clamp((cameraState.u - FADE_START) / FADE_SPAN, 0, 1)
    g.visible = vis > 0.002
    if (!g.visible) return
    // Billboard: Pin + Label immer zur Kamera
    if (billboard.current) billboard.current.quaternion.copy(state.camera.quaternion)
    // sanftes Auf/Ab des Pins
    const t = state.clock.elapsedTime
    if (billboard.current) billboard.current.position.y = 1.35 + Math.sin(t * 1.6) * 0.06
    if (pinMat.current) pinMat.current.opacity = vis
    if (labelMat.current) labelMat.current.opacity = vis * 0.96
    // zwei phasenversetzte Boden-Ringe → kontinuierlicher Puls
    const pulse = (mesh: THREE.Mesh | null, phase: number) => {
      if (!mesh) return
      const k = (t * 0.55 + phase) % 1
      const s = 0.55 + k * 1.15
      mesh.scale.set(s, s, s)
      const m = mesh.material as THREE.MeshBasicMaterial
      m.opacity = vis * 0.5 * (1 - k)
    }
    pulse(ringA.current, 0)
    pulse(ringB.current, 0.5)
  })

  return (
    <group ref={group} position={ANCHOR} visible={false}>
      {/* Boden-Puls-Ringe (flach, aus der Vogelperspektive der eigentliche
          Karten-Marker) — zwei phasenversetzt für kontinuierlichen Puls */}
      <mesh ref={ringA} position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.72, 0.92, 48]} />
        <meshBasicMaterial color={COLORS.red} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={ringB} position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.72, 0.92, 48]} />
        <meshBasicMaterial color={COLORS.red} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* statischer Kern-Punkt am Boden */}
      <mesh position={[0, 0.032, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.16, 32]} />
        <meshBasicMaterial color={COLORS.red} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* Billboard-Stapel: Pin + Label */}
      <group ref={billboard} position={[0, 1.35, 0]}>
        <mesh>
          <planeGeometry args={[1.0, 1.5]} />
          <meshBasicMaterial ref={pinMat} map={pinTex} transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh position={[0, 1.15, 0]}>
          <planeGeometry args={[2.1, 0.525]} />
          <meshBasicMaterial ref={labelMat} map={labelTex} transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
