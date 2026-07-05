import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { cameraState, ballRollAt } from '../camera/CameraPath'

// Der Ball auf dem Anstoßpunkt. Beim Anstoß (Signature-Beat) rollt er
// scroll-getrieben vom Punkt an der Kamera vorbei — Position/Rotation
// sind reine Funktionen des Fahrt-Parameters u (rückwärts identisch).
// DRACO-komprimiert (665 KB), lokaler Decoder in /draco.
const MODEL_URL = '/models/football.glb'

// glb-Rohgröße ~111 Einheiten ⌀ → Ziel: stilisierte ~1 m
const SCALE = 0.0009
const RADIUS = 0.05 // halbe Ziel-Größe (für Abrollwinkel)

const START = new THREE.Vector3(0, RADIUS + 0.02, 0)
const END = new THREE.Vector3(1.05, RADIUS + 0.02, 3.4) // rollt rechts an der Kamera vorbei

const _pos = new THREE.Vector3()

export function Football() {
  const ref = useRef<THREE.Group>(null)
  const idleSpin = useRef(0)
  const { scene } = useGLTF(MODEL_URL, '/draco/')

  useFrame((_, delta) => {
    const g = ref.current
    if (!g) return
    const r = ballRollAt(cameraState.u)
    if (r <= 0) {
      // Ruhe auf dem Punkt: dezente Dauerdrehung
      idleSpin.current += delta * 0.3
      g.position.copy(START)
      g.rotation.set(0, idleSpin.current, 0)
      return
    }
    // Anstoß: Ease-In-Roll, Abrollwinkel aus zurückgelegter Distanz
    const e = r * r * (3 - 2 * r)
    _pos.lerpVectors(START, END, e)
    g.position.copy(_pos)
    const dist = START.distanceTo(_pos)
    const dir = Math.atan2(END.x - START.x, END.z - START.z)
    g.rotation.set(0, dir, 0)
    g.rotateX(dist / RADIUS)
  })

  return (
    <group ref={ref} position={[0, RADIUS + 0.02, 0]} scale={SCALE}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload(MODEL_URL, '/draco/')
