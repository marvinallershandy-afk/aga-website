import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { POSITION_LABEL, type Player } from '../data/players'
import { HoloCard } from './HoloCard'
import { tierOf, loadCardAssets } from './cardArt'
import { shareStory, type ShareResult } from './storyShare'
import { IgIcon } from './Icons'
import { lockScroll, unlockScroll } from './PlayerGallery'

const close = () => useStore.getState().setSelectedPlayer(null)

// v14-D: Detail-Modal mit Karten 2.0. Vorderseite = HoloCard, Rückseite
// (Flip) zeigt NUR echte Angaben: Name, Nummer, Position, „im Verein seit"
// (nur wenn bekannt) und den Story-Teilen-Button. Keine 0/0/0-Stats, kein
// Platzhalter-Spruch.
function ModalContent({ player }: { player: Player }) {
  const [sharing, setSharing] = useState(false)
  const [result, setResult] = useState<ShareResult | null>(null)
  const [flipped, setFlipped] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const tier = tierOf(player)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    window.addEventListener('keydown', onKey, true)
    lockScroll()
    // Story-Assets vorladen → beim Teilen bleibt die Nutzergeste „frisch"
    void loadCardAssets(player.cutoutUrl ?? null)
    const prev = document.activeElement as HTMLElement | null
    panelRef.current?.querySelector<HTMLElement>('.flip-scene')?.focus()
    return () => {
      window.removeEventListener('keydown', onKey, true)
      unlockScroll()
      prev?.focus?.()
    }
  }, [player.cutoutUrl])

  async function onShare(e?: React.MouseEvent) {
    e?.stopPropagation()
    setSharing(true)
    const r = await shareStory(player)
    setResult(r)
    setSharing(false)
  }

  const flags: string[] = []
  if (player.isCaptain) flags.push('Kapitän')
  if (player.isNewSigning) flags.push('Neuzugang')
  if (player.isPlayerOfMonth) flags.push('Spieler des Monats')

  return (
    <motion.div
      ref={panelRef}
      className="modal-panel"
      role="dialog"
      aria-modal="true"
      aria-label={player.name}
      initial={{ scale: 0.9, y: 20, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={{ scale: 0.92, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="modal-card">
        <div
          className="flip-scene"
          onClick={() => setFlipped(!flipped)}
          role="button"
          tabIndex={0}
          aria-label={flipped ? 'Karte zurückdrehen' : 'Karte umdrehen'}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setFlipped(!flipped))}
        >
          <div className={`flip-inner${flipped ? ' is-flipped' : ''}`}>
            <div className="flip-face">
              <HoloCard player={player} large />
            </div>
            <div className={`flip-back holo holo--${tier}`} aria-hidden={!flipped}>
              <div className="holo__body">
                <div className="holo__emboss" />
                <div className="holo__frame" />
              </div>
              <div className="flip-back__content">
                <img className="flip-back__crest" src="/brand/aga-logo.png" alt="" />
                {player.number !== null && <div className="flip-back__num">{player.number}</div>}
                <div className="flip-back__name">{player.name}</div>
                <div className="flip-back__pos">{POSITION_LABEL[player.position]}</div>
                {player.since !== null && <div className="flip-back__since">im Verein seit {player.since}</div>}
                {flags.length > 0 && <div className="flip-back__flags">{flags.join(' · ')}</div>}
                <button
                  className="btn btn--ig flip-back__share"
                  onClick={(e) => void onShare(e)}
                  disabled={sharing}
                  tabIndex={flipped ? 0 : -1}
                >
                  <IgIcon size={16} />
                  {sharing ? 'Erstelle …' : 'In Story teilen'}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="flip-hint">{flipped ? 'Nochmal tippen: Vorderseite' : 'Karte antippen zum Drehen'}</div>
      </div>
      <div className="modal-info">
        <div className="modal-sub">
          {player.number !== null && <>#{player.number} · </>}
          {POSITION_LABEL[player.position]}
        </div>
        <h3>{player.name}</h3>
        {(flags.length > 0 || player.since !== null) && (
          <div className="modal-chips">
            {flags.map((f) => (
              <span key={f}>{f}</span>
            ))}
            {player.since !== null && <span>im Verein seit {player.since}</span>}
          </div>
        )}
        <p className="modal-lead">Teil die Karte in deiner Instagram-Story — mit Wappen, Nummer und allem Drum und Dran.</p>
        <div className="modal-actions">
          <button className="btn btn--primary" onClick={() => void onShare()} disabled={sharing}>
            <IgIcon size={16} />
            {sharing ? 'Erstelle …' : 'Als Story teilen'}
          </button>
          <button className="btn btn--ghost" onClick={close}>Zurück</button>
        </div>
        {result === 'downloaded' && <p className="share-note">Bild ist im Download-Ordner — ab damit in deine Story.</p>}
        {result === 'error' && <p className="share-note">Hat nicht geklappt — einmal noch, der Ball war im Aus.</p>}
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
