import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { SECTIONS } from '../data/club'
import { setAnchors } from '../camera/anchors'

// Kamera-Stationen in DOM-Reihenfolge (anstoss = leere Beat-Sektion).
const STATION_IDS = ['verein', 'anstoss', 'mannschaft', 'tabelle', 'kontakt']

// Liest den nativen Dokument-Scroll, normalisiert auf 0..1 und legt
// ihn (rAF-gedrosselt) im Store ab. Zusätzlich werden die Kamera-
// Anker aus den ECHTEN Sektions-Zentren gemessen — die Stationen
// rasten exakt ein, egal wie hoch die Sektionen wirklich sind.
export function useScrollProgress(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const setScroll = useStore.getState().setScrollProgress
    const setActive = useStore.getState().setActiveSection
    let raf = 0
    let sectionAnchors: { id: string; p: number }[] = []

    const measure = () => {
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      if (max <= 0) return
      const anchors = STATION_IDS.map((id) => {
        const el = document.getElementById(id)
        if (!el) return 0
        const center = el.offsetTop + el.offsetHeight / 2 - window.innerHeight / 2
        return Math.min(1, Math.max(0, center / max))
      })
      // Erste Station: schon bei Scroll 0 im Hero-Frame stehen
      anchors[0] = Math.min(anchors[0], 0.12)
      anchors[anchors.length - 1] = 1
      setAnchors(anchors)
      sectionAnchors = STATION_IDS
        .map((id, i) => ({ id, p: anchors[i] }))
        .filter((a) => SECTIONS.some((s) => s.id === a.id))
    }

    const update = () => {
      raf = 0
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      setScroll(p)
      // Nav-Highlight: nächstgelegene Sektions-Station
      if (sectionAnchors.length) {
        let best = 0
        let bestDist = Infinity
        sectionAnchors.forEach((a, i) => {
          const d = Math.abs(a.p - p)
          if (d < bestDist) { bestDist = d; best = i }
        })
        setActive(best)
      }
    }

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    const onResize = () => {
      measure()
      onScroll()
    }

    // Messen, sobald Layout steht (Fonts/Bilder können Höhen ändern)
    measure()
    update()
    const t = setTimeout(measure, 600)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    return () => {
      clearTimeout(t)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [enabled])
}
