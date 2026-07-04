import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import { sampleFlight, scrollToU } from './CameraPath'

// Scroll-getriebene Kamerafahrt. Der Ziel-Fortschritt kommt aus dem
// Store (DOM-Scroll). Wir dämpfen ihn zeitbasiert → cinematisches
// Nachziehen statt 1:1-Ruckeln, Nutzer bleibt aber jederzeit Herr
// über die Richtung (kein Scroll-Hijacking).
export function CameraRig() {
  const camera = useThree((s) => s.camera)
  const smoothed = useRef(0)
  const pos = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())
  const currentLook = useRef(new THREE.Vector3(0, 0.4, 0))

  useFrame((state, delta) => {
    const target = scrollToU(useStore.getState().scrollProgress)
    // zeitbasierte Dämpfung (frameratenunabhängig)
    smoothed.current = THREE.MathUtils.damp(smoothed.current, target, 4, delta)

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
