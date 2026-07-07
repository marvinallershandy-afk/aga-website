import { PLAYERS, STAFF } from '../data/players'
import { useStore } from '../store/useStore'
import { HoloCard } from './HoloCard'
import { StaffCard } from './StaffCard'

export function PlayerCardGrid() {
  const setSelected = useStore((s) => s.setSelectedPlayer)
  const fallback = useStore((s) => s.fallback)

  // v11-E1: Im 3D-Pfad LEBEN die Karten auf dem Platz (PlayerCards3D) —
  // Aufstellung, gestaffelter Reveal, Tap → dasselbe Flip-Detail-Modal.
  // Das DOM-Grid ist dann nur der barrierefreie Fallback (kein WebGL /
  // reduced-motion). So gibt es die Karten genau einmal, nie doppelt.
  if (!fallback) {
    return (
      <p className="card-grid__hint">
        Tippe eine Karte auf dem Platz an — sie dreht sich und zeigt dir Saison &amp; Stats.
      </p>
    )
  }

  return (
    <>
      <div className="card-grid">
        {PLAYERS.map((p) => (
          <HoloCard key={p.id} player={p} onClick={setSelected} />
        ))}
      </div>

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
