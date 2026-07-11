import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { SECTIONS } from '../data/club'
import { setAnchors } from '../camera/anchors'

// ECHTE DOM-Sektionen (v8: anstoss ist KEINE eigene Sektion mehr).
// v9: fanblock (zw. mannschaft/musik) + sponsoren (zw. musik/tabelle).
// v11-E5: Reihenfolge tabelle↔sponsoren getauscht (…musik, TABELLE, SPONSOREN, kontakt).
const SECTION_IDS = ['verein', 'mannschaft', 'fanblock', 'musik', 'tabelle', 'sponsoren', 'kontakt']
// v13-E2: Sektionen mit Inhalt > Viewport snappen am ANFANG (CSS
// .section--snap-start) — ihr Kamera-Anker muss deshalb auf offsetTop
// gemessen werden statt auf die Sektions-Mitte, sonst ruht der Scroll
// an einer anderen Stelle als die komponierte Kamera-Pose.
const SNAP_START_IDS = new Set(['tabelle', 'kontakt'])
// Anteil des Wegs Verein→Mannschaft, an dem der Anstoß-Dive (Kamera-
// Station 1) liegt — als nahtloser Übergang, ohne eigene Sektion.
const ANSTOSS_FRAC = 0.55

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
      const secP = SECTION_IDS.map((id) => {
        const el = document.getElementById(id)
        if (!el) return 0
        const rest = SNAP_START_IDS.has(id)
          ? el.offsetTop
          : el.offsetTop + el.offsetHeight / 2 - window.innerHeight / 2
        return Math.min(1, Math.max(0, rest / max))
      })
      // Erste Station: schon bei Scroll 0 im Hero-Frame stehen
      secP[0] = Math.min(secP[0], 0.12)
      secP[secP.length - 1] = 1
      // 7 Kamera-Anker: der synthetische Anstoß-Dive liegt zwischen
      // Verein (secP[0]) und Mannschaft (secP[1]) — Übergang, keine Sektion.
      // Danach je ein Anker pro echter Sektion (fanblock, musik, tabelle,
      // kontakt).
      const anstoss = secP[0] + (secP[1] - secP[0]) * ANSTOSS_FRAC
      setAnchors([secP[0], anstoss, secP[1], secP[2], secP[3], secP[4], secP[5], secP[6]])
      // Nav-Highlight nur für echte Sektionen
      sectionAnchors = SECTION_IDS
        .map((id, i) => ({ id, p: secP[i] }))
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

    // Messen, sobald Layout steht — und bei JEDER Höhenänderung neu
    // (Fonts, Widget, Karten-Grid): ResizeObserver auf dem Body.
    measure()
    update()
    const t = setTimeout(measure, 600)
    const ro = new ResizeObserver(() => {
      measure()
      onScroll()
    })
    ro.observe(document.body)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    return () => {
      clearTimeout(t)
      ro.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [enabled])
}
