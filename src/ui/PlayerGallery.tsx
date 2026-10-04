import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
// P1: Website-Daten aus der Fassade (Overlay/DB → sonst statischer Seed).
import { PLAYERS, STAFF, POSITION_LABEL, type Position, type Player } from '../data/content'
import { useStore } from '../store/useStore'
import { HoloCard } from './HoloCard'
import { StaffCard } from './StaffCard'
import { shareStory } from './storyShare'

// ─────────────────────────────────────────────────────────────
// „Alle Spieler anzeigen" — Vollbild-Overlay über den ganzen Kader,
// gruppiert nach Tor / Abwehr / Mittelfeld / Angriff + Trainerstab.
// v14-D: per React-Portal direkt an <body>. Vorher lag die Galerie IN
// der Mannschafts-Sektion und erbte deren `pointer-events: none`
// (.section--passthrough) — Klicks und Scrollen gingen ins 3D-Canvas.
// Dazu: Esc/Schließen, Fokus-Falle, Body-Scroll-Lock (gezählt, damit das
// Detail-Modal obendrauf die Sperre nicht vorzeitig löst).
// ─────────────────────────────────────────────────────────────

let locks = 0
let savedOverflow = ''
/** Gezählte Scroll-Sperre fürs Dokument (Galerie + Modal teilen sie). */
export function lockScroll() {
  if (locks++ === 0) {
    savedOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
  }
}
export function unlockScroll() {
  locks = Math.max(0, locks - 1)
  if (locks === 0) {
    document.documentElement.style.overflow = savedOverflow
    document.body.style.overflow = ''
  }
}

const GROUPS: Position[] = ['TW', 'ABW', 'MIT', 'ANG']
const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

export function PlayerGallery({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setSelected = useStore((s) => s.setSelectedPlayer)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    lockScroll()
    const onKey = (e: KeyboardEvent) => {
      // Liegt das Detail-Modal obendrauf, gehört Esc/Tab dem Modal.
      if (useStore.getState().selectedPlayer) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'Tab' && panelRef.current) {
        const els = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
        if (els.length === 0) return
        const first = els[0]
        const last = els[els.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => panelRef.current?.querySelector<HTMLElement>('.pgal__close')?.focus(), 30)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      unlockScroll()
      prev?.focus?.()
    }
  }, [open, onClose])

  const byPos = (pos: Position): Player[] => PLAYERS.filter((p) => p.position === pos)

  if (typeof document === 'undefined') return null
  return createPortal(
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
            ref={panelRef}
            className="pgal__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pgal-title"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="pgal__head">
              <div>
                <span className="pgal__kicker">Der ganze Kader · 1. Herren</span>
                <h3 className="pgal__title" id="pgal-title">Alle Spieler</h3>
              </div>
              <button className="pgal__close" onClick={onClose} aria-label="Schließen">×</button>
            </header>

            <div className="pgal__scroll">
              {GROUPS.map((pos) => {
                const group = byPos(pos)
                if (group.length === 0) return null
                return (
                  <section key={pos} className="pgal__group" aria-label={POSITION_LABEL[pos]}>
                    <span className="pgal__grouplabel">
                      {POSITION_LABEL[pos]} <em>{group.length}</em>
                    </span>
                    <div className="pgal__grid">
                      {group.map((p) => (
                        // v13-K4: jede Karte trägt ihren Story-Share direkt.
                        <div key={p.id} className="pgal__cardwrap">
                          <HoloCard player={p} onClick={(pl) => setSelected(pl)} />
                          <button className="pgal__share" onClick={() => void shareStory(p)}>
                            Story teilen ↗
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )
              })}

              <section className="pgal__group" aria-label="Trainerstab">
                <span className="pgal__grouplabel">
                  Trainerstab <em>{STAFF.length}</em>
                </span>
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
    </AnimatePresence>,
    document.body,
  )
}
