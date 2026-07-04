import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { SECTIONS } from '../data/club'

// Anzahl Stationen = Anzahl Sektionen (kein three-Import im Haupt-Bundle).
const STATION_COUNT = SECTIONS.length

// Liest den nativen Dokument-Scroll, normalisiert auf 0..1 und legt
// ihn (rAF-gedrosselt) im Store ab. Der Nutzer behält die volle
// Kontrolle über den Scroll — wir hijacken nichts.
export function useScrollProgress(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const setScroll = useStore.getState().setScrollProgress
    const setActive = useStore.getState().setActiveSection
    let raf = 0

    const update = () => {
      raf = 0
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      const p = max > 0 ? window.scrollY / max : 0
      const clamped = Math.min(1, Math.max(0, p))
      setScroll(clamped)
      setActive(Math.round(clamped * (STATION_COUNT - 1)))
    }

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [enabled])
}
