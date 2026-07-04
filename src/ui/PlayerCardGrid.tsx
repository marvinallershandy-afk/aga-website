import { PLAYERS } from '../data/players'
import { useStore } from '../store/useStore'
import { HoloCard } from './HoloCard'

export function PlayerCardGrid() {
  const setSelected = useStore((s) => s.setSelectedPlayer)
  return (
    <div className="card-grid">
      {PLAYERS.map((p) => (
        <HoloCard key={p.id} player={p} onClick={setSelected} />
      ))}
    </div>
  )
}
