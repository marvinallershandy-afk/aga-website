import { useEffect } from 'react'
import { startTour, toMap } from './nav'

// ─────────────────────────────────────────────────────────────
// Karte ↔ Rundgang per Scrollen (v17-D, v18-R).
//  · Auf der Karte startet Scrollen (Rad, Wischen, ↓/Bild↓/Leertaste)
//    den Rundgang — nahtlos: die Route beginnt in der Karten-Totale, die
//    Kamera fährt vom ersten Scroll-Pixel an mit (kein Text dazwischen).
//    Der Weg, der das Umschalten ausgelöst hat, wird übernommen (carry).
//  · Ganz oben im Rundgang führt weiteres Hochscrollen zurück auf die Karte.
//  · v18-R: Das automatische Intro (Fahrt beim ersten Besuch) ist entfallen
//    (Marvin: „trägt nicht") — die Seite startet ruhig auf der Totale.
// three-frei (läuft auch im Poster-/Fallback-Pfad).
// ─────────────────────────────────────────────────────────────

let carry = 0
/** Scroll-Weg, der auf der Karte den Rundgang ausgelöst hat (einmalig). */
export function takeTourCarry(): number {
  const c = carry
  carry = 0
  return c
}

const isUiTarget = (t: EventTarget | null) =>
  !!(t as Element | null)?.closest?.('.kpanel, .pgal, .modal-backdrop, .fanlb, .glb, input, textarea, select')

/** Karte: Scrollen/Wischen nach unten → Rundgang. */
export function useMapScrollToTour(active: boolean) {
  useEffect(() => {
    if (!active) return
    // kurze Sperre: der Rad-Schwung, der den Rundgang (nach oben) verlassen
    // hat, soll nicht sofort wieder umschalten
    const armedAt = performance.now() + 300
    let acc = 0
    let lastT = 0
    let y0: number | null = null
    let fired = false
    const go = (dist = 0) => {
      if (fired) return
      fired = true
      carry = Math.max(0, Math.min(400, dist))
      startTour()
    }
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || performance.now() < armedAt || isUiTarget(e.target)) return
      const now = performance.now()
      if (now - lastT > 300) acc = 0
      lastT = now
      if (e.deltaY > 0) {
        acc += e.deltaY * (e.deltaMode === 1 ? 16 : 1)
        if (acc > 24) go(acc)
      } else acc = 0
    }
    const onTouchStart = (e: TouchEvent) => {
      y0 = isUiTarget(e.target) || e.touches.length !== 1 ? null : e.touches[0].clientY
    }
    const onTouchMove = (e: TouchEvent) => {
      if (y0 == null || performance.now() < armedAt) return
      const d = y0 - e.touches[0].clientY
      if (d > 24) go(d)
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
