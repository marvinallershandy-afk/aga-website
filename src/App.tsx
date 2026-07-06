import { useEffect, lazy, Suspense } from 'react'
import { useStore } from './store/useStore'
import { detectWebGL, prefersReducedMotion } from './utils/caps'
import { useScrollProgress } from './ui/useScrollProgress'
import { StaticBackdrop } from './ui/StaticBackdrop'

// 3D-Bühne lazy → three/R3F landen in einem eigenen Chunk, den der
// Fallback-Pfad (kein WebGL / reduced-motion) nie lädt.
const Stage = lazy(() => import('./components/Stage').then((m) => ({ default: m.Stage })))
import { Sections } from './ui/Sections'
import { Brandbar } from './ui/Brandbar'
import { ScrollHint } from './ui/ScrollHint'
import { PlayerModal } from './ui/PlayerModal'
import { PerfOverlay } from './ui/PerfOverlay'
import { EntranceGate } from './ui/EntranceGate'
import { PartyDirector } from './ui/PartyDirector'
import { AudioManager } from './audio/AudioManager'

export default function App() {
  const fallback = useStore((s) => s.fallback)
  const setCaps = useStore((s) => s.setCaps)
  const setReady = useStore((s) => s.setReady)
  const togglePerf = useStore((s) => s.togglePerf)
  const gateOpen = useStore((s) => s.gateOpen)
  const soundOn = useStore((s) => s.soundOn)

  // Ton-Schalter → AudioManager (global; Musik selbst lebt im Partyraum)
  useEffect(() => {
    if (!gateOpen) return
    AudioManager.setEnabled(soundOn)
  }, [gateOpen, soundOn])

  // Fähigkeiten einmal ermitteln
  useEffect(() => {
    const webglOK = detectWebGL()
    const reducedMotion = prefersReducedMotion()
    setCaps({ webglOK, reducedMotion })
    if (reducedMotion || !webglOK) setReady(true) // kein 3D-Ladevorgang
  }, [setCaps, setReady])

  // Perf-Overlay toggeln
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p') togglePerf()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePerf])

  useScrollProgress(!fallback)

  // Fanblock-Finale: Atmosphäre zieht leicht an (Gemurmel näher)
  useEffect(() => {
    return useStore.subscribe((s2) => {
      AudioManager.setAtmoBoost(s2.scrollProgress > 0.88)
    })
  }, [])

  return (
    <>
      {fallback ? <StaticBackdrop /> : <Suspense fallback={null}><Stage /></Suspense>}
      <EntranceGate />
      <PartyDirector />
      <Brandbar />
      <Sections />
      {!fallback && <ScrollHint />}
      <PlayerModal />
      <PerfOverlay />
    </>
  )
}
