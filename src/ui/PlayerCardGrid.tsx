import { useEffect, useState } from 'react'
import { PLAYERS, STAFF } from '../data/players'
import { CONTACT } from '../data/club'
import { useStore } from '../store/useStore'
import { HoloCard } from './HoloCard'
import { StaffCard } from './StaffCard'
import { PlayerGallery } from './PlayerGallery'
import { jumpToSection } from './Brandbar'

// v13-E9: Der Spieler-Funnel beginnt HIER (FIFA-Karten = „da will ich
// spielen") — aber der Probetraining-Termin stand bisher erst ganz am
// Ende der Reise. Die Pill bringt den Termin an die Mannschafts-Station
// und springt direkt zum Mitmachen-Beat.
function TrainingPill() {
  return (
    <button className="training-pill" onClick={() => jumpToSection('kontakt')}>
      Selber kicken? Probetraining {CONTACT.training} <span aria-hidden="true">→</span>
    </button>
  )
}

// P5-E2 (Katalog #7, Mobil): reaktive „schmaler Viewport"-Erkennung. Auf 375px
// können 17 FIFA-Karten als 3D-Perspektiv-Formation nicht einzeln lesbar stehen
// (Physik des Bildausschnitts) — dort zeigen wir das DOM-Grid inline, damit
// jede Karte/jeder Name lesbar & tappbar ist (Backdrop bleibt die 3D-Bühne).
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

export function PlayerCardGrid() {
  const setSelected = useStore((s) => s.setSelectedPlayer)
  const fallback = useStore((s) => s.fallback)
  const isNarrow = useIsNarrow()
  const [galleryOpen, setGalleryOpen] = useState(false)

  // v11-E1: Im 3D-Pfad LEBEN die Karten auf dem Platz (PlayerCards3D) —
  // Aufstellung, gestaffelter Reveal, Tap → dasselbe Flip-Detail-Modal.
  // Das DOM-Grid ist dann nur der barrierefreie Fallback (kein WebGL /
  // reduced-motion). So gibt es die Karten genau einmal, nie doppelt.
  // v12-E2: zusätzlich „Alle Spieler anzeigen" → gruppierte Galerie-Ansicht.
  // P5-E2: … UND auf schmalen Viewports (Mobil) — dort liegt die 3D-Formation
  // als Backdrop hinter dem Text, die einzeln lesbaren Karten kommen aus dem
  // inline DOM-Grid (kein Doppel-Rendering: PlayerCards3D blendet die Karten
  // auf Mobil aus).
  if (!fallback && !isNarrow) {
    return (
      <>
        <p className="card-grid__hint">
          Tippe eine Karte auf dem Platz an — sie dreht sich und zeigt dir Saison &amp; Stats.
        </p>
        <button className="btn btn--primary card-grid__all" onClick={() => setGalleryOpen(true)}>
          Alle Spieler anzeigen
        </button>
        <TrainingPill />
        <PlayerGallery open={galleryOpen} onClose={() => setGalleryOpen(false)} />
      </>
    )
  }

  return (
    <>
      <div className="card-grid">
        {PLAYERS.map((p) => (
          <HoloCard key={p.id} player={p} onClick={setSelected} />
        ))}
      </div>

      <TrainingPill />

      {/* v10-E2: Trainerstab als eigene, klar abgesetzte Kategorie */}
      <div className="staff-block">
        <span className="staff-block__label">Trainerstab</span>
        <div className="staff-grid">
          {STAFF.map((m) => (
            <StaffCard key={m.id} member={m} />
          ))}
        </div>
      </div>
    </>
  )
}
