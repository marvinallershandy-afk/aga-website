import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// Der Held des Platzes: football.glb auf dem Anstoßpunkt, langsam
// rotierend. DRACO-komprimiert (665 KB), lokaler Decoder in /draco.
const MODEL_URL = '/models/football.glb'

export function Football() {
  const ref = useRef<THREE.Group>(null)
  const { scene } = useGLTF(MODEL_URL, '/draco/')

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.35
  })

  return (
    <group ref={ref} position={[0, 0.12, 0]} scale={0.0022}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload(MODEL_URL, '/draco/')
