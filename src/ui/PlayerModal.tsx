import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { POSITION_LABEL, type Player } from '../data/players'
import { HoloCard } from './HoloCard'
import { shareStory, type ShareResult } from './storyShare'

const close = () => useStore.getState().setSelectedPlayer(null)

// Inhalt ist ein eigenes, per player.id gekeyetes Kind → sharing/result
// setzen sich beim Kartenwechsel natürlich zurück (kein setState-in-Effect).
function ModalContent({ player }: { player: Player }) {
  const [sharing, setSharing] = useState(false)
  const [result, setResult] = useState<ShareResult | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [])

  async function onShare() {
    setSharing(true)
    const r = await shareStory(player)
    setResult(r)
    setSharing(false)
  }

  return (
    <motion.div
      className="modal-panel"
      initial={{ scale: 0.9, y: 20, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={{ scale: 0.92, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="modal-card">
        <HoloCard player={player} large />
      </div>
      <div className="modal-info">
        <div className="modal-sub">#{player.number} · {POSITION_LABEL[player.position]}</div>
        <h3>{player.name}</h3>
        <div className="modal-statgrid">
          <div><b>{player.stats.games}</b><span>Spiele</span></div>
          <div><b>{player.stats.goals}</b><span>Tore</span></div>
          <div><b>{player.stats.assists}</b><span>Assists</span></div>
          <div><b>{player.rating}</b><span>Rating</span></div>
          <div><b>{player.position}</b><span>Position</span></div>
          <div><b>{player.since}</b><span>im Verein</span></div>
        </div>
        <div className="modal-actions">
          <button className="btn btn--primary" onClick={onShare} disabled={sharing}>
            {sharing ? 'Erstelle …' : '📲 Als Story teilen'}
          </button>
          <button className="btn btn--ghost" onClick={close}>Zurück</button>
        </div>
        {result === 'downloaded' && <p className="share-note">Bild wurde heruntergeladen — teile es in deiner Story.</p>}
        {result === 'error' && <p className="share-note">Teilen nicht möglich. Bitte erneut versuchen.</p>}
      </div>
    </motion.div>
  )
}

export function PlayerModal() {
  const player = useStore((s) => s.selectedPlayer)

  return (
    <AnimatePresence>
      {player && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={close}
        >
          <button className="modal-close" onClick={close} aria-label="Schließen">×</button>
          <ModalContent key={player.id} player={player} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
