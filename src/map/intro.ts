import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { startTour, toMap } from './nav'

// ─────────────────────────────────────────────────────────────
// v17-D „Intro + Scroll = Rundgang".
//  · Erster Besuch: kurze Kamerafahrt (Hero-Flutlicht → über den Platz →
//    Landung in der Karten-Totale), jederzeit abbrechbar. Danach Karte.
//    Merker in localStorage (try/catch: ohne Speicher → kein Intro).
//  · Auf der Karte startet Scrollen (Rad, Wischen, ↓/Bild↓/Leertaste)
//    nahtlos den Rundgang; ganz oben im Rundgang führt weiteres Hoch-
//    scrollen zurück auf die Karte.
// three-frei (läuft auch im Poster-/Fallback-Pfad).
// ─────────────────────────────────────────────────────────────

const KEY = 'sva-intro'
/** Dauer der Fahrt in Sekunden (CameraRig liest denselben Wert). */
export const INTRO_S = 8

export function markIntroSeen() {
  try {
    localStorage.setItem(KEY, 'seen')
  } catch {
    /* privater Modus → beim nächsten Mal eben ohne Merker */
  }
}

/** Soll beim Start das Intro laufen? (synchron, vor dem ersten Render) */
export function wantIntro(): boolean {
  if (typeof window === 'undefined') return false
  const q = new URLSearchParams(window.location.search)
  if (q.get('intro') === '1') return true // Abnahme/Screens: Intro erzwingen
  // Prerender (Playwright) und Mess-Skripte: nie (sonst landet das Intro
  // im vorgerenderten HTML und die Marker wären vor dem JS versteckt)
  if (q.has('cam') || navigator.webdriver) return false
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  try {
    return localStorage.getItem(KEY) !== 'seen'
  } catch {
    return false
  }
}

/** Intro beenden (Abbruch oder fertig) — Kamera fliegt in die Totale. */
export function endIntro() {
  const s = useStore.getState()
  if (s.intro === 'off') return
  markIntroSeen()
  s.setIntro('off')
}

const isUiTarget = (t: EventTarget | null) =>
  !!(t as Element | null)?.closest?.('.kpanel, .pgal, .modal-backdrop, .fanlb, .glb, input, textarea, select')

/** Karte: Scrollen/Wischen nach unten → Rundgang. */
export function useMapScrollToTour(active: boolean) {
  useEffect(() => {
    if (!active) return
    // kurze Sperre: der Rad-Schwung, der das Intro abgebrochen oder den
    // Rundgang verlassen hat, soll nicht sofort wieder umschalten
    const armedAt = performance.now() + 900
    let acc = 0
    let lastT = 0
    let y0: number | null = null
    let fired = false
    const go = () => {
      if (fired) return
      fired = true
      startTour()
    }
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || performance.now() < armedAt || isUiTarget(e.target)) return
      const now = performance.now()
      if (now - lastT > 300) acc = 0
      lastT = now
      if (e.deltaY > 0) {
        acc += e.deltaY
        if (acc > 40) go()
      } else acc = 0
    }
    const onTouchStart = (e: TouchEvent) => {
      y0 = isUiTarget(e.target) || e.touches.length !== 1 ? null : e.touches[0].clientY
    }
    const onTouchMove = (e: TouchEvent) => {
      if (y0 == null || performance.now() < armedAt) return
      if (y0 - e.touches[0].clientY > 64) go()
    }
    const onKey = (e: KeyboardEvent) => {
      if (isUiTarget(e.target) || performance.now() < armedAt) return
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') go()
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('keydown', onKey)
    }
  }, [active])
}

/** Rundgang: ganz oben angekommen und weiter hoch → zurück auf die Karte. */
export function useTourTopToMap(active: boolean) {
  useEffect(() => {
    if (!active) return
    const armedAt = performance.now() + 900
    let topSince = window.scrollY <= 1 ? performance.now() : 0
    let acc = 0
    let lastT = 0
    let y0: number | null = null
    let fired = false
    const go = () => {
      if (fired) return
      fired = true
      toMap()
    }
    const atTopLongEnough = () => {
      const now = performance.now()
      return now > armedAt && topSince > 0 && now - topSince > 250
    }
    const onScroll = () => {
      if (window.scrollY <= 1) topSince ||= performance.now()
      else {
        topSince = 0
        acc = 0
      }
    }
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || isUiTarget(e.target) || !atTopLongEnough()) return
      const now = performance.now()
      if (now - lastT > 300) acc = 0
      lastT = now
      if (e.deltaY < 0) {
        acc -= e.deltaY
        if (acc > 120) go()
      } else acc = 0
    }
    const onTouchStart = (e: TouchEvent) => {
      y0 = window.scrollY <= 1 && !isUiTarget(e.target) && e.touches.length === 1 ? e.touches[0].clientY : null
    }
    const onTouchMove = (e: TouchEvent) => {
      if (y0 == null || !atTopLongEnough()) return
      if (e.touches[0].clientY - y0 > 90) go()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
    }
  }, [active])
}
