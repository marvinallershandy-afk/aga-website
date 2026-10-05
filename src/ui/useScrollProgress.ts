import { useEffect } from 'react'
import { useStore } from '../store/useStore'
// P1: Sektionstexte aus der Fassade (sm_website_content-Overlay → sonst Seed).
import { SECTIONS } from '../data/content'
import { setAnchors } from '../camera/anchors'
import { measureStopAnchors, STOP_INDEX, TEAM_FIRST, TEAM_TOTALE } from '../camera/tourPlan'
import { tourCam } from '../camera/rigState'

// ECHTE DOM-Sektionen in Rundgang-Reihenfolge (v18-R, docs/RUNDGANG.md):
// Verein → Mannschaft → Bande → Fans → Anzeigetafel → Partyraum → Mitmachen.
const SECTION_IDS = ['verein', 'mannschaft', 'sponsoren', 'fanblock', 'tabelle', 'musik', 'kontakt']
// Sektionen mit Inhalt > Viewport ruhen am ANFANG (offsetTop) statt mittig
// (Klasse .section--snap-start — heißt historisch so, Snap ist aus).
const SNAP_START_IDS = new Set(['tabelle', 'kontakt'])
// v18-R: Die Mannschaft ist eine Sticky-Strecke mit einem Halt je Spieler
// der Startelf + Totale (tourPlan.measureStopAnchors).
const FLYOVER_ID = 'mannschaft'
function isFlyover(el: HTMLElement): boolean {
  return el.classList.contains('section--team-fly')
}

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
    let sectionAnchors: { id: string; p0: number; p1: number }[] = []
    // v13-K1: Präsenz-Fenster pro Sektion — der DOM-Text lebt nur rund um
    // seinen Snap-Ruhepunkt (bzw. innerhalb des Inhalts bei Start-Snap-
    // Sektionen) und blendet auf den Reise-Etappen aus. Vorher standen im
    // Transit die Texte ZWEIER Stationen gleichzeitig im Bild.
    let presenceZones: { el: HTMLElement; w0: number; w1: number }[] = []
    // v18-R: Halt-Anker in px — damit folgt die Text-Präsenz der KAMERA
    // (tourCam.s, gedämpfte Fahrt) statt dem rohen Scroll: Stationstexte
    // erscheinen, wenn die Kamera ankommt, nicht schon davor.
    let stopY: number[] = []

    const measure = () => {
      const m = measureStopAnchors()
      if (!m) return
      const { y, max } = m
      stopY = y
      setAnchors(y.map((v) => v / max))
      const vh = window.innerHeight
      // Nav-Highlight: Intervall je Sektion (Mannschaft: ganze Spieler-
      // Strecke, Musik: drinnen im Raum)
      const span: Record<string, [number, number]> = {
        verein: [y[0], y[0]],
        mannschaft: [y[TEAM_FIRST], y[TEAM_TOTALE]],
        sponsoren: [y[STOP_INDEX.sponsoren], y[STOP_INDEX.sponsoren]],
        fanblock: [y[STOP_INDEX.fanblock], y[STOP_INDEX.fanblock]],
        tabelle: [y[STOP_INDEX.tabelle], y[STOP_INDEX.tabelle]],
        musik: [y[STOP_INDEX['musik-raum']], y[STOP_INDEX['musik-raum-ende']]],
        kontakt: [y[y.length - 1], y[y.length - 1]],
      }
      sectionAnchors = SECTION_IDS.map((id) => ({ id, p0: span[id][0] / max, p1: span[id][1] / max })).filter((a) =>
        SECTIONS.some((s) => s.id === a.id),
      )
      // v13-K1: Präsenz-Fenster (scrollY-Pixel) — Text lebt um seinen Halt.
      presenceZones = SECTION_IDS.flatMap((id) => {
        const el = document.getElementById(id)
        if (!el) return []
        const center = el.offsetTop + el.offsetHeight / 2 - vh / 2
        if (id === FLYOVER_ID && isFlyover(el)) {
          return [{ el, w0: el.offsetTop, w1: el.offsetTop + Math.max(0, el.offsetHeight - vh) }]
        }
        if (id === 'musik') return [{ el, w0: span.musik[0], w1: span.musik[1] }]
        const w0 = id === 'verein' ? 0 : SNAP_START_IDS.has(id) ? el.offsetTop : center
        const w1 = SNAP_START_IDS.has(id) ? el.offsetTop + Math.max(0, el.offsetHeight - vh) : center
        return [{ el, w0, w1 }]
      })
    }

    // v13-K1: Präsenz anwenden — Fade-Weg ab Ruhefenster. Tap-Schutz im
    // Transit über pointer-events. v18-R: Fade-Weg 0.5 → 0.25 vh und
    // gemessen an der Kamera-Lage (s. stopY) → Text erst bei Ankunft.
    const lastOp = new Map<HTMLElement, string>()
    const applyPresence = (y: number) => {
      const fadeDist = window.innerHeight * 0.25
      for (const z of presenceZones) {
        const dist = y < z.w0 ? z.w0 - y : y > z.w1 ? y - z.w1 : 0
        const t = Math.min(1, dist / fadeDist)
        const presence = 1 - t * t * (3 - 2 * t)
        const op = presence.toFixed(3)
        if (lastOp.get(z.el) === op) continue
        lastOp.set(z.el, op)
        z.el.style.opacity = op
        z.el.style.pointerEvents = presence < 0.04 ? 'none' : ''
      }
    }
    let camRaf = 0
    let lastS = -2
    const camLoop = () => {
      camRaf = requestAnimationFrame(camLoop)
      const s = tourCam.s
      if (s < 0 || stopY.length === 0 || Math.abs(s - lastS) < 1e-4) return
      lastS = s
      const i = Math.min(stopY.length - 2, Math.max(0, Math.floor(s)))
      const f = Math.min(1, Math.max(0, s - i))
      applyPresence(stopY[i] + (stopY[i + 1] - stopY[i]) * f)
    }
    camRaf = requestAnimationFrame(camLoop)

    const update = () => {
      raf = 0
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      setScroll(p)
      if (tourCam.s < 0) applyPresence(window.scrollY)
      // Nav-Highlight: nächstgelegene Sektions-Station
      if (sectionAnchors.length) {
        let best = 0
        let bestDist = Infinity
        sectionAnchors.forEach((a, i) => {
          const d = p < a.p0 ? a.p0 - p : p > a.p1 ? p - a.p1 : 0
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
      // v14-D: Präsenz-Stile zurücksetzen. Schaltet die Seite nach dem Start
      // in den Fallback (reduced-motion / kein WebGL), blieben die Sektionen
      // sonst mit opacity:0 unsichtbar — auch die statischen Karten.
      for (const z of presenceZones) {
        z.el.style.opacity = ''
        z.el.style.pointerEvents = ''
      }
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      if (raf) cancelAnimationFrame(raf)
      cancelAnimationFrame(camRaf)
    }
  }, [enabled])
}
