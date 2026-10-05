import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useStore } from '../store/useStore'
import { CLUB } from '../data/content'
import { INTRO_S, endIntro } from './intro'

// ─────────────────────────────────────────────────────────────
// v17-D: Intro-Overlay (erster Besuch). Die Fahrt selbst macht die Kamera
// (CameraRig → introFrame); hier nur Titelzeile, „Überspringen" und eine
// Fortschritts-Haarlinie. Jede Eingabe (Tipp, Rad, Wischen, Taste) bricht
// ab → die Kamera fliegt in 1,2 s in die Totale, die Karte ist da.
// ─────────────────────────────────────────────────────────────

/** Spätestens nach dieser Wartezeit auf die Live-3D gibt es kein Intro. */
const WAIT_MAX_MS = 7000

export function Intro() {
  const intro = useStore((s) => s.intro)
  const stageLive = useStore((s) => s.stageLive)
  const mode = useStore((s) => s.mode)
  const place = useStore((s) => s.place)
  const fallback = useStore((s) => s.fallback)
  const [phase, setPhase] = useState<'idle' | 'title' | 'land'>('idle')

  // Kein 3D (Fallback), Rundgang oder Ort geöffnet → Intro sofort aus
  useEffect(() => {
    if (intro !== 'off' && (fallback || mode !== 'map' || place)) endIntro()
  }, [intro, fallback, mode, place])

  // Warten auf die Live-3D (langsames Gerät → ohne Intro weiter)
  useEffect(() => {
    if (intro !== 'wait') return
    if (stageLive) {
      // Poster blendet 0,8 s ins Hero-Bild über, dann startet die Fahrt
      const t = window.setTimeout(() => useStore.getState().setIntro('play'), 900)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => {
      if (useStore.getState().intro === 'wait') useStore.getState().setIntro('off')
    }, WAIT_MAX_MS)
    return () => window.clearTimeout(t)
  }, [intro, stageLive])

  // Titelzeile: blendet nach dem Start ein und vor der Landung aus
  useEffect(() => {
    if (intro !== 'play') return
    const a = window.setTimeout(() => setPhase('title'), 500)
    const b = window.setTimeout(() => setPhase('land'), (INTRO_S - 2.6) * 1000)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [intro])

  // Abbruch: jede Eingabe
  useEffect(() => {
    if (intro === 'off') return
    const skip = () => endIntro()
    const opts = { passive: true, capture: true } as const
    window.addEventListener('pointerdown', skip, opts)
    window.addEventListener('wheel', skip, opts)
    window.addEventListener('touchstart', skip, opts)
    window.addEventListener('keydown', skip, true)
    return () => {
      window.removeEventListener('pointerdown', skip, opts)
      window.removeEventListener('wheel', skip, opts)
      window.removeEventListener('touchstart', skip, opts)
      window.removeEventListener('keydown', skip, true)
    }
  }, [intro])

  if (intro === 'off') return null
  return (
    <div className="kintro" data-phase={intro === 'play' ? phase : 'idle'} aria-live="polite">
      <p className="kintro__title">
        <span>{CLUB.name} · seit {CLUB.founded}</span>
        <strong>{CLUB.claim}</strong>
      </p>
      <button className="kintro__skip" onClick={() => endIntro()}>
        Zur Karte
        <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {intro === 'play' && (
        <div
          className="kintro__bar"
          style={{ transform: 'scaleX(1)', transition: `transform ${INTRO_S}s linear` }}
          ref={(el) => {
            // ab 0 starten (ein Frame Verzögerung, damit die Transition greift)
            if (el && !el.dataset.go) {
              el.dataset.go = '1'
              el.style.transform = 'scaleX(0)'
              requestAnimationFrame(() => requestAnimationFrame(() => (el.style.transform = 'scaleX(1)')))
            }
          }}
        />
      )}
    </div>
  )
}
