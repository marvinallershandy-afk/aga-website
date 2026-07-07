import { PLAYERS, STAFF } from '../data/players'
import { useStore } from '../store/useStore'
import { HoloCard } from './HoloCard'
import { StaffCard } from './StaffCard'

export function PlayerCardGrid() {
  const setSelected = useStore((s) => s.setSelectedPlayer)
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
