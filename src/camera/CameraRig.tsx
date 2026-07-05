import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import { sampleFlight, scrollToU, cameraState } from './CameraPath'

// Scroll-getriebene Kamerafahrt. Der Ziel-Fortschritt kommt aus dem
// Store (DOM-Scroll). Wir dämpfen ihn zeitbasiert → cinematisches
// Nachziehen statt 1:1-Ruckeln, Nutzer bleibt aber jederzeit Herr
// über die Richtung (kein Scroll-Hijacking).
// DEV: feste Kamera via ?cam=x,y,z,lx,ly,lz (für Referenz-Vergleichspaare)
const devCam = (() => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('cam')
  if (!raw) return null
  const v = raw.split(',').map(Number)
  return v.length === 6 && v.every((n) => !isNaN(n)) ? v : null
})()

export function CameraRig() {
  const camera = useThree((s) => s.camera)
  const smoothed = useRef(0)
  const pos = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())
  const currentLook = useRef(new THREE.Vector3(0, 0.4, 0))

  useFrame((state, delta) => {
    // Partyraum: Kamera in der Pocket-Dimension (Schnitt via Dip-to-Black)
    if (useStore.getState().partyOpen) {
      const t = state.clock.elapsedTime
      camera.position.set(0.72 + Math.sin(t * 0.22) * 0.04, -39.5, 0.9)
      camera.lookAt(-0.05, -39.65, -1.2)
      return
    }
    if (devCam) {
      camera.position.set(devCam[0], devCam[1], devCam[2])
      camera.lookAt(devCam[3], devCam[4], devCam[5])
      cameraState.u = 1 // Flutlicht voll an für Vergleichsbilder
      return
    }
    const target = scrollToU(useStore.getState().scrollProgress)
    // zeitbasierte Dämpfung (frameratenunabhängig)
    smoothed.current = THREE.MathUtils.damp(smoothed.current, target, 4, delta)
    cameraState.u = smoothed.current // für Flutlicht/Ball/Staub (Anstoß)

    sampleFlight(smoothed.current, pos.current, look.current)

    // dezenter Idle-Sway für Lebendigkeit
    const t = state.clock.elapsedTime
    const sway = 1 - smoothed.current * 0.6 // oben mehr, unten ruhiger
    pos.current.x += Math.sin(t * 0.18) * 0.14 * sway
    pos.current.y += Math.sin(t * 0.23 + 1.3) * 0.08 * sway

    camera.position.copy(pos.current)
    currentLook.current.lerp(look.current, 0.12)
    camera.lookAt(currentLook.current)
  })

  return null
}
