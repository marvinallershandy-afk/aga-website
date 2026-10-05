import { useEffect, useState } from 'react'
// P1: Website-Daten aus der Fassade (Overlay/DB → sonst statischer Seed).
import { PLAYERS, STAFF, CONTACT, POSITION_LABEL, ROLE_LABEL, type Player } from '../data/content'
import { useStore } from '../store/useStore'
import { HoloCard } from './HoloCard'
import { StaffCard } from './StaffCard'
import { PlayerGallery } from './PlayerGallery'
import { jumpToSection } from './Brandbar'
import { TacticsBoard } from './TacticsBoard'
import {
  TEAM_CARDS,
  TEAM_PLAYERS,
  BANK,
  STAB,
  FORMATION_LABEL,
  MATCH_LABEL,
  FOCUS_ORDER,
  teamState,
  focusCardAt,
  teamPhaseAt,
} from '../camera/teamLayout'

// v13-E9: Der Spieler-Funnel beginnt HIER (FIFA-Karten = „da will ich
// spielen") — die Pill bringt den Probetraining-Termin an die Mannschaft.
function TrainingPill() {
  return (
    <button className="training-pill" onClick={() => jumpToSection('kontakt')}>
      Selber kicken? Probetraining {CONTACT.training} <span aria-hidden="true">→</span>
    </button>
  )
}

const NARROW_QUERY = '(max-width: 640px)'
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY)
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

function lastName(name: string) {
  return name.trim().split(/\s+/).slice(-1)[0]
}

/** Kennzeichen hinter der Position — nur echte Flags. */
function flagsOf(p: Player): string[] {
  const f: string[] = []
  if (p.isCaptain) f.push('Kapitän')
  if (p.isNewSigning) f.push('Neuzugang')
  if (p.isPlayerOfMonth) f.push('Spieler des Monats')
  return f
}

// ─── Desktop/Tablet: Fokus-Text synchron zum Flyover ─────────
// Liest teamState (vom CameraRig pro Frame geschrieben) per rAF und
// rendert nur bei Wechsel der Fokus-Karte neu → ruhig, kein Flackern.
function TeamFocus() {
  const setSelected = useStore((s) => s.setSelectedPlayer)
  const [view, setView] = useState<{ phase: 'intro' | 'focus' | 'outro'; idx: number }>({ phase: 'intro', idx: -1 })
  useEffect(() => {
    let raf = 0
    let last = ''
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (teamState.w < 0.02) return
      const phase = teamPhaseAt(teamState.s)
      const idx = phase === 'focus' ? focusCardAt(teamState.s) : -1
      const key = `${phase}:${idx}`
      if (key !== last) {
        last = key
        setView({ phase, idx })
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const card = view.idx >= 0 ? TEAM_CARDS[view.idx] : null
  const p = card?.player
  const order = FOCUS_ORDER.indexOf(view.idx)
  const label = MATCH_LABEL ? `Aufstellung ${MATCH_LABEL}` : `Unsere Elf · ${FORMATION_LABEL}`

  return (
    <div className="team-focus">
      <div className="team-focus__meta">{label}</div>
      {view.phase === 'focus' && p ? (
        <button key={p.id} className="team-focus__card" onClick={() => setSelected(p, TEAM_PLAYERS)} aria-label={`${p.name} öffnen`}>
          <span className="team-focus__num">{p.number ?? '–'}</span>
          <span className="team-focus__txt">
            <span className="team-focus__pos">
              {POSITION_LABEL[p.position]}
              {flagsOf(p).map((f) => (
                <em key={f}>{f}</em>
              ))}
            </span>
            <b className="team-focus__name">
              <small>{p.name.split(' ').slice(0, -1).join(' ')}</small>
              {lastName(p.name)}
            </b>
          </span>
        </button>
      ) : view.phase === 'outro' ? (
        <div key="outro" className="team-focus__outro">
          {BANK.length > 0 && (
            <p>
              <span>Auf der Bank</span>
              {BANK.map((b) => lastName(b.name)).join(' · ')}
            </p>
          )}
          {STAB.length > 0 && (
            <p>
              <span>An der Linie</span>
              {STAB.map((m) => `${m.name} (${ROLE_LABEL[m.role]})`).join(' · ')}
            </p>
          )}
        </div>
      ) : (
        <p key="intro" className="team-focus__intro">
          Scroll über den Platz: Wir fliegen einmal über die Elf. Tipp eine Karte an, dann dreht sie sich.
        </p>
      )}
      <div className="team-focus__dots">
        {FOCUS_ORDER.map((ci, i) => (
          <i key={ci} data-on={i === order ? 'true' : undefined} data-done={order >= 0 && i < order ? 'true' : undefined} />
        ))}
      </div>
    </div>
  )
}

export function PlayerCardGrid() {
  const setSelected = useStore((s) => s.setSelectedPlayer)
  const fallback = useStore((s) => s.fallback)
  const narrow = useNarrow()
  const [galleryOpen, setGalleryOpen] = useState(false)
  const gallery = (
    <PlayerGallery open={galleryOpen} onClose={() => setGalleryOpen(false)} />
  )
  const allBtn = (
    <button className="btn btn--primary card-grid__all" onClick={() => setGalleryOpen(true)}>
      Alle Spieler anzeigen
    </button>
  )

  // 3D-Pfad: Karten leben auf dem Platz (Desktop/Tablet) bzw. im Deck (mobil).
  if (!fallback) {
    // v14-M: Mobil trägt das Taktik-Board die Aufstellung (statt Swipe-Deck).
    if (narrow) {
      return (
        <>
          <TacticsBoard />
          <div className="tboard__actions">
            <button className="btn btn--primary card-grid__all" onClick={() => setGalleryOpen(true)}>
              Alle Spieler
            </button>
          </div>
          {gallery}
        </>
      )
    }
    return (
      <>
        <TeamFocus />
        <div className="team-actions">
          {allBtn}
          <TrainingPill />
        </div>
        {gallery}
      </>
    )
  }

  // Fallback (kein WebGL / reduced-motion): statisches Taktik-Board (v14-M)
  // + Karten-Raster.
  return (
    <>
      <TacticsBoard fluid />
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
