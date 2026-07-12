import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────
// v13-X3: Statisches Schatten-System. Die Szene ist (bis auf
// Schunkel-Amplituden) statisch — deshalb wird die Shadow-Map nur
// wenige Male gebacken (autoUpdate=false) und kostet danach NICHTS
// pro Frame. Caster werden per Traversal aktiviert: alle opaken
// Standard-Meshes; Basic-/transparente Materialien (Karten, Glows,
// Scrims, Wimpel) bleiben außen vor. Empfänger sind nur Ground und
// Pitch — Empfangen kostet Shader-Samples, also gezielt.
// Bakes zeitversetzt (0.7s/2.5s/6s/12s), damit async geladene
// Assets (Bäume, Ball) im Schattenbild landen.
// ─────────────────────────────────────────────────────────────

export function StaticShadows() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFSoftShadowMap
    gl.shadowMap.autoUpdate = false

    const enableCasters = () => {
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        const mat = m.material as THREE.Material
        if (Array.isArray(m.material)) return
        if ((mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) return
        if (mat.transparent) return
        m.castShadow = true
      })
    }

    const bakeAt = [700, 2500, 6000, 12000].map((ms) =>
      setTimeout(() => {
        enableCasters()
        gl.shadowMap.needsUpdate = true
      }, ms),
    )
    return () => {
      bakeAt.forEach(clearTimeout)
      gl.shadowMap.autoUpdate = true
    }
  }, [gl, scene])

  return null
}
