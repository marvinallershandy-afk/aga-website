import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { POSITION_LABEL, type Player } from '../data/players'
import { HoloCard } from './HoloCard'
import { tierOf, loadCardAssets } from './cardArt'
import { playerMedia } from '../data/playerMedia'
import { shareStory, type ShareResult } from './storyShare'
import { IgIcon } from './Icons'
import { lockScroll, unlockScroll } from './PlayerGallery'
import { hdCutout } from './hdCutout'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

const close = () => useStore.getState().setSelectedPlayer(null)

// v14-D: Detail-Modal mit Karten 2.0. Vorderseite = HoloCard, Rückseite
// (Flip) zeigt NUR echte Angaben: Name, Nummer, Position, „im Verein seit"
// (nur wenn bekannt) und den Story-Teilen-Button. Keine 0/0/0-Stats, kein
// Platzhalter-Spruch.
function ModalContent({ player, from = 0 }: { player: Player; from?: number }) {
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
    void loadCardAssets(hdCutout(playerMedia(player.id, player).figure))
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
      initial={from ? { x: from * 48, opacity: 0 } : { scale: 0.9, y: 20, opacity: 0 }}
      animate={{ scale: 1, x: 0, y: 0, opacity: 1 }}
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
  const list = useStore((s) => s.playerList)
  // v14-M: Blättern zwischen Spielern (Taktik-Board / 3D-Feld übergeben
  // Startelf + Bank als Liste): Pfeile, ←/→ und Wischen.
  const idx = player && list ? list.findIndex((p) => p.id === player.id) : -1
  const nav = !!list && idx >= 0 && list.length > 1
  // Richtung der letzten Blätter-Geste — nur für genau den Zielspieler
  // (frisch geöffnete Karten zoomen normal herein).
  const [slide, setSlide] = useState({ id: '', dir: 0 })
  const touch = useRef<{ x: number; y: number } | null>(null)
  const go = (d: number) => {
    if (!nav || !list) return
    const n = list.length
    const next = list[(idx + d + n) % n]
    setSlide({ id: next.id, dir: d })
    useStore.getState().setSelectedPlayer(next)
  }
  useEffect(() => {
    if (!nav || !list) return
    const onKey = (e: KeyboardEvent) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      if (!d) return
      const next = list[(idx + d + list.length) % list.length]
      setSlide({ id: next.id, dir: d })
      useStore.getState().setSelectedPlayer(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nav, idx, list])

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
          onTouchStart={(e) => {
            const t = e.touches[0]
            touch.current = t ? { x: t.clientX, y: t.clientY } : null
          }}
          onTouchEnd={(e) => {
            const t0 = touch.current
            const t = e.changedTouches[0]
            touch.current = null
            if (!t0 || !t || !nav) return
            const dx = t.clientX - t0.x
            const dy = t.clientY - t0.y
            if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1)
          }}
        >
          <button className="modal-close" onClick={close} aria-label="Schließen">
            <X size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
          {nav && list && (
            <>
              <span className="modal-count" aria-live="polite">
                {idx + 1} / {list.length}
              </span>
              <button
                className="modal-nav modal-nav__prev"
                onClick={(e) => {
                  e.stopPropagation()
                  go(-1)
                }}
                aria-label={`Vorheriger Spieler: ${list[(idx - 1 + list.length) % list.length].name}`}
              >
                <ChevronLeft size={22} strokeWidth={1.5} aria-hidden="true" />
              </button>
              <button
                className="modal-nav modal-nav__next"
                onClick={(e) => {
                  e.stopPropagation()
                  go(1)
                }}
                aria-label={`Nächster Spieler: ${list[(idx + 1) % list.length].name}`}
              >
                <ChevronRight size={22} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </>
          )}
          <ModalContent key={player.id} player={player} from={slide.id === player.id ? slide.dir : 0} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
