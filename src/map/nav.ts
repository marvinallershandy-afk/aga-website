import { useEffect } from 'react'
import { useStore, type ViewMode } from '../store/useStore'
import { placeFromSlug, TOUR_SLUGS, type PlaceId } from './places'

// ─────────────────────────────────────────────────────────────
// v16-K: Deep-Links + Browser-Zurück für die Karte.
//   /#training, /#mannschaft, /#live …  → Ort direkt offen (IG-Story-Links)
//   /training, /mitspielen …            → gleich, wird auf /#… normalisiert
//   /#rundgang                          → Scroll-Rundgang
// Öffnen per Klick legt EINEN History-Eintrag an (Zurück = zur Karte);
// Ort-Wechsel ersetzt ihn. Schließen geht über history.back(), wenn der
// Eintrag von uns stammt — sonst (Direkteinstieg) über replaceState.
// ─────────────────────────────────────────────────────────────

const MARK = { sva: 1 }

function parse(): { mode: ViewMode; place: PlaceId | null } {
  const hash = window.location.hash.replace(/^#/, '')
  if (TOUR_SLUGS.includes(hash.toLowerCase())) return { mode: 'tour', place: null }
  const fromHash = placeFromSlug(hash)
  if (fromHash) return { mode: 'map', place: fromHash }
  // Pfad-Alias (/training) — nur EIN Segment, nie /admin oder /live (main.tsx)
  const seg = window.location.pathname.replace(/^\/+|\/+$/g, '')
  if (seg && !seg.includes('/')) {
    if (TOUR_SLUGS.includes(seg.toLowerCase())) return { mode: 'tour', place: null }
    const fromPath = placeFromSlug(seg)
    if (fromPath) return { mode: 'map', place: fromPath }
  }
  return { mode: 'map', place: null }
}

function urlFor(mode: ViewMode, place: PlaceId | null): string {
  if (mode === 'tour') return '/#rundgang'
  return place ? `/#${place}` : '/'
}

function samePath(url: string) {
  return window.location.pathname + window.location.hash === url
}

export function openPlace(id: PlaceId) {
  const s = useStore.getState()
  const url = urlFor('map', id)
  if (!samePath(url)) {
    if (s.place && window.history.state?.sva) window.history.replaceState(MARK, '', url)
    else window.history.pushState(MARK, '', url)
  }
  s.setNav({ mode: 'map', place: id })
}

export function closePlace() {
  const s = useStore.getState()
  if (!s.place) return
  if (window.history.state?.sva) {
    // popstate setzt den Zustand (gleicher Weg wie Browser-Zurück)
    window.history.back()
    return
  }
  window.history.replaceState(null, '', '/')
  s.setNav({ place: null })
}

export function startTour() {
  if (!samePath('/#rundgang')) window.history.pushState(MARK, '', '/#rundgang')
  useStore.getState().setNav({ mode: 'tour', place: null })
}

export function toMap() {
  const s = useStore.getState()
  if (s.mode === 'tour' && window.history.state?.sva) {
    window.history.back()
    return
  }
  window.history.replaceState(null, '', '/')
  s.setNav({ mode: 'map', place: null })
}

/** Synchron VOR dem ersten Render: Deep-Link öffnet den Ort ohne Umweg
 *  über die Karten-Totale (Kamera startet direkt dort). */
export function initNavFromUrl() {
  if (typeof window === 'undefined') return
  const first = parse()
  const canon = urlFor(first.mode, first.place)
  if (!samePath(canon) && (first.place || first.mode === 'tour')) {
    window.history.replaceState(null, '', canon)
  }
  useStore.getState().setNav(first)
}

/** Einmal im App-Root: Zurück/Vor/Hash-Edits. */
export function useMapRouting() {
  useEffect(() => {
    const apply = () => {
      const next = parse()
      useStore.getState().setNav(next)
    }
    window.addEventListener('popstate', apply)
    window.addEventListener('hashchange', apply)
    return () => {
      window.removeEventListener('popstate', apply)
      window.removeEventListener('hashchange', apply)
    }
  }, [])
}
