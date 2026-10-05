import { useEffect, lazy, Suspense } from 'react'
import { useStore } from './store/useStore'
import { detectWebGL, prefersReducedMotion } from './utils/caps'
import { useScrollProgress } from './ui/useScrollProgress'
import { StaticBackdrop } from './ui/StaticBackdrop'
import { StageBoundary } from './ui/StageBoundary'

// 3D-Bühne lazy → three/R3F landen in einem eigenen Chunk, den der
// Fallback-Pfad (kein WebGL / reduced-motion) nie lädt.
const Stage = lazy(() => import('./components/Stage').then((m) => ({ default: m.Stage })))
import { Sections } from './ui/Sections'
import { Brandbar } from './ui/Brandbar'
// v18-T: SpieltagLeiste = MatchdayBar, mit ?vorfuehrung=1 die Vorführ-Leiste
import { SpieltagLeiste } from './ui/VorfuehrungsLeiste'
import { ScrollHint } from './ui/ScrollHint'
import { PlayerModal } from './ui/PlayerModal'
import { FanLightbox } from './ui/FanLightbox'
import { PerfOverlay } from './ui/PerfOverlay'
import { PartyDirector } from './ui/PartyDirector'
import { Letterbox } from './ui/Letterbox'
import { FxPanel } from './ui/FxPanel'
import { AudioManager } from './audio/AudioManager'
import { MapView, MapPoster } from './map/MapView'
import { MapPanel } from './map/MapPanel'
import { initNavFromUrl, useMapRouting } from './map/nav'
import { Intro } from './map/IntroOverlay'
import { useTourTopToMap } from './map/intro'

// v16-K: Deep-Link (/#training, /mannschaft, /#rundgang …) VOR dem ersten
// Render auswerten → die Karte öffnet direkt den richtigen Ort.
initNavFromUrl()

export default function App() {
  const fallback = useStore((s) => s.fallback)
  const setCaps = useStore((s) => s.setCaps)
  const setReady = useStore((s) => s.setReady)
  const ready = useStore((s) => s.ready)
  const setGateOpen = useStore((s) => s.setGateOpen)
  const togglePerf = useStore((s) => s.togglePerf)
  const toggleFxPanel = useStore((s) => s.toggleFxPanel)
  const gateOpen = useStore((s) => s.gateOpen)
  const soundOn = useStore((s) => s.soundOn)
  const mode = useStore((s) => s.mode)

  useMapRouting()

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

  // v16-K: Das Eingangstor ist weg — die Karte (Poster + Marker) ist sofort
  // da. „Tor offen" heißt jetzt: Bühne bereit (Audio, Partyraum-Vorladen).
  useEffect(() => {
    if (ready) setGateOpen(true)
  }, [ready, setGateOpen])

  // Debug: „p" = Perf-Overlay, „e" = Kino-Effekt-Panel.
  // NUR im Dev-Build: in Produktion hingen die Hotkeys ungeschützt am window,
  // d. h. jeder Besucher konnte sich mit „p"/„e" die Debug-Panels einblenden
  // (z. B. beim Tippen in einem Feld). import.meta.env.DEV ist zur Build-Zeit
  // konstant → Vite entfernt den Block im Prod-Bundle komplett (dead code).
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea')) return
      if (e.key.toLowerCase() === 'p') togglePerf()
      if (e.key.toLowerCase() === 'e') toggleFxPanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePerf, toggleFxPanel])

  useScrollProgress(!fallback && mode === 'tour')
  // v17-D: ganz oben im Rundgang weiter hochscrollen → zurück auf die Karte
  useTourTopToMap(mode === 'tour')

  // Rundgang beginnt oben (Hero); zurück auf der Karte gibt es keinen Scroll.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [mode])

  // Fanblock: Atmosphäre zieht leicht an (Gemurmel näher) — im Rundgang
  // am Finale, auf der Karte an der Kurve.
  useEffect(() => {
    // v14: nur bei Zustandswechsel melden (vorher bei JEDER Store-Änderung)
    let last: boolean | null = null
    return useStore.subscribe((s2) => {
      const boost = s2.mode === 'tour' ? s2.scrollProgress > 0.88 : s2.place === 'fans'
      if (boost === last) return
      last = boost
      AudioManager.setAtmoBoost(boost)
    })
  }, [])

  return (
    <>
      {fallback ? (
        mode === 'tour' && <StaticBackdrop />
      ) : (
        <StageBoundary>
          <Suspense fallback={null}>
            <Stage />
          </Suspense>
        </StageBoundary>
      )}
      {/* Poster der Karten-Totale: sofort sichtbar, bis die Live-3D-Karte
          steht (im Fallback dauerhaft die Karte). */}
      {(mode === 'map' || !fallback) && <MapPoster />}
      <PartyDirector />
      <Brandbar />
      {/* v15-L: nur im Spieltagsfenster sichtbar, sonst null + 0 Requests */}
      <SpieltagLeiste />
      {mode === 'map' ? <MapView /> : <Sections />}
      {mode === 'map' && <Intro />}
      <MapPanel />
      {!fallback && mode === 'tour' && <ScrollHint />}
      <Letterbox />
      <PlayerModal />
      <FanLightbox />
      <PerfOverlay />
      <FxPanel />
    </>
  )
}
