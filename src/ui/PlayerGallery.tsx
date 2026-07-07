import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PLAYERS, STAFF, POSITION_LABEL, type Position, type Player } from '../data/players'
import { useStore } from '../store/useStore'
import { HoloCard } from './HoloCard'
import { StaffCard } from './StaffCard'

// ─────────────────────────────────────────────────────────────
// v12-E2: „Alle Spieler anzeigen" — Vollbild-Galerie über den ganzen
// Kader, gruppiert nach Tor / Abwehr / Mittelfeld / Sturm + Trainerstab.
// Karten sind dieselben HoloCards (Klick → Detail-Modal wie auf dem Platz).
// Übersichtlicher Zugang, ergänzt die 3D-Aufstellung (additiv).
// ─────────────────────────────────────────────────────────────

const GROUPS: Position[] = ['TW', 'ABW', 'MIT', 'ANG']

export function PlayerGallery({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setSelected = useStore((s) => s.setSelectedPlayer)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  const byPos = (pos: Position): Player[] => PLAYERS.filter((p) => p.position === pos)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="pgal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="pgal__panel"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="pgal__head">
              <div>
                <span className="pgal__kicker">Der ganze Kader</span>
                <h3 className="pgal__title">Alle Spieler</h3>
              </div>
              <button className="pgal__close" onClick={onClose} aria-label="Schließen">×</button>
            </header>

            <div className="pgal__scroll">
              {GROUPS.map((pos) => {
                const group = byPos(pos)
                if (group.length === 0) return null
                return (
                  <section key={pos} className="pgal__group">
                    <span className="pgal__grouplabel">{POSITION_LABEL[pos]}</span>
                    <div className="pgal__grid">
                      {group.map((p) => (
                        <HoloCard key={p.id} player={p} onClick={(pl) => { setSelected(pl) }} />
                      ))}
                    </div>
                  </section>
                )
              })}

              <section className="pgal__group">
                <span className="pgal__grouplabel">Trainerstab</span>
                <div className="pgal__grid pgal__grid--staff">
                  {STAFF.map((m) => (
                    <StaffCard key={m.id} member={m} />
                  ))}
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
