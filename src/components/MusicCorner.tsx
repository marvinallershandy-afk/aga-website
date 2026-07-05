import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { AudioManager } from '../audio/AudioManager'
import { LightPool } from './AOBlob'

// ─────────────────────────────────────────────────────────────
// Die Musik-Ecke: die Klinker-Hütte (NW) bekommt eine Rolle —
// Boombox auf der Bank, Cover-Poster an der Wand, warmes Licht.
// Die Boombox-Speaker pulsieren, wenn Musik läuft (dezent).
// Verankert die Musik-Sektion in der Welt statt im UI-Chip.
// ─────────────────────────────────────────────────────────────

// Position/Rotation der Hütte (BrickHut): (-4.6, -4.6) rot 0.35
const HUT = { x: -4.6, z: -4.6, rot: 0.35 }

export function MusicCorner() {
  const cover = useTexture('/audio/cover.jpg')
  cover.colorSpace = THREE.SRGBColorSpace
  const speakerL = useRef<THREE.Mesh>(null)
  const speakerR = useRef<THREE.Mesh>(null)

  const speakerMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1a171a',
        emissive: '#e91d29',
        emissiveIntensity: 0.4,
        roughness: 0.6,
      }),
    [],
  )

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const playing = AudioManager.playing
    const pulse = playing ? 1 + Math.sin(t * 7.4) * 0.08 + Math.sin(t * 11.7) * 0.04 : 1
    speakerL.current?.scale.setScalar(pulse)
    speakerR.current?.scale.setScalar(pulse * (playing ? 1.02 : 1))
    speakerMat.emissiveIntensity = playing ? 0.9 + Math.sin(t * 7.4) * 0.35 : 0.35
  })

  return (
    <group position={[HUT.x, 0, HUT.z]} rotation-y={HUT.rot}>
      {/* Boombox auf der Bank (Bank steht bei x 0.28, z D/2+0.12≈0.4) */}
      <group position={[0.28, 0.075, 0.42]} rotation-y={0.15}>
        <mesh>
          <boxGeometry args={[0.22, 0.09, 0.07]} />
          <meshStandardMaterial color="#232026" roughness={0.5} metalness={0.3} />
        </mesh>
        {/* Speaker */}
        <mesh ref={speakerL} position={[-0.065, 0, 0.037]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.028, 0.028, 0.008, 12]} />
          <primitive object={speakerMat} attach="material" />
        </mesh>
        <mesh ref={speakerR} position={[0.065, 0, 0.037]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.028, 0.028, 0.008, 12]} />
          <primitive object={speakerMat} attach="material" />
        </mesh>
        {/* Griff */}
        <mesh position={[0, 0.055, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.006, 0.006, 0.12, 5]} />
          <meshStandardMaterial color="#3a3d42" roughness={0.5} />
        </mesh>
      </group>

      {/* warmes Licht um die Musik-Ecke */}
      <LightPool position={[0.3, 0.006, 0.5]} scale={[1.6, 1.4]} color="#ff9d4a" opacity={0.22} />

      {/* Cover-Poster an der Hüttenwand (zum Platz) */}
      <group position={[-0.24, 0.16, 0.281]}>
        <mesh position={[0, 0, -0.003]}>
          <planeGeometry args={[0.17, 0.17]} />
          <meshStandardMaterial color="#0e0b0c" roughness={0.8} />
        </mesh>
        <mesh>
          <planeGeometry args={[0.15, 0.15]} />
          <meshStandardMaterial map={cover} roughness={0.75} emissive="#442026" emissiveIntensity={0.25} />
        </mesh>
      </group>
    </group>
  )
}
