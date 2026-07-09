import { Canvas } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { Suspense, useEffect } from 'react'
import * as THREE from 'three'
import { Scene } from './Scene'
import { CameraRig } from '../camera/CameraRig'
import { PerfMonitor } from '../perf/PerfMonitor'
import { CinemaEffects } from '../cinema/CinemaEffects'
import { useStore } from '../store/useStore'
import { getClampedPixelRatio, detectCinemaTier } from '../utils/device'
import { HERO_FRAME } from '../camera/CameraPath'

// Signalisiert "3D fertig geladen", sobald die Suspense-Grenze auflöst.
function ReadyFlag() {
  const setReady = useStore((s) => s.setReady)
  useEffect(() => {
    setReady(true)
  }, [setReady])
  return null
}

// Meldet den drei-Ladefortschritt in den Store (drei bleibt so im
// lazy Stage-Chunk, nicht im Haupt-Bundle des Fallback-Pfads).
//
// WICHTIG: NICHT den `useProgress`-Hook als Selektor abonnieren — drei mutiert
// diesen Store SYNCHRON während des Renderns ladender Komponenten (ForestTrees,
// PartyRoom via useGLTF/useTexture). Ein Hook-Abo würde ProgressReporter
// mitten in deren Render neu einplanen → React-Warnung „Cannot update a
// component while rendering a different component". Stattdessen abonnieren wir
// den drei-Store außerhalb des Renders (in einem Effect) und schreiben von dort
// in unseren Store. Kein setState-in-render mehr.
function ProgressReporter() {
  const setLoadProgress = useStore((s) => s.setLoadProgress)
  useEffect(() => {
    setLoadProgress(useProgress.getState().progress)
    const unsub = useProgress.subscribe((s) => setLoadProgress(s.progress))
    return unsub
  }, [setLoadProgress])
  return null
}

export function Stage() {
  const setCinemaTier = useStore((s) => s.setCinemaTier)
  useEffect(() => {
    setCinemaTier(detectCinemaTier())
  }, [setCinemaTier])
  return (
    <div className="stage-canvas">
      <Canvas
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
        dpr={getClampedPixelRatio(2)}
        camera={{
          fov: 46,
          near: 0.1,
          far: 220,
          position: [HERO_FRAME.pos.x, HERO_FRAME.pos.y, HERO_FRAME.pos.z],
        }}
      >
        <ProgressReporter />
        <Suspense fallback={null}>
          <Scene />
          <ReadyFlag />
        </Suspense>
        <CameraRig />
        <CinemaEffects />
        <PerfMonitor />
      </Canvas>
    </div>
  )
}
